"""Demonstration records for the prototype: two farmer reports and one alert, every one labelled DEMO.

They exist so the workflow can be shown end to end when the real evidence is quiet (for example no
heavy rain in the forecast). They are never mixed with real data: each carries `is_demo`, the web
client labels them, and `reset` removes them along with everything else in the field-operations store.

`seed` is idempotent: it restores the demo scenario. The demo records have fixed ids, so running it
again replaces them (with today's dates, so the DEMO alert is valid again) instead of adding copies,
and it clears what a rehearsal did to them (DEMO inspections, the DEMO alert's acknowledgement).
Records that are not DEMO are never touched.
"""

from datetime import datetime, timedelta, timezone

from satquery import geo, grid
from satquery.agri.areas import demo_areas
from satquery.agri.models import Provenance
from satquery.ops.models import DEMO_LABEL, FarmerReport, InspectionTask, StatusChange
from satquery.ops.users import USERS
from satquery.store import Store, now_iso
from satquery.watch.alerts import Alert

KINDS = ("report", "task", "alert_state", "demo_alert", "alert_episode")
DEMO_ZONE = "demo-bishnupur-nambol"
DEMO_ALERT_ID = f"demo.weather.heavy_rain.{DEMO_ZONE}"
# Not RPT-0001 style: a non-numeric tail never collides with, or shifts, the numbering of real reports.
DEMO_REPORTS = ("RPT-DEMO-A", "RPT-DEMO-B")


def reset(store: Store) -> None:
    for kind in KINDS:
        store.delete_kind(kind)


def _report(report_id: str, reporter: str, category: str, crop: str, stage: str, text: str, lat: float,
            lon: float, district: str) -> FarmerReport:
    user = USERS[reporter]
    zone = grid.zone_for(lat, lon, demo_areas())
    return FarmerReport(
        id=report_id, category=category, crop=crop, growth_stage=stage,
        description=f"{text} [{DEMO_LABEL}]", latitude=lat, longitude=lon, location_source="map_pin",
        district=district, h3_cell=grid.cell_for(lat, lon), zone_id=zone.id if zone else None, reporter_id=user.id,
        reporter_name=user.name, submitted_at=now_iso(), is_demo=True,
        history=[StatusChange(status="SUBMITTED", at=now_iso(), by=user.id, by_name=user.name,
                              note="Report received. It is unverified until an officer reviews it.")])


def _clear_demo(store: Store) -> None:
    """Remove every DEMO record and what a rehearsal attached to them; real records stay. An inspection
    never mixes DEMO and real records (`OpsService.create_task` refuses), so a DEMO task holds only DEMO
    records and removing it leaves no real report pointing at a missing inspection."""
    for task in store.all("task", InspectionTask):
        if task.is_demo:
            store.delete("task", task.id)
    for report in store.all("report", FarmerReport):
        if report.is_demo:
            store.delete("report", report.id)
    for alert in store.all("demo_alert", Alert):
        store.delete("demo_alert", alert.id)
        store.delete("alert_state", alert.id)


def seed(store: Store) -> list[str]:
    _clear_demo(store)
    reports = [
        _report(DEMO_REPORTS[0], "farmer-bishnupur", "waterlogging", "rice", "maturity / harvest",
                "Water standing in the lower paddy fields for two days after rain; some plants lodged.",
                24.665, 93.80, "Bishnupur"),
        _report(DEMO_REPORTS[1], "farmer-thoubal", "disease", "rice", "grain filling",
                "Brown spindle-shaped spots on leaves in part of the field.", 24.615, 93.92, "Thoubal"),
    ]
    for report in reports:
        store.put("report", report.id, report)

    zone = next(a for a in demo_areas() if a.id == DEMO_ZONE)
    today = datetime.now(timezone.utc).date()
    alert = Alert(
        id=DEMO_ALERT_ID, category="weather", subtype="heavy",
        title=f"DEMO: Heavy rain forecast near {zone.name}",
        summary="DEMO alert for the workflow demonstration: not from a real forecast.",
        priority="moderate", evidence_status="forecast", gate="qualified_watch", rule_id="heavy_rain",
        rule_status="DEMO", zone_id=zone.id, zone_name=zone.name, district=zone.district,
        label_point=geo.representative_point(zone.geometry), issued_at=now_iso(),
        valid_from=f"{today.isoformat()}T00:00:00+05:30",
        valid_until=f"{(today + timedelta(days=3)).isoformat()}T23:59:59+05:30",
        evidence=["DEMO: illustrates how a forecast of 64.5 mm or more in a day (IMD 'heavy rain') is shown."],
        limitations=[DEMO_LABEL],
        recommended_action="DEMO: check drainage of low-lying paddy fields and follow official IMD warnings.",
        provenance=[Provenance(source="LouNgak AI demonstration seed", state="SAMPLE", note=DEMO_LABEL)],
        is_demo=True)
    store.put("demo_alert", alert.id, alert)
    return [r.id for r in reports] + [alert.id]
