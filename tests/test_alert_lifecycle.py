"""Alert identity across days, expiry, and the idempotent DEMO seed.

A persisting condition keeps one id while it keeps firing, so acknowledgements and inspections raised
from it are not orphaned overnight; an alert past its validity (the DEMO one included) is not shown;
`seed-demo` restores the demo scenario instead of adding copies."""

from datetime import date, datetime, timedelta, timezone

from agri_helpers import TODAY, FakeWeather, humid_day
from satquery.agri.areas import demo_areas
from satquery.agri.config import load_pest_rules, load_risk_model
from satquery.agri.pipeline import Sources, assess_areas
from satquery.agri.reports import SampleReportSource
from satquery.agri.service import Snapshot
from satquery.ops import seed
from satquery.ops.models import FarmerReport, ReportCreate, TaskCreate
from satquery.ops.service import OpsService
from satquery.ops.users import USERS
from satquery.store import Store
from satquery.watch.alerts import AlertEpisode, with_episodes

NOW = datetime(2026, 10, 8, 6, 0, tzinfo=timezone.utc)  # 11:30 in Manipur, on TODAY
HUMID = {TODAY + timedelta(days=n): humid_day() for n in range(-3, 3)}


class FixedAgri:
    """The assessment service, pinned to the fixture's weather date (the pipeline reads the real clock)."""

    def __init__(self, days=None):
        areas = demo_areas()
        sources = Sources(weather=FakeWeather(HUMID if days is None else days), ndvi=None,
                          reports=SampleReportSource())
        self._snapshot = Snapshot(areas={a.id: a for a in areas}, assessments=assess_areas(areas, sources, now=NOW),
                                  rules=load_pest_rules(), model=load_risk_model(),
                                  computed_at=NOW.isoformat(), offline=False)

    def snapshot(self):
        return self._snapshot

    def areas(self):
        return list(self._snapshot.areas.values())

    def invalidate(self):
        pass


class Clock:
    def __init__(self, now):
        self.now = now

    def __call__(self):
        return self.now


def service(clock, days=None, store=None):
    return OpsService(store or Store(":memory:"), FixedAgri(days), now=clock)


def blast_in_bishnupur(ops):
    return next(a for a in ops.alerts()[0] if a.subtype == "rice_blast" and a.zone_id == "demo-bishnupur-nambol")


def test_a_persisting_watch_keeps_its_id_acknowledgement_and_inspection_overnight():
    clock = Clock(NOW)
    ops = service(clock)
    alert = blast_in_bishnupur(ops)
    assert alert.id == f"disease.rice_blast.demo-bishnupur-nambol.{TODAY.isoformat()}", "keyed by rule, zone, start"
    ops.acknowledge(USERS["district-bishnupur"], alert.id)
    task = ops.create_task(USERS["district-bishnupur"], TaskCreate(alert_ids=[alert.id], reason="Scout for blast.",
                                                                   priority="low"))

    clock.now = NOW + timedelta(days=1)  # the next day, the rule still fires
    next_day = blast_in_bishnupur(ops)
    assert next_day.id == alert.id and next_day.status == "acknowledged"
    queued = [i.id for i in ops.queue(USERS["district-bishnupur"])]
    assert alert.id not in queued, "the alert stays linked to its inspection, so it does not return to the queue"
    assert task.alert_ids == [next_day.id]


def test_a_condition_that_returns_after_a_gap_starts_a_new_episode():
    ops = service(Clock(NOW))
    base = blast_in_bishnupur(ops).model_copy(update={"id": "disease.rice_blast.z1"})
    episodes = {"disease.rice_blast.z1": AlertEpisode(id="disease.rice_blast.z1", started_on="2026-09-20",
                                                      last_seen_on="2026-10-02")}
    within, changed = with_episodes([base], episodes, date(2026, 10, 5))
    assert within[0].id == "disease.rice_blast.z1.2026-09-20" and changed[0].last_seen_on == "2026-10-05"
    after_gap, changed = with_episodes([base], episodes, date(2026, 10, 8))
    assert after_gap[0].id == "disease.rice_blast.z1.2026-10-08" and changed[0].started_on == "2026-10-08"


def test_heavy_rain_alerts_keep_their_forecast_day_in_the_id():
    rain = {TODAY + timedelta(days=1): {**humid_day(), "precipitation": [3.0] * 24}}
    alert = next(a for a in service(Clock(NOW), days=rain).alerts()[0] if a.category == "weather")
    assert alert.id.endswith((TODAY + timedelta(days=1)).isoformat())


def test_an_expired_demo_alert_is_hidden_and_the_note_says_how_to_refresh_it():
    store = Store(":memory:")
    seed.seed(store)
    clock = Clock(datetime.now(timezone.utc))
    ops = service(clock, days={}, store=store)
    assert [a.id for a in ops.alerts()[0]] == [seed.DEMO_ALERT_ID]

    clock.now += timedelta(days=5)  # past the DEMO alert's three-day validity
    alerts, overview = ops.alerts()
    assert alerts == [] and any("seed-demo" in n for n in overview.notes)


def test_seed_demo_twice_leaves_exactly_the_demo_scenario_and_keeps_real_records():
    store = Store(":memory:")
    ops = service(Clock(datetime.now(timezone.utc)), days={}, store=store)
    real = ops.create_report(USERS["farmer-bishnupur"], ReportCreate(
        category="pest", crop="rice", description="Hoppers at the base of plants.", latitude=24.665, longitude=93.80,
        location_source="map_pin", district="Bishnupur", consent=True))
    seed.seed(store)
    ops.acknowledge(USERS["district-bishnupur"], seed.DEMO_ALERT_ID)
    ops.create_task(USERS["district-bishnupur"], TaskCreate(report_ids=[seed.DEMO_REPORTS[0]], reason="Rehearsal.",
                                                            priority="moderate"))

    seed.seed(store)
    reports = store.all("report", FarmerReport)
    assert sorted(r.id for r in reports if r.is_demo) == sorted(seed.DEMO_REPORTS)
    assert all(r.status == "SUBMITTED" and r.task_id is None for r in reports if r.is_demo), "rehearsal undone"
    assert [r.id for r in reports if not r.is_demo] == [real.id]
    assert store.count("demo_alert") == 1 and store.count("task") == 0 and store.count("alert_state") == 0
    assert ops.alerts()[0][0].status == "active"


def test_demo_and_real_records_cannot_share_an_inspection():
    import pytest
    from fastapi import HTTPException

    store = Store(":memory:")
    ops = service(Clock(datetime.now(timezone.utc)), days={}, store=store)
    seed.seed(store)
    real = ops.create_report(USERS["farmer-bishnupur"], ReportCreate(
        category="waterlogging", crop="rice", description="Water standing.", latitude=24.665, longitude=93.80,
        location_source="map_pin", district="Bishnupur", consent=True))
    with pytest.raises(HTTPException) as refused:
        ops.create_task(USERS["district-bishnupur"], TaskCreate(report_ids=[real.id], alert_ids=[seed.DEMO_ALERT_ID],
                                                                reason="Mixed.", priority="high"))
    assert refused.value.status_code == 422 and "DEMO" in refused.value.detail
