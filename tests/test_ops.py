"""LouNgak Watch alerts, the H3 grid, the Crop Atlas, and the field-operations loop with its permissions:
farmer report -> officer queue -> inspection task -> field outcome -> what the farmer sees."""

from datetime import datetime, timedelta, timezone

import h3
import pytest
from fastapi.testclient import TestClient

from agri_helpers import TODAY, FakeWeather, dry_day, humid_day
from satquery import grid
from satquery.agri.areas import demo_areas
from satquery.agri.pipeline import Sources, assess_areas
from satquery.agri.reports import SampleReportSource
from satquery.agri.service import AssessmentService
from satquery.atlas import load_atlas
from satquery.ops import seed
from satquery.server import create_app
from satquery.settings import Settings
from satquery.store import Store
from satquery.watch.alerts import derive, load_rules

NOW = datetime(2026, 10, 8, 6, 0, tzinfo=timezone.utc)
BISHNUPUR_POINT = {"latitude": 24.665, "longitude": 93.80}  # inside demo-bishnupur-nambol


def rainy_day(mm_per_hour=3.0, hours=24):
    return dry_day() | {"precipitation": [mm_per_hour] * hours}


def alerts_for(days):
    areas = demo_areas()
    sources = Sources(weather=FakeWeather(days), ndvi=None, reports=SampleReportSource())
    return derive({a.id: a for a in areas}, assess_areas(areas, sources, now=NOW), load_rules(), now=NOW)


# ------------------------------------------------------------------------------- alerts

def test_a_heavy_rain_forecast_gives_one_sourced_forecast_alert_per_zone():
    alerts = [a for a in alerts_for({TODAY + timedelta(days=1): rainy_day(3.0)}) if a.category == "weather"]
    assert len(alerts) == 7
    alert = alerts[0]
    assert alert.subtype == "heavy" and alert.priority == "moderate"
    assert alert.evidence_status == "forecast" and alert.rule_status == "SOURCED" and alert.gate == "published"
    assert "72.0 mm" in alert.summary and any("IMD" in e for e in alert.evidence)
    assert any("not evidence of flooding" in lim for lim in alert.limitations)


def test_rain_categories_follow_the_imd_bands_and_the_worst_day_wins():
    days = {TODAY + timedelta(days=1): rainy_day(3.0), TODAY + timedelta(days=2): rainy_day(5.0)}
    alert = next(a for a in alerts_for(days) if a.category == "weather")
    assert alert.subtype == "very_heavy" and alert.priority == "high"
    assert (TODAY + timedelta(days=2)).isoformat() in alert.id


def test_a_dry_or_incomplete_day_gives_no_weather_alert():
    assert not [a for a in alerts_for({}) if a.category == "weather"]
    partial = {TODAY + timedelta(days=1): rainy_day(10.0, hours=12)}  # 120 mm, but only 12 hours known
    assert not [a for a in alerts_for(partial) if a.category == "weather"]


def test_alert_ids_are_stable_so_recomputing_never_duplicates():
    days = {TODAY + timedelta(days=1): rainy_day(3.0)}
    assert [a.id for a in alerts_for(days)] == [a.id for a in alerts_for(days)]


def test_conducive_weather_is_only_a_qualified_unvalidated_watch():
    days = {TODAY + timedelta(days=n): humid_day() for n in range(-3, 3)}
    watch = [a for a in alerts_for(days) if a.subtype == "rice_blast"]
    assert watch and all(a.category == "disease" for a in watch)
    alert = watch[0]
    assert alert.priority == "low" and alert.gate == "qualified_watch" and alert.rule_status == "UNVALIDATED"
    assert alert.evidence_status == "rule_triggered" and "not evidence" in alert.summary


# ------------------------------------------------------------------------------- grid and atlas

def test_records_are_located_by_resolution_8_cells_and_their_zone():
    cell = grid.cell_for(BISHNUPUR_POINT["latitude"], BISHNUPUR_POINT["longitude"])
    assert h3.get_resolution(cell) == 8
    zone = grid.zone_for(BISHNUPUR_POINT["latitude"], BISHNUPUR_POINT["longitude"], demo_areas())
    assert zone is not None and zone.id == "demo-bishnupur-nambol"
    assert grid.zone_for(25.5, 94.5, demo_areas()) is None


