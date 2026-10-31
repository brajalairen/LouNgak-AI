/** The monitored zones on the map: each zone's exact outline and its priority rank. The zone's level is
 *  drawn on the cells it holds (agmap/AgLayers); this layer shows where the scored area really ends.
 *
 *  Demo zones are outlined dashed and official outlines solid, so a demo rectangle is never mistaken for
 *  a boundary. Rank chips open the zone's "Why is this area at risk?" drawer. Both follow the Risk
 *  overlay switch in the layers panel. Follows MapView's pattern: everything is re-added whenever a new
 *  style has loaded (a basemap switch drops runtime sources). */

import { useEffect } from "react";
import { Marker, type ExpressionSpecification, type GeoJSONSource } from "maplibre-gl";
import { useMap, useMapReady } from "../map/MapView";
import { areaFeatures } from "./format";
import { useAgriStore } from "./useAgriStore";
import { useAppStore } from "../state/useAppStore";
import { useMapStore } from "../agmap/useMapStore";

const SOURCE = "agri-areas";
const LINE_OFFICIAL = "agri-line-official";
const LINE_DEMO = "agri-line-demo";
/** Room for the floating panels when the map frames an area: toolbar above, command bar below. */
const PADDING = { top: 100, bottom: 150, left: 400, right: 80 };

export function RiskLayer() {
  const map = useMap();
  const styleReady = useMapReady();
  const overview = useAgriStore((s) => s.overview);
  const selectedId = useAgriStore((s) => s.selectedId);
  const highlightIds = useAgriStore((s) => s.highlightIds);
  const districtName = useAgriStore((s) => s.districtName);
  const select = useAgriStore((s) => s.select);
  const visible = useMapStore((s) => s.layers.risk);
  const outlines = useMapStore((s) => s.data?.district_list);
  // Outlines must stand out from the basemap: light over dark themes and satellite imagery.
  const darkBase = useAppStore((s) => s.theme === "dark" || s.basemap !== "standard");
  const outline = darkBase ? "#f3f4f6" : "#3b3b3b";

  // --- the zone outlines, re-added after every style load
  useEffect(() => {
    if (!map || !styleReady || !overview) return;
    // The open district's zones are emphasised alongside any answer's areas.
    const focus = overview.districts.find((d) => d.name === districtName)?.zone_ids ?? [];
    const data = areaFeatures(overview.areas, { selectedId, hoveredId: null, highlightIds: [...highlightIds, ...focus] });
    const color = ["case", ["any", ["get", "selected"], ["get", "highlighted"]], "#2563eb", outline] as ExpressionSpecification;
    const width = ["case", ["get", "selected"], 3.5, ["get", "highlighted"], 2.5, 1.25] as ExpressionSpecification;
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource(SOURCE, { type: "geojson", data });
      map.addLayer({ id: LINE_OFFICIAL, type: "line", source: SOURCE, filter: ["==", ["get", "official"], true], paint: {} });
      map.addLayer({
        id: LINE_DEMO, type: "line", source: SOURCE, filter: ["==", ["get", "official"], false],
        paint: { "line-dasharray": [3, 2] },
      });
    }
    for (const id of [LINE_OFFICIAL, LINE_DEMO]) {
      map.setPaintProperty(id, "line-color", color);
      map.setPaintProperty(id, "line-width", width);
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }, [map, styleReady, overview, selectedId, highlightIds, outline, districtName, visible]);

  // --- frame the district opened in the priority panel (its zones, else its outline on the map)
  useEffect(() => {
    if (!map || !overview || !districtName) return;
    const bounds = overview.districts.find((d) => d.name === districtName)?.bounds
      ?? outlines?.find((d) => d.name === districtName)?.bounds;
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    map.fitBounds([[west, south], [east, north]], { padding: PADDING, duration: 700, maxZoom: 11 });
  }, [map, overview, districtName, outlines]);

  // --- bring the selected area into view beside the drawer
  useEffect(() => {
    if (!map || !overview || !selectedId) return;
    const area = overview.areas.find((a) => a.id === selectedId);
    if (!area) return;
    const [west, south, east, north] = area.bounds;
    map.fitBounds([[west, south], [east, north]], { padding: { ...PADDING, left: 80, right: 480 }, duration: 700, maxZoom: 11 });
  }, [map, overview, selectedId]);

  // --- rank numbers: DOM markers, so they survive a basemap switch and need no map fonts
  useEffect(() => {
    if (!map || !overview || !visible) return;
    const markers = overview.areas
      .filter((area) => area.rank !== null)
      .map((area) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className =
          "rounded-full border border-line bg-surface px-1.5 py-px text-[11px] font-semibold text-ink shadow-[var(--shadow-sm)] tabular-nums";
        element.textContent = `#${area.rank}`;
        element.title = `Priority ${area.rank}: ${area.name}. Open why this zone is flagged.`;
        element.setAttribute("aria-label", `Priority ${area.rank}: ${area.name}`);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          select(area.id);
        });
        return new Marker({ element, anchor: "right", offset: [-6, 0] }).setLngLat(area.label_point).addTo(map);
      });
    return () => markers.forEach((marker) => marker.remove());
  }, [map, overview, select, visible]);

  return null;
}
