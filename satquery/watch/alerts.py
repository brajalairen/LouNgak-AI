"""Alerts from one risk assessment: heavy-rain forecasts, vegetation decline, pest/disease-conducive weather.

The alerts are derived each time from the current assessment (`AssessmentService.snapshot()`), so they
can never drift from the evidence shown in the risk drawer. Only what people do with an alert
(acknowledging it) is stored. An alert's id is its deduplication key: the same rule, zone and day give
the same id, so recomputing never creates a duplicate.

Category, priority and evidence status are separate on purpose: a forecast can be high priority and
still only a forecast; a satellite observation can be low priority and still an observation.
"""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from satquery import geo
from satquery.agri.models import MonitoredArea, Provenance, RiskAssessment

ASSETS = Path(__file__).resolve().parent / "assets"
Category = Literal["weather", "pest", "disease", "crop_health", "water_flood", "environment"]
EvidenceStatus = Literal["forecast", "rule_triggered", "satellite_observed", "farmer_reported", "field_verified",
                         "official_warning"]
Gate = Literal["published", "qualified_watch"]
RuleStatus = Literal["SOURCED", "PLACEHOLDER", "UNVALIDATED", "DEMO"]
AlertStatus = Literal["active", "acknowledged"]

CATEGORY_LABEL = {"weather": "Weather", "pest": "Pest risk", "disease": "Disease risk", "crop_health": "Crop health",
                  "water_flood": "Water & flood", "environment": "Environment & community"}


class Alert(BaseModel):
    id: str
    category: Category
    subtype: str
    title: str
    summary: str
    priority: Literal["low", "moderate", "high", "urgent"]
    evidence_status: EvidenceStatus
    gate: Gate
    rule_id: str
    rule_status: RuleStatus
    zone_id: str
    zone_name: str
    district: str | None
    label_point: tuple[float, float]  # (longitude, latitude) inside the zone
    issued_at: str
    valid_from: str
    valid_until: str
    evidence: list[str]
    limitations: list[str]
    recommended_action: str
    provenance: list[Provenance]
    status: AlertStatus = "active"
    acknowledged_by: str | None = None
    acknowledged_at: str | None = None
    is_demo: bool = False


class AlertState(BaseModel):
    """What people did with an alert: the only part of an alert that is stored."""

    id: str
    acknowledged_by: str
    acknowledged_by_name: str
    acknowledged_at: str


class WatchOverview(BaseModel):
    computed_at: str
    assessment_mode: Literal["live", "snapshot"]
    categories: dict[str, str]          # category id -> label, in display order
    counts: dict[str, int]              # active alerts per category
    alerts: list[Alert]
    notes: list[str]


def load_rules(path: Path | None = None) -> dict:
    return json.loads((path or ASSETS / "alert_rules.json").read_text(encoding="utf-8"))


def _end_of_day(day: str) -> str:
    return f"{day}T23:59:59+05:30"  # Manipur is UTC+05:30; the forecast days are local days


def heavy_rain(area: MonitoredArea, a: RiskAssessment, rules: dict, issued: str) -> list[Alert]:
    cfg = rules["heavy_rain"]
    factor = next((f for f in a.factors if f.id == "weather_pest"), None)
    days = ((factor.details if factor else {}).get("weather_summary") or {}).get("forecast_daily") or []
    hits = []
    for day in days:
        if day["precipitation_mm"] is None or day["hours_known"] < cfg["min_hours_known"]:
            continue
        category = next((c for c in cfg["categories"] if day["precipitation_mm"] >= c["min_mm"]), None)
        if category:
            hits.append((day, category))
    if not hits:
        return []
    order = [c["id"] for c in cfg["categories"]]
    day, category = min(hits, key=lambda hit: (order.index(hit[1]["id"]), hit[0]["date"]))  # the worst day first
    stale = any(p.note and "STALE" in p.note for p in factor.provenance)
    listed = "; ".join(f"{d['date']}: {d['precipitation_mm']} mm" for d, _ in hits)
    return [Alert(
        id=f"weather.heavy_rain.{area.id}.{day['date']}", category="weather", subtype=category["id"],
        title=f"{category['label']} forecast near {area.name}",
        summary=(f"The weather model forecasts {day['precipitation_mm']} mm of rain on {day['date']} at the zone's "
                 f"weather point, in the IMD '{category['label'].lower()}' range."),
        priority=category["priority"], evidence_status="forecast",
        gate="qualified_watch" if stale else "published", rule_id="heavy_rain", rule_status=cfg["status"],
        zone_id=area.id, zone_name=area.name, district=area.district,
        label_point=geo.representative_point(area.geometry), issued_at=issued,
        valid_from=f"{days[0]['date']}T00:00:00+05:30", valid_until=_end_of_day(day["date"]),
        evidence=[f"Forecast daily rain at or above {cfg['categories'][-1]['min_mm']} mm: {listed}.",
                  f"Thresholds: {cfg['source']}"],
        limitations=[cfg["limitation"]] + (["The weather data is a STALE cached copy."] if stale else []),
        recommended_action=("Check drainage of low-lying paddy fields and follow any official IMD warning for the "
                            "district. Verify on the ground before reporting damage."),
        provenance=factor.provenance)]