def test_the_atlas_is_draft_and_every_sourced_section_cites_a_source():
    atlas = load_atlas()
    assert atlas.status == "DRAFT" and [c.id for c in atlas.crops] == ["rice", "chakhao", "maize"]
    for crop in atlas.crops:
        assert all(s.sources for s in crop.sections if s.status == "SOURCED")
        assert crop.last_reviewed is None


# ------------------------------------------------------------------------------- field operations

@pytest.fixture
def client(tmp_path):
    service = AssessmentService(Settings(runs_dir=tmp_path, agri_warmup=False),
                                sources=Sources(weather=FakeWeather({}), ndvi=None, reports=SampleReportSource()))
    store = Store(":memory:")
    client = TestClient(create_app(agri_service=service, ops_store=store))
    client.store = store
    return client


def as_(user):
    return {"X-Demo-User": user}


def report_body(**changes):
    return {"category": "waterlogging", "crop": "rice", "growth_stage": "harvest", "description": "Water standing.",
            "location_source": "map_pin", "district": "Bishnupur", "consent": True, **BISHNUPUR_POINT} | changes


def test_the_demo_accounts_are_listed_and_labelled(client):
    body = client.get("/api/ops/users").json()
    assert {u["role"] for u in body["users"]} == {"farmer", "field_officer", "district_officer", "state_officer"}
    assert all(u["is_demo"] for u in body["users"]) and "not production authentication" in body["note"]


def test_a_farmer_report_is_stored_unverified_and_located(client):
    report = client.post("/api/ops/reports", json=report_body(), headers=as_("farmer-bishnupur")).json()
    assert report["status"] == "SUBMITTED" and report["evidence_status"] == "farmer_reported_unverified"
    assert report["zone_id"] == "demo-bishnupur-nambol" and h3.get_resolution(report["h3_cell"]) == 8
    assert client.post("/api/ops/reports", json=report_body()).status_code == 401
    assert client.post("/api/ops/reports", json=report_body(), headers=as_("district-bishnupur")).status_code == 403
    assert client.post("/api/ops/reports", json=report_body(consent=False),
                       headers=as_("farmer-bishnupur")).status_code == 422


def test_the_full_loop_from_report_to_verified_outcome(client):
    report = client.post("/api/ops/reports", json=report_body(), headers=as_("farmer-bishnupur")).json()

    # Jurisdiction: only Bishnupur's (and the state) officers see it.
    assert [i["id"] for i in client.get("/api/ops/queue", headers=as_("district-bishnupur")).json()] == [report["id"]]
    assert client.get("/api/ops/queue", headers=as_("district-thoubal")).json() == []
    assert client.get("/api/ops/queue", headers=as_("farmer-bishnupur")).status_code == 403

    client.post(f"/api/ops/reports/{report['id']}/review", headers=as_("district-bishnupur"),
                json={"action": "note", "note": "Internal: check drainage channel."})
    task_body = {"report_ids": [report["id"]], "reason": "Check waterlogging.", "priority": "high",
                 "assigned_to": "field-valley"}
    assert client.post("/api/ops/tasks", json=task_body, headers=as_("district-bishnupur")).status_code == 422
    task = client.post("/api/ops/tasks", json=task_body | {"assigned_to": "field-bishnupur"},
                       headers=as_("district-bishnupur")).json()
    assert task["status"] == "ASSIGNED" and task["district"] == "Bishnupur"
    assert client.get("/api/ops/queue", headers=as_("district-bishnupur")).json() == []

    outcome = {"result": "CONCERN_OBSERVED", "observed_crop": "rice", "crop_condition": "damaged",
               "water_condition": "waterlogged", "public_summary": "Waterlogging seen in the lower fields."}
    assert client.post(f"/api/ops/tasks/{task['id']}/outcome", json=outcome,
                       headers=as_("field-valley")).status_code == 403
    assert client.post(f"/api/ops/tasks/{task['id']}/start", headers=as_("field-bishnupur")).json()["status"] == "IN_PROGRESS"
    done = client.post(f"/api/ops/tasks/{task['id']}/outcome", json=outcome, headers=as_("field-bishnupur")).json()
    assert done["status"] == "COMPLETED" and done["outcome"]["evidence_status"] == "field_observed_officer"

    mine = client.get("/api/ops/reports", headers=as_("farmer-bishnupur")).json()
    assert mine[0]["status"] == "INSPECTED" and mine[0]["public_outcome"] == outcome["public_summary"]
    assert mine[0]["officer_notes"] == [], "internal notes never reach the farmer"
    assert "not a laboratory diagnosis" in mine[0]["history"][-1]["note"]
    assert client.get("/api/ops/reports", headers=as_("farmer-thoubal")).json() == []
    officer_view = client.get("/api/ops/reports", headers=as_("district-bishnupur")).json()
    assert officer_view[0]["officer_notes"][0]["text"].startswith("Internal")


