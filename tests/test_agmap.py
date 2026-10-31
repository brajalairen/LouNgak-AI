"""The agricultural map: shipped data assets, the statewide cell layer and one cell's detail, including who
may see which records there. No network: both assets are files in the package."""

import json

import h3
import pytest
from fastapi.testclient import TestClient

from agri_helpers import FakeWeather
from satquery import agmap, geo
from satquery.agri import districts as agri_districts
from satquery.agri.areas import contains, demo_areas, load_areas
from satquery.agri.pipeline import Sources
from satquery.agri.reports import SampleReportSource
from satquery.agri.service import AssessmentService
from satquery.ops import seed
from satquery.server import create_app
from satquery.settings import Settings
from satquery.store import Store

BISHNUPUR_POINT = {"latitude": 24.665, "longitude": 93.80}  # inside demo-bishnupur-nambol
BISHNUPUR_CELL = h3.latlng_to_cell(BISHNUPUR_POINT["latitude"], BISHNUPUR_POINT["longitude"], agmap.RESOLUTION)
UKHRUL_FOREST = h3.latlng_to_cell(25.30, 94.55, agmap.RESOLUTION)  # far from every zone, hill forest


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


# ------------------------------------------------------------------------------- shipped assets

def test_the_osm_outlines_cover_the_16_listed_districts_and_hold_their_zones():
    outlines = load_areas(agmap.OSM_DISTRICTS_FILE)
    listed = {d["name"] for d in agri_districts.load_names()["districts"]}
    assert {a.name for a in outlines} == listed and all(a.kind == "district" for a in outlines)
    assert all("OpenStreetMap" in a.boundary_source and "not a verified boundary" in a.boundary_source for a in outlines)
    assert "ODbL" in json.loads(agmap.OSM_DISTRICTS_FILE.read_text(encoding="utf-8"))["attribution"]
    by_name = {a.name: a for a in outlines}
    for zone in demo_areas():
        assert contains(by_name[zone.district].geometry, *geo.representative_point(zone.geometry)), zone.id


def test_landcover_shares_are_whole_percentages_of_resolution_7_cells_in_named_districts():
    data = agmap.load_landcover()
    listed = {d["name"] for d in agri_districts.load_names()["districts"]}
    assert data["licence"] == "CC BY 4.0" and data["fields"][0] == "district" and len(data["cells"]) > 3000
    for cell, row in data["cells"].items():
        assert h3.get_resolution(cell) == agmap.RESOLUTION and row[0] in listed
        assert abs(sum(row[1:]) - 100) <= len(row), "shares of one cell add up to 100%, give or take rounding"


def test_the_crop_pattern_must_stay_labelled_sample(tmp_path, monkeypatch):
    relabelled = json.loads(agmap.PATTERN_FILE.read_text(encoding="utf-8")) | {"status": "VERIFIED"}
    path = tmp_path / "pattern.json"
    path.write_text(json.dumps(relabelled), encoding="utf-8")
    monkeypatch.setattr(agmap, "PATTERN_FILE", path)
    with pytest.raises(ValueError, match="SAMPLE"):
        agmap.load_pattern.__wrapped__()


def test_sample_crop_mixes_are_deterministic_shares_largest_first():
    mix = agmap.crop_mix(BISHNUPUR_CELL, "Bishnupur")
    assert mix == agmap.crop_mix(BISHNUPUR_CELL, "Bishnupur")
    assert abs(sum(s.share for s in mix) - 1) < 0.03
    assert [s.share for s in mix] == sorted((s.share for s in mix), reverse=True)
    assert agmap.dominant_crop([agmap.CropShare(crop="rice", share=0.3), agmap.CropShare(crop="maize", share=0.3)]) == "mixed"
    assert agmap.dominant_crop([]) is None


# ------------------------------------------------------------------------------- the layer

def test_the_layer_draws_farmland_from_worldcover_and_labels_crop_types_sample(client):
    body = client.get("/api/map/layers").json()
    cells = body["cells"]["features"]
    assert body["resolution"] == 7 and body["cell_count"] == len(cells)
    farmland = [c for c in cells if (c["properties"]["cropland"] or 0) >= body["min_cropland"]]
    assert body["farmland_cell_count"] == len(farmland) > 500
    assert all(c["properties"]["dominant"] for c in farmland)
    assert not any(c["properties"]["dominant"] for c in cells if c not in farmland), "no crop where there is no farmland"
    assert body["landcover"]["status"] == "SOURCED" and body["landcover"]["licence"] == "CC BY 4.0"
    assert body["crops"]["status"] == "SAMPLE" and "SYNTHETIC" in body["crops"]["note"]
    assert {e["id"] for e in body["crop_legend"]} >= {"rice", "maize", "chakhao", "mixed"}


def test_cells_carry_their_zone_but_never_a_risk_figure_of_their_own(client):
    cells = client.get("/api/map/layers").json()["cells"]["features"]
    zoned = {}
    for c in cells:
        if c["properties"]["zone"]:
            zoned.setdefault(c["properties"]["zone"], []).append(c["properties"]["cell"])
    assert set(zoned) == {a.id for a in demo_areas()}
    assert BISHNUPUR_CELL in zoned["demo-bishnupur-nambol"]
    assert not any(key in c["properties"] for c in cells for key in ("level", "score", "rank"))


