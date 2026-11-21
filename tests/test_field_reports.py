"""Field truth drives the score: farmer reports and inspection outcomes feed the report-pressure factor
(decision A; review upgrade 1). DEMO records never move a real score, and an empty store is a stated 0,
never SAMPLE and never an estimate."""

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from agri_helpers import FakeWeather, area
from satquery.agri.config import load_risk_model
from satquery.agri.field_reports import FieldReportSource
from satquery.agri.pipeline import Sources
from satquery.agri.risk import report_factor
from satquery.agri.service import AssessmentService
from satquery.ops import seed
from satquery.ops.models import FarmerReport, InspectionOutcome, InspectionTask
from satquery.server import create_app
from satquery.settings import Settings
from satquery.store import Store

ZONE = "demo-bishnupur-nambol"
POINT = {"latitude": 24.665, "longitude": 93.80}  # inside ZONE


@pytest.fixture
def client(tmp_path):
    store = Store(":memory:")
    service = AssessmentService(Settings(runs_dir=tmp_path, agri_warmup=False),
                                sources=Sources(weather=FakeWeather({}), ndvi=None, reports=FieldReportSource(store)))
    client = TestClient(create_app(agri_service=service, ops_store=store))
    client.store, client.service = store, service
    return client


def as_(user):
    return {"X-Demo-User": user}


def settle(client):
    """Wait for the background recompute a change started (none starts before the first assessment)."""
    if client.service.refresh_thread is not None:
        client.service.refresh_thread.join(timeout=10)


def report(client, category="pest", **point):
    body = {"category": category, "crop": "rice", "description": "Hoppers at the base of the plants.",
            "location_source": "map_pin", "district": "Bishnupur", "consent": True, **(point or POINT)}
    response = client.post("/api/ops/reports", json=body, headers=as_("farmer-bishnupur"))
    assert response.status_code == 200, response.text
    settle(client)  # the report starts a background recompute at once
    return response.json()


def report_factor_of(client, zone=ZONE):
    detail = client.get(f"/api/agri/areas/{zone}").json()
    return detail, next(f for f in detail["assessment"]["factors"] if f["id"] == "report_pressure")


def inspect(client, report_id, result):
    task = client.post("/api/ops/tasks", json={"report_ids": [report_id], "reason": "Check.", "priority": "high",
                                              "assigned_to": "field-bishnupur"},
                       headers=as_("district-bishnupur")).json()
    outcome = {"result": result, "observed_crop": "rice", "crop_condition": "stressed", "public_summary": "Checked."}
    assert client.post(f"/api/ops/tasks/{task['id']}/outcome", json=outcome,
                       headers=as_("field-bishnupur")).status_code == 200
    settle(client)


def test_with_no_field_reports_the_factor_is_a_stated_zero_not_sample_and_not_missing(client):
    overview = client.get("/api/agri/overview").json()
    assert overview["includes_sample_data"] is False
    _, factor = report_factor_of(client)
    assert factor["status"] == "ok" and factor["score"] == 0 and factor["sample_data"] is False
    assert factor["name"] == "Field reports of pests and diseases"
    assert any("No field reports" in r and "not evidence that there are none" in r for r in factor["reasons"])
    assert all("SAMPLE" not in r for r in factor["reasons"])


def test_a_farmer_report_raises_its_zone_on_the_next_overview_and_is_cited_by_id(client):
    before = {a["id"]: a for a in client.get("/api/agri/overview").json()["areas"]}
    submitted = report(client)
    after = {a["id"]: a for a in client.get("/api/agri/overview").json()["areas"]}
    assert after[ZONE]["factor_points"]["report_pressure"] > (before[ZONE]["factor_points"]["report_pressure"] or 0)
    others = [z for z in after if z != ZONE]
    assert all(after[z]["factor_points"] == before[z]["factor_points"] for z in others), "only its own zone moves"

    detail, factor = report_factor_of(client)
    assert any(submitted["id"] in r and "farmer-reported, unverified" in r for r in factor["reasons"])
    listed = factor["details"]["reports"]
    assert [r["id"] for r in listed] == [submitted["id"]] and listed[0]["source"] == "FIELD"
    assert listed[0]["weight"] == 1.0 and listed[0]["severity"] is None, "no severity is invented"
    assert detail["assessment"]["includes_sample_data"] is False