def test_dismissing_needs_a_reason_the_farmer_can_read(client):
    report = client.post("/api/ops/reports", json=report_body(), headers=as_("farmer-bishnupur")).json()
    url = f"/api/ops/reports/{report['id']}/review"
    assert client.post(url, json={"action": "dismiss"}, headers=as_("district-bishnupur")).status_code == 422
    dismissed = client.post(url, json={"action": "dismiss", "public_note": "Outside the cropped area."},
                            headers=as_("district-bishnupur")).json()
    assert dismissed["status"] == "DISMISSED" and dismissed["history"][-1]["note"] == "Outside the cropped area."


def test_demo_records_are_labelled_and_a_matching_alert_raises_the_report(client):
    seed.seed(client.store)
    alerts = client.get("/api/watch/alerts").json()
    demo = [a for a in alerts["alerts"] if a["is_demo"]]
    assert len(demo) == 1 and demo[0]["rule_status"] == "DEMO" and demo[0]["title"].startswith("DEMO")
    assert any("DEMO" in n for n in alerts["notes"])

    queue = client.get("/api/ops/queue", headers=as_("district-bishnupur")).json()
    report = next(i for i in queue if i["kind"] == "report")
    assert report["is_demo"] and report["priority"] == "high" and any("Raised to high" in r for r in report["reasons"])

    assert client.post(f"/api/watch/alerts/{demo[0]['id']}/ack", headers=as_("district-thoubal")).status_code == 403
    acked = client.post(f"/api/watch/alerts/{demo[0]['id']}/ack", headers=as_("district-bishnupur")).json()
    assert acked["status"] == "acknowledged"


def test_the_situation_view_counts_records_per_zone_without_private_counts_for_the_public(client):
    client.post("/api/ops/reports", json=report_body(), headers=as_("farmer-bishnupur"))
    public = {z["zone_id"]: z for z in client.get("/api/ops/situation").json()}
    assert len(public) == 7 and public["demo-bishnupur-nambol"]["reports_open"] == 0
    officer = client.get("/api/ops/situation", headers=as_("district-bishnupur")).json()
    assert [z["zone_id"] for z in officer] == ["demo-bishnupur-nambol"] and officer[0]["reports_open"] == 1


def test_the_atlas_endpoint(client):
    assert len(client.get("/api/atlas/crops").json()["crops"]) == 3


# ------------------------------------------------------------------------------- integrity and permissions

THOUBAL_POINT = {"latitude": 24.615, "longitude": 93.92}


def submit(client, farmer="farmer-bishnupur", **changes):
    response = client.post("/api/ops/reports", json=report_body(**changes), headers=as_(farmer))
    assert response.status_code == 200, response.text
    return response.json()


def task_for(client, officer, report_ids=(), alert_ids=(), **changes):
    body = {"report_ids": list(report_ids), "alert_ids": list(alert_ids), "reason": "Check it.",
            "priority": "high"} | changes
    return client.post("/api/ops/tasks", json=body, headers=as_(officer))


