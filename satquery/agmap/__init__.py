"""Agricultural map: where the farmland is, which crops it holds (SAMPLE), and what is happening there.

The statewide display grid is H3 resolution 7 (about 5.2 km² a cell, about 4,000 cells over Manipur):
coarse enough to draw the whole state at once, fine enough to separate valley paddy from hill forest.
Analysis stays where it was: the risk engine scores monitored zones, and reports and tasks are located
by resolution-8 cells (`satquery.grid`). This module only joins them onto display cells.

Each input keeps its own status and is never merged with another into one figure:
- Land cover, SOURCED: ESA WorldCover 2021 class shares per cell (`assets/landcover_r7.json`, built
  offline by scripts/build_map_assets.py). The cropland share says where farmland is.
- Crop types, SAMPLE: which crops a cell's farmland holds. No crop-type map or district crop statistics
  are loaded yet, so the shares come from an illustrative generator (`assets/crop_pattern_sample.json`)
  and carry the SAMPLE label wherever they appear. Real data would replace `crop_mix` alone.
- Risk, from the engine: a cell whose centre lies in a monitored zone shows that zone's assessment. The
  cell is not scored itself, and a cell outside every zone is not monitored, which is not "no risk".
- District outlines: verified boundaries when configured (`SATQUERY_AGRI_DISTRICTS`), otherwise the
  shipped OpenStreetMap reference outlines.

  GET /api/map/layers          display cells, district outlines and what each layer is built from (public)
  GET /api/map/cells/{cell}    one cell: land cover, SAMPLE crop mix, its zone's assessment, the zone's
                               alerts, and the reports and inspections this account may see
"""

import json
import math
import random
from functools import lru_cache
from pathlib import Path
from typing import Literal

import h3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from satquery import geo
from satquery.agri import districts as agri_districts
from satquery.agri.areas import load_areas
from satquery.agri.config import ASSETS as AGRI_ASSETS
from satquery.agri.models import MonitoredArea
from satquery.agri.routes import AreaSummary, summarise
from satquery.agri.service import AgriUnavailable, AssessmentService
from satquery.ops.models import DemoUser, FarmerReport, InspectionTask
from satquery.ops.service import OpsService
from satquery.ops.users import optional_user
from satquery.watch.alerts import Alert

ASSETS = Path(__file__).resolve().parent / "assets"
LANDCOVER_FILE = ASSETS / "landcover_r7.json"
PATTERN_FILE = ASSETS / "crop_pattern_sample.json"
OSM_DISTRICTS_FILE = AGRI_ASSETS / "manipur_districts_osm.geojson"

RESOLUTION = 7
# A cell is drawn as farmland from this WorldCover cropland share up: 5% of a cell is about 26 ha.
MIN_CROPLAND = 0.05
LANDCOVER_LABEL = {"tree": "Tree cover", "shrub": "Shrubland", "grass": "Grassland", "crop": "Cropland",
                   "built": "Built-up", "bare": "Bare or sparse vegetation", "water": "Permanent water",
                   "wetland": "Herbaceous wetland", "other": "Other"}

SourceStatus = Literal["SOURCED", "SAMPLE", "VERIFIED", "REFERENCE"]


class LayerSource(BaseModel):
    name: str
    status: SourceStatus
    licence: str | None
    attribution: str
    note: str
    limitations: list[str]


class CropLegendEntry(BaseModel):
    id: str
    label: str
    examples: str


class DistrictEntry(BaseModel):
    name: str
    bounds: tuple[float, float, float, float]
    label_point: tuple[float, float]  # longitude, latitude of a point inside the outline
    cell_count: int
    farmland_cell_count: int


class AgMap(BaseModel):
    resolution: int
    mean_cell_area_km2: float
    cell_count: int
    farmland_cell_count: int
    min_cropland: float
    # GeoJSON FeatureCollection. Properties: cell, district, cropland (0-1 or null), dominant (crop id or
    # null), zone (monitored zone id or null), and p_<crop> for each crop's SAMPLE share of the farmland.
    cells: dict
    districts: dict  # GeoJSON FeatureCollection of outlines; properties: name
    district_list: list[DistrictEntry]
    crop_legend: list[CropLegendEntry]
    landcover: LayerSource
    crops: LayerSource
    boundaries: LayerSource
    notes: list[str]


