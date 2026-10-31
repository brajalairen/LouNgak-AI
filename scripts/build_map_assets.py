"""Build the agricultural map's two shipped data assets. Run once, offline; the app never calls these services.

  districts   OpenStreetMap district outlines for Manipur (admin_level 5, ODbL), simplified per shared
              way so neighbouring districts stay gap-free  ->  satquery/agri/assets/manipur_districts_osm.geojson
  landcover   ESA WorldCover 2021 (10 m, CC BY 4.0) class shares for every H3 resolution-7 cell whose
              centre lies in Manipur  ->  satquery/agmap/assets/landcover_r7.json

    .venv/Scripts/python scripts/build_map_assets.py districts
    .venv/Scripts/python scripts/build_map_assets.py landcover      # needs the districts asset

Both read public, keyless sources: the Overpass API and WorldCover's public S3 bucket (read as COGs
over HTTP by rasterio, so only the windows over Manipur are downloaded). See docs/geo/map-data-sources.md.
"""

import json
import math
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

import h3
import numpy as np

from satquery.agri.areas import contains

ROOT = Path(__file__).resolve().parents[1]
NAMES = ROOT / "satquery/agri/assets/manipur_district_names.json"
DISTRICTS_OUT = ROOT / "satquery/agri/assets/manipur_districts_osm.geojson"
LANDCOVER_OUT = ROOT / "satquery/agmap/assets/landcover_r7.json"

OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = """[out:json][timeout:180];
area["ISO3166-2"="IN-MN"]["admin_level"="4"]->.mn;
rel(area.mn)["boundary"="administrative"]["admin_level"="5"];
out geom;"""
# ~30 m at Manipur's latitude: invisible at district zoom, and it shrinks the outlines about tenfold.
TOLERANCE_DEG = 0.0003

RESOLUTION = 7
WORLDCOVER = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
# WorldCover class values, in the order the asset stores their shares. 70 (snow), 95 (mangroves) and
# 100 (moss) do not occur in Manipur and are folded into "other".
CLASSES = {"tree": 10, "shrub": 20, "grass": 30, "crop": 40, "built": 50, "bare": 60, "water": 80, "wetland": 90}
BLOCK = 12  # 12 x 12 pixels of 1/12000 degree = 0.001 degree (about 100 m): the unit assigned to a cell


# ----------------------------------------------------------------------------- districts

def douglas_peucker(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker on an open polyline, endpoints kept (iterative, so long ways cannot overflow)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        (x0, y0), (x1, y1) = points[first], points[last]
        dx, dy = x1 - x0, y1 - y0
        norm = math.hypot(dx, dy)
        worst, index = 0.0, None
        for i in range(first + 1, last):
            x, y = points[i]
            distance = abs(dy * (x - x0) - dx * (y - y0)) / norm if norm else math.hypot(x - x0, y - y0)
            if distance > worst:
                worst, index = distance, i
        if index is not None and worst > tolerance:
            keep[index] = True
            stack += [(first, index), (index, last)]
    return [p for p, k in zip(points, keep) if k]


def simplify_way(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """A closed way is split at its farthest point first: RDP needs two distinct endpoints."""
    if points[0] == points[-1] and len(points) > 3:
        far = max(range(len(points)), key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2)
        return douglas_peucker(points[: far + 1], TOLERANCE_DEG)[:-1] + douglas_peucker(points[far:], TOLERANCE_DEG)
    return douglas_peucker(points, TOLERANCE_DEG)


def assemble_rings(ways: list[list[tuple[float, float]]]) -> list[list[tuple[float, float]]]:
    """Chain ways end to end into closed rings (reversing a way where needed)."""
    pending = [list(w) for w in ways if len(w) >= 2]
    rings = []
    while pending:
        ring = pending.pop(0)
        while ring[0] != ring[-1]:
            for i, way in enumerate(pending):
                if way[0] == ring[-1]:
                    ring += way[1:]
                elif way[-1] == ring[-1]:
                    ring += way[-2::-1]
                else:
                    continue
                pending.pop(i)
                break
            else:
                raise ValueError(f"ring cannot be closed at {ring[-1]}")
        if len(set(ring)) >= 3:
            rings.append(ring)
    return rings


def signed_area(ring: list[tuple[float, float]]) -> float:
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:]))


