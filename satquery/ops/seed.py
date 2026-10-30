"""Demonstration records for the prototype: two farmer reports and one alert, every one labelled DEMO.

They exist so the workflow can be shown end to end when the real evidence is quiet (for example no
heavy rain in the forecast). They are never mixed with real data: each carries `is_demo`, the web
client labels them, and `reset` removes them along with everything else in the field-operations store.
"""

from datetime import datetime, timedelta, timezone

from satquery import geo, grid
from satquery.agri.areas import demo_areas
from satquery.agri.models import Provenance
from satquery.ops.models import DEMO_LABEL, FarmerReport, StatusChange
from satquery.ops.users import USERS
from satquery.store import Store, now_iso
from satquery.watch.alerts import Alert

KINDS = ("report", "task", "alert_state", "demo_alert")


def reset(store: Store) -> None:
    for kind in KINDS:
        store.delete_kind(kind)


def _report(store: Store, reporter: str, category: str, crop: str, stage: str, text: str, lat: float, lon: float,
            district: str) -> FarmerReport:
    user = USERS[reporter]
    zone = grid.zone_for(lat, lon, demo_areas())
    report = FarmerReport(
        id=store.next_id("report", "RPT"), category=category, crop=crop, growth_stage=stage,
        description=f"{text} [{DEMO_LABEL}]", latitude=lat, longitude=lon, location_source="map_pin",
        district=district, h3_cell=grid.cell_for(lat, lon), zone_id=zone.id if zone else None, reporter_id=user.id,
        reporter_name=user.name, submitted_at=now_iso(), is_demo=True,
        history=[StatusChange(status="SUBMITTED", at=now_iso(), by=user.id, by_name=user.name,
                              note="Report received. It is unverified until an officer reviews it.")])
    store.put("report", report.id, report)
    return report


def seed(store: Store) -> list[str]:
    created = []
    created.append(_report(store, "farmer-bishnupur", "waterlogging", "rice", "maturity / harvest",
                           "Water standing in the lower paddy fields for two days after rain; some plants lodged.",
                           24.665, 93.80, "Bishnupur").id)
    created.append(_report(store, "farmer-thoubal", "disease", "rice", "grain filling",
                           "Brown spindle-shaped spots on leaves in part of the field.", 24.615, 93.92, "Thoubal").id)

    zone = next(a for a in demo_areas() if a.id == "demo-bishnupur-nambol")
    today = datetime.now(timezone.utc).date()
    alert = Alert(
        id=f"demo.weather.heavy_rain.{zone.id}", category="weather", subtype="heavy",
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
    created.append(alert.id)
    return created