def crop_health(area: MonitoredArea, a: RiskAssessment, rules: dict, issued: str, today: date) -> list[Alert]:
    cfg = rules["crop_health"]
    factor = next((f for f in a.factors if f.id == "ndvi_anomaly"), None)
    if factor is None or factor.status == "unavailable" or factor.score is None or factor.score < cfg["min_factor_score"]:
        return []
    anomaly = factor.details.get("anomaly") or {}
    window_end = (anomaly.get("current") or {}).get("end") or today.isoformat()
    return [Alert(
        id=f"crop_health.ndvi_decline.{area.id}.{window_end}", category="crop_health", subtype="ndvi_decline",
        title=f"Vegetation below earlier years near {area.name}",
        summary=factor.summary + ". A satellite observation that calls for a field check, not a diagnosis.",
        priority="moderate", evidence_status="satellite_observed", gate="qualified_watch",
        rule_id="crop_health", rule_status=cfg["status"], zone_id=area.id, zone_name=area.name,
        district=area.district, label_point=geo.representative_point(area.geometry), issued_at=issued,
        valid_from=issued, valid_until=(today + timedelta(days=cfg["valid_days"])).isoformat() + "T23:59:59+05:30",
        evidence=factor.reasons, limitations=[cfg["limitation"]],
        recommended_action=("Compare with recent imagery and visit representative fields to see whether the change "
                            "is harvest, water stress, flooding or a crop-health problem."),
        provenance=factor.provenance)]


def pest_watch(area: MonitoredArea, a: RiskAssessment, rules: dict, issued: str) -> list[Alert]:
    cfg = rules["pest_watch"]
    alerts = []
    for p in a.pests:
        if p.index is None or p.favourable_forecast < cfg["min_favourable_forecast_days"]:
            continue
        disease = p.pest_id in cfg["disease_rules"]
        forecast_days = [d for d in p.days if d.period == "forecast"]
        valid_until = _end_of_day(forecast_days[-1].date) if forecast_days else issued
        alerts.append(Alert(
            id=f"{'disease' if disease else 'pest'}.{p.pest_id}.{area.id}.{forecast_days[0].date if forecast_days else issued[:10]}",
            category="disease" if disease else "pest", subtype=p.pest_id,
            title=f"Weather conducive to {p.name.lower()} near {area.name} (unvalidated rule)",
            summary=(f"{p.favourable_forecast} of the next {p.forecast_days} forecast days meet the placeholder "
                     f"weather conditions for {p.name.lower()}. This is not evidence that it is present."),
            priority="low", evidence_status="rule_triggered", gate="qualified_watch", rule_id=p.pest_id,
            rule_status=cfg["status"], zone_id=area.id, zone_name=area.name, district=area.district,
            label_point=geo.representative_point(area.geometry), issued_at=issued, valid_from=issued,
            valid_until=valid_until, evidence=[p.explanation] + [f"Condition: {c}" for c in p.conditions],
            limitations=[cfg["limitation"]],
            recommended_action=(f"If {p.crop} is at a susceptible stage, routine field scouting may be worthwhile. "
                                "Follow ICAR/KVK advice for management; LouNgak AI does not prescribe treatments."),
            provenance=next((f.provenance for f in a.factors if f.id == "weather_pest"), [])))
    return alerts


def derive(areas: dict[str, MonitoredArea], assessments: list[RiskAssessment], rules: dict,
           now: datetime | None = None) -> list[Alert]:
    now = now or datetime.now(timezone.utc)
    issued = now.isoformat(timespec="seconds")
    alerts = []
    for a in assessments:
        area = areas[a.area_id]
        alerts += heavy_rain(area, a, rules, issued)
        alerts += crop_health(area, a, rules, issued, now.date())
        alerts += pest_watch(area, a, rules, issued)
    return alerts


PRIORITY_ORDER = {"urgent": 0, "high": 1, "moderate": 2, "low": 3}


def sort_alerts(alerts: list[Alert]) -> list[Alert]:
    return sorted(alerts, key=lambda x: (x.status == "acknowledged", PRIORITY_ORDER[x.priority], x.valid_until))


class DemoAlert(BaseModel):
    """A demonstration alert, stored by the seed command and labelled DEMO everywhere it appears."""

    alert: Alert
    note: str = Field(default="DEMO alert: illustrates the workflow; not derived from real data.")
