"""H3 hexagonal grid: the standard cells that reports, inspections and alerts are located by.

Resolution 8 (average cell about 0.74 km², edge about 0.5 km) is the analysis resolution inside the
monitored zones: fine enough to separate neighbouring farmland, coarse enough that each cell holds
thousands of 10 m Sentinel-2 pixels. A cell is an indexing unit. It is not a farm or a village, and a
zone's assessment is never copied onto its cells. The map draws coarser resolution-7 display cells
(`satquery.agmap`); a record's resolution-8 cell rolls up to its display cell as its parent.
"""

import h3

from satquery.agri.areas import contains
from satquery.agri.models import MonitoredArea

RESOLUTION = 8


def cell_for(latitude: float, longitude: float, resolution: int = RESOLUTION) -> str:
    return h3.latlng_to_cell(latitude, longitude, resolution)


def zone_for(latitude: float, longitude: float, areas: list[MonitoredArea]) -> MonitoredArea | None:
    return next((a for a in areas if contains(a.geometry, longitude, latitude)), None)
