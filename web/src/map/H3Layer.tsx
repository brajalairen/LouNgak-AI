/** The H3 monitoring grid: resolution-8 cells over the monitored zones, drawn as thin outlines once the
 *  map is zoomed in far enough to read them. Cells index locations; they carry no risk value of their
 *  own (the zone's level stays on the zone). Re-added after every style load, like the other layers. */

import { useEffect, useState } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { api } from "../state/api";
import type { GridZones } from "../state/types";
import { useAgriStore } from "../agri/useAgriStore";
import { useAppStore } from "../state/useAppStore";
import { useMap, useMapReady } from "./MapView";

const SOURCE = "h3-cells";
const LINE = "h3-cells-line";
const MIN_ZOOM = 9.5;

export function H3Layer() {
  const map = useMap();
  const styleReady = useMapReady();
  const visible = useAgriStore((s) => s.layers.cells);
  const darkBase = useAppStore((s) => s.theme === "dark" || s.basemap !== "standard");
  const [grid, setGrid] = useState<GridZones | null>(null);

  useEffect(() => {
    api.gridZones().then(setGrid).catch(() => setGrid(null));
  }, []);

  useEffect(() => {
    if (!map || !styleReady || !grid) return;
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(grid.cells);
    else {
      map.addSource(SOURCE, { type: "geojson", data: grid.cells });
      map.addLayer({
        id: LINE,
        type: "line",
        source: SOURCE,
        minzoom: MIN_ZOOM,
        paint: { "line-color": darkBase ? "#e5e7eb" : "#334155", "line-opacity": 0.45, "line-width": 0.8 },
      });
    }
    map.setPaintProperty(LINE, "line-color", darkBase ? "#e5e7eb" : "#334155");
    map.setLayoutProperty(LINE, "visibility", visible ? "visible" : "none");
  }, [map, styleReady, grid, visible, darkBase]);

  return null;
}