def test_an_officer_cannot_take_over_another_districts_report_by_bundling_it(client):
    own = submit(client)
    other = submit(client, "farmer-thoubal", district="Thoubal", **THOUBAL_POINT)
    response = task_for(client, "district-bishnupur", [own["id"], other["id"]])
    assert response.status_code == 403 and "Thoubal" in response.json()["detail"]
    thoubal_view = client.get("/api/ops/reports", headers=as_("district-thoubal")).json()
    assert thoubal_view[0]["status"] == "SUBMITTED" and thoubal_view[0]["task_id"] is None
    # Even the state officer cannot mix districts into one inspection.
    assert task_for(client, "state-officer", [own["id"], other["id"]]).status_code == 422


def test_a_closed_or_already_tasked_report_cannot_be_tasked_again(client):
    report = submit(client)
    first = task_for(client, "district-bishnupur", [report["id"]]).json()
    again = task_for(client, "district-bishnupur", [report["id"]])
    assert again.status_code == 409 and first["id"] in again.json()["detail"]

    client.post(f"/api/ops/tasks/{first['id']}/assign", json={"assigned_to": "field-bishnupur"},
                headers=as_("district-bishnupur"))
    outcome = {"result": "CONCERN_NOT_OBSERVED", "observed_crop": "rice", "crop_condition": "normal",
               "public_summary": "Fields looked normal."}
    client.post(f"/api/ops/tasks/{first['id']}/outcome", json=outcome, headers=as_("field-bishnupur"))
    inspected = task_for(client, "district-bishnupur", [report["id"]])
    assert inspected.status_code == 409 and "INSPECTED" in inspected.json()["detail"]


def test_an_alert_already_in_an_open_inspection_is_not_tasked_twice(client):
    seed.seed(client.store)
    demo = next(a for a in client.get("/api/watch/alerts").json()["alerts"] if a["is_demo"])
    assert task_for(client, "district-thoubal", alert_ids=[demo["id"]]).status_code == 403
    assert task_for(client, "district-bishnupur", alert_ids=[demo["id"]]).status_code == 200
    assert task_for(client, "district-bishnupur", alert_ids=[demo["id"]]).status_code == 409


def test_due_dates_and_gps_fields_are_validated(client):
    report = submit(client)
    assert task_for(client, "district-bishnupur", [report["id"]], due_on="next friday").status_code == 422
    task = task_for(client, "district-bishnupur", [report["id"]], due_on="2026-11-25",
                    assigned_to="field-bishnupur").json()
    assert task["due_on"] == "2026-11-25"
    outcome = {"result": "INCONCLUSIVE", "observed_crop": "rice", "crop_condition": "normal",
               "public_summary": "Could not tell.", "gps_latitude": 124.6, "gps_longitude": 93.8}
    url = f"/api/ops/tasks/{task['id']}/outcome"
    assert client.post(url, json=outcome, headers=as_("field-bishnupur")).status_code == 422
    assert client.post(url, json=outcome | {"gps_latitude": 24.6, "gps_longitude": None},
                       headers=as_("field-bishnupur")).status_code == 422
    assert client.post(url, json=outcome | {"gps_latitude": 24.6},
                       headers=as_("field-bishnupur")).status_code == 200


def test_concurrent_submissions_get_distinct_ids_and_none_is_lost(tmp_path):
    from concurrent.futures import ThreadPoolExecutor

    from satquery.ops.models import ReportCreate
    from satquery.ops.service import OpsService
    from satquery.ops.users import USERS

    store = Store(tmp_path / "ops.sqlite3")
    service = OpsService(store, AssessmentService(Settings(runs_dir=tmp_path, agri_warmup=False),
                                                  sources=Sources(weather=FakeWeather({}), ndvi=None,
                                                                  reports=SampleReportSource())))
    body = ReportCreate(**report_body())
    with ThreadPoolExecutor(max_workers=16) as pool:
        ids = list(pool.map(lambda _: service.create_report(USERS["farmer-bishnupur"], body).id, range(50)))
    assert len(set(ids)) == 50 and store.count("report") == 50


def test_a_wrong_assignee_leaves_no_orphan_task_behind(client):
    report = submit(client)
    assert task_for(client, "district-bishnupur", [report["id"]], assigned_to="field-valley").status_code == 422
    assert client.store.count("task") == 0
    assert task_for(client, "district-bishnupur", [report["id"]], assigned_to="field-bishnupur").status_code == 200