class CropShare(BaseModel):
    crop: str
    share: float  # of the cell's farmland, 0-1


class LandCoverShare(BaseModel):
    cover: str
    label: str
    share: float  # of the cell, 0-1


class CellDetail(BaseModel):
    cell: str
    resolution: int
    center: tuple[float, float]  # longitude, latitude
    boundary: dict  # GeoJSON Polygon
    area_km2: float
    district: str | None
    landcover: list[LandCoverShare]  # largest first; empty when WorldCover has no data for the cell
    cropland: float | None
    is_farmland: bool
    crop_mix: list[CropShare]  # SAMPLE; empty when the cell is not farmland
    dominant: str | None
    zone: AreaSummary | None
    zone_note: str
    alerts: list[Alert]
    reports: list[FarmerReport]
    tasks: list[InspectionTask]  # located in the cell, or raised from one of its zone's alerts
    # False when this account may not list them at all, which is different from "none here".
    reports_visible: bool
    tasks_visible: bool
    notes: list[str]


# ----------------------------------------------------------------------------- data

@lru_cache(maxsize=1)
def load_landcover() -> dict:
    return json.loads(LANDCOVER_FILE.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_pattern() -> dict:
    pattern = json.loads(PATTERN_FILE.read_text(encoding="utf-8"))
    if pattern.get("status") != "SAMPLE":
        raise ValueError("crop_pattern_sample.json must stay labelled SAMPLE: it is synthetic")
    return pattern


def landcover_shares(cell: str) -> dict[str, float] | None:
    """WorldCover class shares (0-1) of a cell, or None when the cell is outside the asset."""
    data = load_landcover()
    row = data["cells"].get(cell)
    if row is None or row[1] is None:
        return None
    return {key: value / 100 for key, value in zip(data["fields"][1:], row[1:])}


def _field(crop: str, latitude: float, longitude: float, seed: int) -> float:
    """Smooth pseudo-random field in [-1, 1] with features 15-50 km across, so SAMPLE crops form patches
    rather than salt-and-pepper noise. Deterministic per crop and seed."""
    rng = random.Random(f"{seed}:{crop}")
    waves = [(rng.uniform(12, 40), rng.uniform(0, math.tau), rng.uniform(0, math.tau)) for _ in range(3)]
    return sum(math.sin(k * (longitude * math.cos(a) + latitude * math.sin(a)) + phase)
               for k, a, phase in waves) / len(waves)


def crop_mix(cell: str, district: str | None) -> list[CropShare]:
    """SAMPLE crop shares of a cell's farmland, largest first. Synthetic: see the pattern file's note."""
    pattern = load_pattern()
    profile = pattern["profiles"]["valley" if district in pattern["valley_districts"] else "hill"]
    latitude, longitude = h3.cell_to_latlng(cell)
    weights = {crop: base * math.exp(pattern["variation"] * _field(crop, latitude, longitude, pattern["seed"]))
               for crop, base in profile.items()}
    total = sum(weights.values())
    kept = {crop: w / total for crop, w in weights.items() if w / total >= pattern["min_share"]}
    kept_total = sum(kept.values())
    shares = [CropShare(crop=crop, share=round(w / kept_total, 2)) for crop, w in kept.items()]
    return sorted(shares, key=lambda s: -s.share)


def dominant_crop(mix: list[CropShare]) -> str | None:
    if not mix:
        return None
    return mix[0].crop if mix[0].share >= load_pattern()["mixed_below"] else "mixed"


def cell_polygon(cell: str) -> dict:
    ring = [[round(lng, 5), round(lat, 5)] for lat, lng in h3.cell_to_boundary(cell)]
    return {"type": "Polygon", "coordinates": [ring + [ring[0]]]}


@lru_cache(maxsize=1)
def _base_cells() -> tuple[dict, ...]:
    """Every display cell's static part (geometry, land cover, SAMPLE crops), computed once."""
    data = load_landcover()
    features = []
    for cell, row in data["cells"].items():
        district = row[0]
        cover = landcover_shares(cell)
        cropland = cover["crop"] if cover else None
        mix = crop_mix(cell, district) if cropland is not None and cropland >= MIN_CROPLAND else []
        properties = {"cell": cell, "district": district, "cropland": cropland, "dominant": dominant_crop(mix)}
        properties.update({f"p_{s.crop}": s.share for s in mix})
        features.append({"type": "Feature", "properties": properties, "geometry": cell_polygon(cell)})
    return tuple(features)


def zone_cells(areas: list[MonitoredArea]) -> dict[str, str]:
    """Display cell -> the monitored zone holding the cell's centre (the first zone, if zones overlap)."""
    out: dict[str, str] = {}
    for area in areas:
        for cell in h3.geo_to_cells(area.geometry, RESOLUTION):
            out.setdefault(cell, area.id)
    return out


def boundaries() -> tuple[list[MonitoredArea], LayerSource]:
    """Verified district outlines when configured, else the shipped OpenStreetMap reference outlines."""
    verified = list(agri_districts.load_boundaries().values())
    if verified:
        return verified, LayerSource(
            name=verified[0].boundary_source, status="VERIFIED", licence=None, attribution=verified[0].boundary_source,
            note="Verified district boundaries configured on this server (SATQUERY_AGRI_DISTRICTS).",
            limitations=["Map context only: districts are never scored."])
    outlines = [a for a in load_areas(OSM_DISTRICTS_FILE) if a.kind == "district"]
    return outlines, LayerSource(
        name="OpenStreetMap district outlines (admin_level 5)", status="REFERENCE", licence="ODbL 1.0",
        attribution="© OpenStreetMap contributors",
        note="Reference outlines for orientation, simplified to about 30 m. Not a verified or legal boundary.",
        limitations=["Map context only: districts are never scored.",
                     "OpenStreetMap is community-maintained; boundaries may differ from official records."])


LANDCOVER_SOURCE = LayerSource(
    name="ESA WorldCover 10 m 2021 v200", status="SOURCED", licence="CC BY 4.0",
    attribution="© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by "
                "ESA WorldCover consortium",
    note=f"Share of each 10 m land-cover class inside every cell. A cell is drawn as farmland from "
         f"{MIN_CROPLAND:.0%} cropland up; the colour's strength follows the cropland share.",
    limitations=["A 2021 classification: it does not show this season's planting.",
                 "Shifting cultivation (jhum) in the hills is often classed as shrubland or grassland, so hill "
                 "farmland is under-counted.",
                 "Wet valley paddy can be classed as herbaceous wetland."])


def crops_source() -> LayerSource:
    pattern = load_pattern()
    return LayerSource(name="SAMPLE crop pattern (illustrative)", status="SAMPLE", licence=None,
                       attribution="Synthetic, generated by LouNgak AI", note=pattern["note"],
                       limitations=[f"To replace it: {pattern['replace_with']}"])


# ----------------------------------------------------------------------------- views

def map_layers(areas: list[MonitoredArea]) -> AgMap:
    zones = zone_cells(areas)
    features = []
    for base in _base_cells():
        feature = dict(base)
        feature["properties"] = {**base["properties"], "zone": zones.get(base["properties"]["cell"])}
        features.append(feature)
    known = {f["properties"]["cell"] for f in features}
    for cell, zone in zones.items():  # a configured zone outside Manipur still shows its risk
        if cell not in known:
            features.append({"type": "Feature", "geometry": cell_polygon(cell), "properties": {
                "cell": cell, "district": None, "cropland": None, "dominant": None, "zone": zone}})

    outlines, boundary_source = boundaries()
    farmland = [f for f in features if (f["properties"]["cropland"] or 0) >= MIN_CROPLAND]
    district_list = []
    for outline in sorted(outlines, key=lambda a: a.name):
        name = outline.district or outline.name
        inside = [f for f in features if f["properties"]["district"] == name]
        district_list.append(DistrictEntry(
            name=name, bounds=geo.geometry_bounds(outline.geometry),
            label_point=tuple(round(v, 5) for v in geo.representative_point(outline.geometry)),
            cell_count=len(inside),
            farmland_cell_count=sum(1 for f in inside if (f["properties"]["cropland"] or 0) >= MIN_CROPLAND)))
    pattern = load_pattern()
    return AgMap(
        resolution=RESOLUTION, mean_cell_area_km2=round(h3.average_hexagon_area(RESOLUTION, "km^2"), 2),
        cell_count=len(features), farmland_cell_count=len(farmland), min_cropland=MIN_CROPLAND,
        cells={"type": "FeatureCollection", "features": features},
        districts={"type": "FeatureCollection", "features": [
            {"type": "Feature", "geometry": a.geometry, "properties": {"name": a.district or a.name}} for a in outlines]},
        district_list=district_list,
        crop_legend=[CropLegendEntry(**c) for c in pattern["crops"]],
        landcover=LANDCOVER_SOURCE, crops=crops_source(), boundaries=boundary_source,
        notes=[f"H3 resolution {RESOLUTION} display cells (about {h3.average_hexagon_area(RESOLUTION, 'km^2'):.1f} km² "
               "each). A cell is a map unit, not a farm or a village.",
               "Risk is scored per monitored zone; a cell shows the level of the zone holding its centre. Cells "
               "outside every zone are not monitored, which is not the same as no risk."])


def cell_detail(cell: str, user: DemoUser | None, agri: AssessmentService, ops: OpsService) -> CellDetail:
    if not h3.is_valid_cell(cell) or h3.get_resolution(cell) != RESOLUTION:
        raise HTTPException(status_code=404, detail=f"'{cell}' is not an H3 resolution-{RESOLUTION} cell.")
    latitude, longitude = h3.cell_to_latlng(cell)
    row = load_landcover()["cells"].get(cell)
    district = row[0] if row else None
    cover = landcover_shares(cell)
    cropland = cover["crop"] if cover else None
    is_farmland = cropland is not None and cropland >= MIN_CROPLAND
    mix = crop_mix(cell, district) if is_farmland else []
    notes = [LANDCOVER_SOURCE.note]
    if is_farmland:
        notes.append("Crop types and shares are SAMPLE (synthetic, illustrative): no crop-type data is loaded yet.")

    zone, zone_note, alerts = None, "Not inside a monitored zone: no risk assessment covers this cell.", []
    zone_id = zone_cells(agri.areas()).get(cell)
    if zone_id:
        try:
            snapshot = agri.snapshot()
            assessment = next((a for a in snapshot.assessments if a.area_id == zone_id), None)
            if assessment is not None:
                zone = summarise(snapshot.areas[zone_id], assessment)
                zone_note = (f"This cell lies in the monitored zone '{zone.name}'. The level shown is the zone's, "
                             "scored for the whole zone; the cell is not scored on its own.")
            alerts = [a for a in ops.alerts()[0] if a.zone_id == zone_id]
        except AgriUnavailable as error:
            zone_note = f"The risk assessment is unavailable: {error}"

    alert_ids = {a.id for a in alerts}

    def located(user_may_list, also=lambda record: False):
        if user is None:
            return [], False
        try:
            return [i for i in user_may_list(user) if h3.cell_to_parent(i.h3_cell, RESOLUTION) == cell or also(i)], True
        except HTTPException:  # this role does not list these records at all
            return [], False

    reports, reports_visible = located(ops.reports_for)
    # An inspection raised from one of this cell's zone alerts stands at the alert's point, which may be in
    # a neighbouring cell; it is listed wherever the alert is.
    tasks, tasks_visible = located(ops.tasks_for, lambda t: bool(alert_ids & set(t.alert_ids)))
    labels = LANDCOVER_LABEL
    return CellDetail(
        cell=cell, resolution=RESOLUTION, center=(round(longitude, 5), round(latitude, 5)),
        boundary=cell_polygon(cell), area_km2=round(h3.cell_area(cell, "km^2"), 2), district=district,
        landcover=sorted((LandCoverShare(cover=k, label=labels[k], share=v) for k, v in (cover or {}).items() if v > 0),
                         key=lambda s: -s.share),
        cropland=cropland, is_farmland=is_farmland, crop_mix=mix, dominant=dominant_crop(mix),
        zone=zone, zone_note=zone_note, alerts=alerts, reports=reports, tasks=tasks,
        reports_visible=reports_visible, tasks_visible=tasks_visible, notes=notes)


def agmap_router(agri: AssessmentService, ops: OpsService) -> APIRouter:
    router = APIRouter(prefix="/api/map", tags=["agricultural map"])

    @router.get("/layers", response_model=AgMap)
    def layers():
        return map_layers(agri.areas())

    @router.get("/cells/{cell}", response_model=CellDetail)
    def cell(cell: str, user: DemoUser | None = Depends(optional_user)):
        return cell_detail(cell, user, agri, ops)

    return router