def build_districts() -> None:
    names = json.loads(NAMES.read_text(encoding="utf-8"))
    by_wikidata = {d["wikidata"]: d["name"] for d in names["districts"]}
    request = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({"data": QUERY}).encode(),
                                     headers={"User-Agent": "LouNgak-AI map asset build (github.com/brajalairen/LouNgak-AI)"})
    with urllib.request.urlopen(request, timeout=240) as response:
        elements = json.load(response)["elements"]

    # Simplify each way once, by id: a border two districts share is then identical in both outlines.
    simplified: dict[int, list[tuple[float, float]]] = {}
    features = []
    for relation in elements:
        tags = relation.get("tags", {})
        name = by_wikidata.get(tags.get("wikidata", ""))
        if not name:
            continue  # a neighbouring state's district that touches Manipur
        outer, inner = [], []
        for member in relation["members"]:
            if member["type"] != "way" or "geometry" not in member:
                continue
            if member["ref"] not in simplified:
                points = [(round(p["lon"], 6), round(p["lat"], 6)) for p in member["geometry"]]
                simplified[member["ref"]] = simplify_way(points)
            (inner if member.get("role") == "inner" else outer).append(simplified[member["ref"]])
        polygons = []
        for ring in assemble_rings(outer):
            ring = ring if signed_area(ring) > 0 else ring[::-1]  # RFC 7946: outer rings counter-clockwise
            polygons.append([ring])
        for hole in assemble_rings(inner):
            hole = hole if signed_area(hole) < 0 else hole[::-1]
            host = next(p for p in polygons if contains({"type": "Polygon", "coordinates": [p[0]]}, *hole[0]))
            host.append(hole)
        coordinates = [[[[round(x, 5), round(y, 5)] for x, y in ring] for ring in polygon] for polygon in polygons]
        geometry = ({"type": "Polygon", "coordinates": coordinates[0]} if len(coordinates) == 1
                    else {"type": "MultiPolygon", "coordinates": coordinates})
        slug = re.sub(r"[^a-z]+", "-", name.lower()).strip("-")
        features.append({"type": "Feature", "geometry": geometry, "properties": {
            "id": f"mn-{slug}", "name": name, "district": name, "kind": "district", "state": "Manipur",
            "boundary_source": f"OpenStreetMap contributors (ODbL), admin_level 5, retrieved {date.today().isoformat()}; "
                               "simplified about 30 m; reference outline, not a verified boundary",
            "osm_relation": relation["id"], "wikidata": tags["wikidata"]}})

    missing = sorted(set(by_wikidata.values()) - {f["properties"]["name"] for f in features})
    if missing:
        raise SystemExit(f"OpenStreetMap returned no outline for: {', '.join(missing)}")
    features.sort(key=lambda f: f["properties"]["name"])
    vertices = sum(len(ring) for f in features for polygon in _polygons(f["geometry"]) for ring in polygon)
    DISTRICTS_OUT.write_text(json.dumps({
        "type": "FeatureCollection",
        "attribution": "© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)",
        "features": features}, separators=(",", ":")), encoding="utf-8")
    print(f"{len(features)} districts, {vertices} vertices, {DISTRICTS_OUT.stat().st_size // 1024} KB -> {DISTRICTS_OUT}")


def _polygons(geometry: dict) -> list:
    return [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]


# ----------------------------------------------------------------------------- landcover

def manipur_cells(districts: list[dict]) -> dict[str, str]:
    """Every resolution-7 cell whose centre lies in a district, with that district's name."""
    cells: dict[str, str] = {}
    for feature in districts:
        for cell in h3.geo_to_cells(feature["geometry"], RESOLUTION):
            cells.setdefault(cell, feature["properties"]["name"])
    return cells


def tiles_for(west: float, south: float, east: float, north: float) -> list[tuple[str, float, float]]:
    """WorldCover 3 x 3 degree tiles (name, west, north) covering the box."""
    out = []
    for lat0 in range(int(math.floor(south / 3) * 3), int(math.ceil(north / 3) * 3), 3):
        for lon0 in range(int(math.floor(west / 3) * 3), int(math.ceil(east / 3) * 3), 3):
            out.append((f"{'N' if lat0 >= 0 else 'S'}{abs(lat0):02d}{'E' if lon0 >= 0 else 'W'}{abs(lon0):03d}", lon0, lat0 + 3))
    return out