def test_inspection_outcomes_raise_or_lower_the_pressure(client):
    observed, not_observed = report(client), report(client)
    _, factor = report_factor_of(client)
    assert factor["details"]["weighted"] == 2.0

    inspect(client, observed["id"], "CONCERN_OBSERVED")
    _, factor = report_factor_of(client)
    assert factor["details"]["weighted"] == 3.0 and factor["score"] == 1.0
    assert any("concern observed by a field officer" in r for r in factor["reasons"])

    inspect(client, not_observed["id"], "CONCERN_NOT_OBSERVED")
    _, factor = report_factor_of(client)
    assert factor["details"]["weighted"] == 1.0, "an inspection that found nothing lowers the pressure"


def test_demo_records_dismissed_reports_and_other_categories_do_not_count(client):
    seed.seed(client.store)
    client.service.invalidate()
    settle(client)
    waterlogging = report(client, category="waterlogging")
    pest = report(client)
    client.post(f"/api/ops/reports/{pest['id']}/review", json={"action": "dismiss", "public_note": "Not a pest."},
                headers=as_("district-bishnupur"))
    settle(client)
    _, factor = report_factor_of(client)
    assert factor["score"] == 0 and factor["details"]["reports"] == []
    assert waterlogging["id"] not in " ".join(factor["reasons"])


# ------------------------------------------------------------------------------- the source on its own

TODAY = date(2026, 11, 20)
ZONE_AREA = area("z1")  # 93.95-94.03 E, 24.45-24.52 N
INSIDE, OUTSIDE = (24.48, 93.99), (24.60, 93.80)


def farmer_report(report_id, at, point=INSIDE, **changes):
    return FarmerReport(id=report_id, category="disease", crop="rice", growth_stage=None, description="Spots.",
                        latitude=point[0], longitude=point[1], location_source="map_pin", district="Thoubal",
                        h3_cell="x", zone_id="z1", reporter_id="farmer-thoubal", reporter_name="Farmer",
                        submitted_at=at.isoformat(), **changes)


def test_the_source_counts_only_records_inside_the_area_and_the_window():
    store = Store(":memory:")
    now = datetime(2026, 11, 20, 4, 0, tzinfo=timezone.utc)
    store.put("report", "RPT-0001", farmer_report("RPT-0001", now))
    store.put("report", "RPT-0002", farmer_report("RPT-0002", now, point=OUTSIDE))
    store.put("report", "RPT-0003", farmer_report("RPT-0003", now - timedelta(days=20)))
    found, provenance = FieldReportSource(store).for_area(ZONE_AREA, TODAY, 14)
    assert [r.id for r in found] == ["RPT-0001"] and found[0].evidence == "farmer_reported"
    assert provenance.state == "LIVE" and "DEMO records are not counted" in provenance.note


def test_an_inspection_raised_from_a_pest_alert_alone_counts_its_outcome():
    store = Store(":memory:")
    now = datetime(2026, 11, 19, 6, 0, tzinfo=timezone.utc)
    outcome = InspectionOutcome(result="CONCERN_OBSERVED", observed_crop="rice", crop_condition="damaged",
                                public_summary="Planthoppers seen.", recorded_by="field-valley",
                                recorded_by_name="Officer", recorded_at=now.isoformat())
    for task_id, alerts in (("INS-0001", ["pest.brown_planthopper.z1.2026-11-15"]),
                            ("INS-0002", ["weather.heavy_rain.z1.2026-11-19"])):
        store.put("task", task_id, InspectionTask(
            id=task_id, report_ids=[], alert_ids=alerts, latitude=INSIDE[0], longitude=INSIDE[1], h3_cell="x",
            district="Thoubal", zone_id="z1", crop="unknown", reason="Scout.", priority="low", priority_rationale=[],
            created_by="district-thoubal", created_at=now.isoformat(), status="COMPLETED", outcome=outcome))
    found, _ = FieldReportSource(store).for_area(ZONE_AREA, TODAY, 14)
    assert [(r.id, r.pest, r.evidence, r.verified) for r in found] == [("INS-0001", "pest", "concern_observed", True)]


def test_the_factor_floors_at_zero_and_never_exceeds_full_pressure():
    store = Store(":memory:")
    now = datetime(2026, 11, 20, 4, 0, tzinfo=timezone.utc)
    for n in range(1, 6):
        store.put("report", f"RPT-000{n}", farmer_report(f"RPT-000{n}", now))
    found, provenance = FieldReportSource(store).for_area(ZONE_AREA, TODAY, 14)
    factor = report_factor(found, provenance, load_risk_model(), TODAY)
    assert factor.score == 1.0 and factor.details["weighted"] == 5.0
    negative = [r.model_copy(update={"evidence": "concern_not_observed"}) for r in found]
    assert report_factor(negative, provenance, load_risk_model(), TODAY).score == 0.0
