"""H3 hexagonal grid: the standard cells that reports, inspections and alerts are located by.

Resolution 8 (average cell about 0.74 km², edge about 0.5 km) is the analysis resolution inside the
monitored zones: fine enough to separate neighbouring farmland, coarse enough that each cell holds
thousands of 10 m Sentinel-2 pixels. A cell is an indexing unit. It is not a farm or a village, and a
zone's assessment is never copied onto its cells: alerts name the zone they were computed for and list
the zone's cells only as its footprint.

  GET /api/grid/zones    every monitored zone's cells as GeoJSON polygons
"""

import h3
from fastapi import APIRouter
from pydantic import BaseModel

from satquery.agri.areas import contains
from satquery.agri.models import MonitoredArea

RESOLUTION = 8
NOTE = (f"H3 resolution {RESOLUTION} cells (about {h3.average_hexagon_area(RESOLUTION, 'km^2'):.2f} km² each) "
        "covering the monitored zones. Cells index locations; they are not farms or villages, and a zone's risk "
        "assessment is not a per-cell measurement.")


def cell_for(latitude: float, longitude: float, resolution: int = RESOLUTION) -> str:
    return h3.latlng_to_cell(latitude, longitude, resolution)


def cells_for(geometry: dict, resolution: int = RESOLUTION) -> list[str]:
    """Cells whose centres fall inside a GeoJSON Polygon or MultiPolygon."""
    return sorted(h3.geo_to_cells(geometry, resolution))


def cell_polygon(cell: str) -> dict:
    ring = [[round(lng, 6), round(lat, 6)] for lat, lng in h3.cell_to_boundary(cell)]
    return {"type": "Polygon", "coordinates": [ring + [ring[0]]]}


def zone_for(latitude: float, longitude: float, areas: list[MonitoredArea]) -> MonitoredArea | None:
    return next((a for a in areas if contains(a.geometry, longitude, latitude)), None)


class GridZones(BaseModel):
    resolution: int
    mean_cell_area_km2: float
    cell_count: int
    note: str
    cells: dict  # GeoJSON FeatureCollection; properties: cell, zone_id, zone_name, district


def zone_cells(areas: list[MonitoredArea]) -> GridZones:
    features = [{"type": "Feature", "id": cell,
                 "properties": {"cell": cell, "zone_id": a.id, "zone_name": a.name, "district": a.district},
                 "geometry": cell_polygon(cell)}
                for a in areas for cell in cells_for(a.geometry)]
    return GridZones(resolution=RESOLUTION, mean_cell_area_km2=round(h3.average_hexagon_area(RESOLUTION, "km^2"), 3),
                     cell_count=len(features), note=NOTE, cells={"type": "FeatureCollection", "features": features})


def grid_router(areas) -> APIRouter:
    """`areas` returns the monitored areas (the risk service's), so the grid follows the configured zones."""
    router = APIRouter(prefix="/api/grid", tags=["grid"])

    @router.get("/zones", response_model=GridZones)
    def get_zones():
        return zone_cells(areas())

    return router