def test_district_outlines_are_osm_reference_unless_verified_ones_are_configured(client, tmp_path, monkeypatch):
    body = client.get("/api/map/layers").json()
    assert body["boundaries"]["status"] == "REFERENCE" and body["boundaries"]["licence"] == "ODbL 1.0"
    assert len(body["districts"]["features"]) == len(body["district_list"]) == 16
    bishnupur = next(d for d in body["district_list"] if d["name"] == "Bishnupur")
    assert bishnupur["farmland_cell_count"] > 0 and bishnupur["cell_count"] >= bishnupur["farmland_cell_count"]

    verified = tmp_path / "districts.geojson"
    verified.write_text(json.dumps({"type": "FeatureCollection", "features": [{
        "type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[93.7, 24.6], [93.9, 24.6], [93.9, 24.75],
                                                                          [93.7, 24.75], [93.7, 24.6]]]},
        "properties": {"id": "mn-bishnupur", "name": "Bishnupur", "kind": "district", "district": "Bishnupur",
                       "boundary_source": "Test boundaries v1"}}]}), encoding="utf-8")
    monkeypatch.setenv("SATQUERY_AGRI_DISTRICTS", str(verified))
    body = client.get("/api/map/layers").json()
    assert body["boundaries"]["status"] == "VERIFIED" and body["boundaries"]["name"] == "Test boundaries v1"
    assert [d["name"] for d in body["district_list"]] == ["Bishnupur"]


def test_the_layer_is_compressed_on_the_wire(client):
    response = client.get("/api/map/layers", headers={"Accept-Encoding": "gzip"})
    assert response.headers["content-encoding"] == "gzip"


# ------------------------------------------------------------------------------- one cell

def test_a_zone_cell_shows_the_zones_assessment_and_alerts_as_the_zones_own(client):
    body = client.get(f"/api/map/cells/{BISHNUPUR_CELL}").json()
    assert body["district"] == "Bishnupur" and body["is_farmland"] and body["crop_mix"]
    assert body["zone"]["id"] == "demo-bishnupur-nambol" and "not scored on its own" in body["zone_note"]
    assert all(a["zone_id"] == "demo-bishnupur-nambol" for a in body["alerts"])
    assert body["landcover"][0]["share"] >= body["landcover"][-1]["share"]
    assert any("SAMPLE" in note for note in body["notes"])
    assert body["boundary"]["type"] == "Polygon" and body["area_km2"] > 4


def test_a_cell_outside_every_zone_is_not_monitored_and_forest_has_no_crops(client):
    body = client.get(f"/api/map/cells/{UKHRUL_FOREST}").json()
    assert body["zone"] is None and body["alerts"] == [] and "Not inside a monitored zone" in body["zone_note"]
    assert body["landcover"][0]["cover"] == "tree" and not body["is_farmland"] and body["crop_mix"] == []
    assert body["dominant"] is None


@pytest.mark.parametrize("cell", ["not-a-cell", h3.latlng_to_cell(24.665, 93.80, 8)])
def test_only_display_cells_are_accepted(client, cell):
    assert client.get(f"/api/map/cells/{cell}").status_code == 404


def test_reports_and_inspections_in_a_cell_follow_each_accounts_permissions(client):
    body = {"category": "waterlogging", "crop": "rice", "growth_stage": "harvest", "description": "Water standing.",
            "location_source": "map_pin", "district": "Bishnupur", "consent": True, **BISHNUPUR_POINT}
    report = client.post("/api/ops/reports", json=body, headers=as_("farmer-bishnupur")).json()
    client.post(f"/api/ops/reports/{report['id']}/review", headers=as_("district-bishnupur"),
                json={"action": "note", "note": "Internal: check drainage."})
    task = client.post("/api/ops/tasks", headers=as_("district-bishnupur"), json={
        "report_ids": [report["id"]], "reason": "Check waterlogging.", "priority": "high",
        "assigned_to": "field-bishnupur"}).json()
    url = f"/api/map/cells/{BISHNUPUR_CELL}"

    public = client.get(url).json()
    assert public["reports"] == [] and public["tasks"] == [] and not public["reports_visible"] and not public["tasks_visible"]
    farmer = client.get(url, headers=as_("farmer-bishnupur")).json()
    assert [r["id"] for r in farmer["reports"]] == [report["id"]] and farmer["reports"][0]["officer_notes"] == []
    assert not farmer["tasks_visible"]
    assert client.get(url, headers=as_("farmer-thoubal")).json()["reports"] == [], "never another farmer's report"
    officer = client.get(url, headers=as_("district-bishnupur")).json()
    assert [t["id"] for t in officer["tasks"]] == [task["id"]] and officer["reports"][0]["officer_notes"]
    assert client.get(url, headers=as_("district-thoubal")).json()["reports"] == [], "outside the jurisdiction"
    field = client.get(url, headers=as_("field-bishnupur")).json()
    assert not field["reports_visible"] and [t["id"] for t in field["tasks"]] == [task["id"]]



def test_an_inspection_raised_from_a_zone_alert_is_listed_wherever_that_alert_is(client):
    seed.seed(client.store)  # adds the labelled DEMO heavy-rain alert for the Bishnupur zone
    officer = as_("district-bishnupur")
    alert = next(a for a in client.get("/api/watch/alerts").json()["alerts"] if a["is_demo"])
    task = client.post("/api/ops/tasks", headers=officer, json={
        "alert_ids": [alert["id"]], "reason": "Check after the forecast rain.", "priority": "moderate"}).json()
    anchor = h3.cell_to_parent(task["h3_cell"], agmap.RESOLUTION)
    other = next(c for c, z in agmap.zone_cells(demo_areas()).items() if z == alert["zone_id"] and c != anchor)
    assert task["id"] in [t["id"] for t in client.get(f"/api/map/cells/{other}", headers=officer).json()["tasks"]]
    assert client.get(f"/api/map/cells/{UKHRUL_FOREST}", headers=officer).json()["tasks"] == []
