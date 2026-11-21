"""Reliability: frozen snapshot with live-first fallback, warm-up, day-to-day stable SAMPLE reports."""

import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from agri_helpers import TODAY, FakeStatsProvider, FakeWeather, area, humid_day, stats_response
from satquery.agri.areas import demo_areas
from satquery.agri.ndvi import NdviClient
from satquery.agri.pipeline import Sources, assess_areas
from satquery.agri.reports import SampleReportSource, generate
from satquery.agri.service import AgriUnavailable, AssessmentService
from satquery.server import create_app
from satquery.settings import Settings

HUMID = {TODAY + timedelta(days=n): humid_day() for n in range(-7, 3)}


def ndvi(current=0.60):
    return NdviClient(FakeStatsProvider({2026: stats_response(current)}
                                        | {y: stats_response(0.75) for y in (2023, 2024, 2025)}))


def sources(**changes):
    return Sources(**({"weather": FakeWeather(HUMID), "ndvi": ndvi(), "reports": SampleReportSource()} | changes))


def service(tmp_path, *, mode="live", **source_changes):
    settings = Settings(runs_dir=tmp_path, agri_mode=mode, agri_refresh_s=0.0)
    return AssessmentService(settings, sources=sources(**source_changes))


def test_a_frozen_snapshot_is_always_labelled_snapshot_never_live(tmp_path):
    live = service(tmp_path)
    path = live.save_snapshot()
    frozen = service(tmp_path, mode="snapshot").snapshot()
    assert frozen.mode == "snapshot" and frozen.snapshot_saved_at and "SATQUERY_AGRI_MODE" in frozen.fallback_reason
    states = {p.state for a in frozen.assessments for p in a.provenance}
    assert "LIVE" not in states and "CACHED" not in states and states == {"SNAPSHOT", "SAMPLE"}
    assert any("originally LIVE" in (p.note or "") for p in frozen.assessments[0].provenance)
    assert [a.score for a in frozen.assessments] == [a.score for a in live.snapshot().assessments]
    assert path.name == "snapshot.json" and path.parent.name == "agri"


def factor(assessment, factor_id):
    return next(f for f in assessment.factors if f.id == factor_id)


def test_live_is_preferred_and_the_snapshot_fills_only_the_inputs_that_are_missing_live(tmp_path):
    complete_live = service(tmp_path).snapshot()
    service(tmp_path).save_snapshot()  # a complete snapshot
    complete = service(tmp_path).snapshot()
    assert complete.mode == "live" and complete.fallback_reason is None, "complete live data wins"
    down = service(tmp_path, weather=FakeWeather(HUMID, fail_inside=(90, 20, 100, 30)),
                   ndvi=NdviClient(None)).snapshot()
    assert down.mode == "live" and down.snapshot_saved_at
    assert "frozen snapshot" in down.fallback_reason and "field reports, is live" in down.fallback_reason
    saved = {a.area_id: a for a in complete_live.assessments}
    for a in down.assessments:
        for factor_id in ("weather_pest", "ndvi_anomaly"):
            filled, had = factor(a, factor_id), factor(saved[a.area_id], factor_id)
            if had.score is None:  # nothing to fill from: still unavailable, never estimated
                assert filled.score is None
                continue
            assert filled.score == had.score and {p.state for p in filled.provenance} == {"SNAPSHOT"}
            assert filled.reasons[0].startswith("Taken from the frozen snapshot saved")
        assert {p.state for p in factor(a, "report_pressure").provenance} == {"SAMPLE"}, "reports are never filled"
    # The same inputs give the same scores: filling re-scores, it does not invent anything.
    assert sorted((a.area_id, a.score) for a in down.assessments) == sorted(
        (a.area_id, a.score) for a in complete_live.assessments)


def test_a_new_field_report_still_moves_the_score_while_ndvi_comes_from_the_snapshot(tmp_path):
    """The live demo moment on a bad venue network: Copernicus is unreachable, so NDVI comes from Saturday's
    snapshot, and a farmer's pest report must still raise the zone's score and be cited by id."""
    from datetime import datetime, timezone

    from satquery.agri.field_reports import FieldReportSource
    from satquery.ops.models import FarmerReport
    from satquery.store import Store

    store = Store(":memory:")
    service(tmp_path, reports=FieldReportSource(store)).save_snapshot()  # complete, no reports yet
    down = service(tmp_path, reports=FieldReportSource(store), ndvi=NdviClient(None))
    zone = "demo-bishnupur-nambol"
    before = down.snapshot().assessment(zone)
    assert factor(before, "ndvi_anomaly").score is not None, "NDVI filled from the snapshot"
    assert factor(before, "report_pressure").score == 0
    store.put("report", "RPT-0001", FarmerReport(
        id="RPT-0001", category="pest", crop="rice", growth_stage=None, description="Hoppers.", latitude=24.665,
        longitude=93.80, location_source="map_pin", district="Bishnupur", h3_cell="x", zone_id=zone,
        reporter_id="farmer-bishnupur", reporter_name="Farmer", submitted_at=datetime.now(timezone.utc).isoformat()))
    down.invalidate()
    down.refresh_thread.join(timeout=10)
    after = down.snapshot().assessment(zone)
    assert after.score > before.score, "the report moves the score although NDVI is not live"
    assert factor(after, "report_pressure").score > 0 and any("RPT-0001" in r for r in after.reasons)
    assert {p.state for p in factor(after, "ndvi_anomaly").provenance} == {"SNAPSHOT"}


def test_a_partly_filled_assessment_is_never_frozen_as_a_new_snapshot(tmp_path):
    service(tmp_path).save_snapshot()
    with pytest.raises(AgriUnavailable, match="not live"):
        service(tmp_path, ndvi=NdviClient(None)).save_snapshot()


def test_without_a_snapshot_incomplete_live_data_is_shown_honestly(tmp_path):
    down = service(tmp_path, ndvi=NdviClient(None)).snapshot()
    assert down.mode == "live" and all(a.confidence.data_completeness < 1 for a in down.assessments)


def test_snapshot_mode_without_a_file_is_a_clear_error(tmp_path):
    response = TestClient(create_app(agri_service=service(tmp_path, mode="snapshot"))).get("/api/agri/overview")
    assert response.status_code == 503 and "no usable snapshot" in response.json()["message"]


def test_a_snapshot_is_never_refrozen_as_if_it_were_live(tmp_path):
    service(tmp_path).save_snapshot()
    with pytest.raises(AgriUnavailable, match="refusing to re-freeze"):
        service(tmp_path, mode="snapshot").save_snapshot()


def test_warm_up_computes_the_assessment_off_the_request_path(tmp_path):
    warm = service(tmp_path)
    warm.warm_in_background().join(timeout=30)
    assert warm._snapshot is not None and len(warm._snapshot.assessments) == 7


def test_sample_reports_do_not_reshuffle_from_day_to_day():
    zone = area("demo-bishnupur-nambol")
    today, tomorrow = generate([zone], TODAY).reports, generate([zone], TODAY + timedelta(days=1)).reports

    def shape(reports, end):
        return [(r.pest, r.severity, r.latitude, r.longitude, (end - date.fromisoformat(r.observed_on)).days)
                for r in reports]

    assert shape(today, TODAY) == shape(tomorrow, TODAY + timedelta(days=1)), "same reports, dates relative"
    assert all(r.source == "SAMPLE" and r.synthetic for r in today + tomorrow)