def build_landcover() -> None:
    import rasterio
    from rasterio.windows import Window

    districts = json.loads(DISTRICTS_OUT.read_text(encoding="utf-8"))["features"]
    cells = manipur_cells(districts)
    corners = [lnglat for cell in cells for lnglat in ((lng, lat) for lat, lng in h3.cell_to_boundary(cell))]
    west, south = min(c[0] for c in corners), min(c[1] for c in corners)
    east, north = max(c[0] for c in corners), max(c[1] for c in corners)
    print(f"{len(cells)} cells; reading WorldCover over {west:.3f},{south:.3f} to {east:.3f},{north:.3f}")

    values = list(CLASSES.values())
    counts: dict[str, np.ndarray] = defaultdict(lambda: np.zeros(len(values) + 1, dtype=np.int64))  # + other
    env = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
           "GDAL_HTTP_MULTIRANGE": "YES", "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES", "VSI_CACHE": "TRUE"}
    with rasterio.Env(**env):
        for tile, lon0, lat0 in tiles_for(west, south, east, north):
            with rasterio.open("/vsicurl/" + WORLDCOVER.format(tile=tile)) as src:
                step = src.transform.a  # 1/12000 degree
                # Window snapped to whole blocks, so every block is a full 0.001-degree square.
                col0 = max(0, int((west - lon0) / step) // BLOCK * BLOCK)
                col1 = min(src.width, -(-int((east - lon0) / step) // BLOCK) * BLOCK)
                row0 = max(0, int((lat0 - north) / step) // BLOCK * BLOCK)
                row1 = min(src.height, -(-int((lat0 - south) / step) // BLOCK) * BLOCK)
                if col1 <= col0 or row1 <= row0:
                    continue
                print(f"  {tile}: rows {row0}-{row1}, cols {col0}-{col1}")
                strip = BLOCK * 100
                for top in range(row0, row1, strip):
                    height = min(strip, row1 - top)
                    data = src.read(1, window=Window(col0, top, col1 - col0, height))
                    by, bx = height // BLOCK, (col1 - col0) // BLOCK
                    blocks = data[: by * BLOCK, : bx * BLOCK].reshape(by, BLOCK, bx, BLOCK)
                    per_class = [(blocks == v).sum(axis=(1, 3)) for v in values]
                    valid = (blocks != 0).sum(axis=(1, 3))
                    other = valid - sum(per_class)
                    stacked = np.stack(per_class + [other], axis=-1)
                    for j in range(by):
                        lat = lat0 - (top + (j + 0.5) * BLOCK) * step
                        for i in range(bx):
                            if not valid[j, i]:
                                continue
                            lon = lon0 + (col0 + (i + 0.5) * BLOCK) * step
                            cell = h3.latlng_to_cell(lat, lon, RESOLUTION)
                            if cell in cells:
                                counts[cell] += stacked[j, i]
                    print(f"    rows {top}-{top + height} done", end="\r")
                print()

    keys = list(CLASSES) + ["other"]
    shares = {}
    for cell in sorted(cells):
        total = counts[cell].sum() if cell in counts else 0
        # Whole percentages: the source is a 10 m classification, so finer shares would be false precision.
        shares[cell] = [cells[cell]] + ([int(round(100 * c / total)) for c in counts[cell]] if total else [None] * len(keys))
    crop = [s[1 + keys.index("crop")] for s in shares.values() if s[1] is not None]
    LANDCOVER_OUT.parent.mkdir(parents=True, exist_ok=True)
    LANDCOVER_OUT.write_text(json.dumps({
        "source": "ESA WorldCover 10 m 2021 v200",
        "url": "https://esa-worldcover.org",
        "licence": "CC BY 4.0",
        "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) "
                       "processed by ESA WorldCover consortium",
        "computed_on": date.today().isoformat(),
        "resolution": RESOLUTION,
        "method": "Share of WorldCover 10 m pixels of each class inside the cell, counted on 0.001-degree blocks "
                  "assigned to the cell holding the block centre. Cells are every resolution-7 cell whose centre lies "
                  "in an OpenStreetMap district outline; the district is the one containing the centre.",
        "fields": ["district"] + keys,
        "cells": shares}, separators=(",", ":")), encoding="utf-8")
    print(f"{len(shares)} cells; cropland share >= 5% in {sum(1 for c in crop if c >= 5)}, >= 20% in "
          f"{sum(1 for c in crop if c >= 20)}; {LANDCOVER_OUT.stat().st_size // 1024} KB -> {LANDCOVER_OUT}")


if __name__ == "__main__":
    commands = {"districts": build_districts, "landcover": build_landcover}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        raise SystemExit(__doc__)
    commands[sys.argv[1]]()
