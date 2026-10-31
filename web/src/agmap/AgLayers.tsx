/** The agricultural map's cell layers: statewide H3 resolution-7 cells, coloured by the SAMPLE dominant
 *  crop where ESA WorldCover finds farmland, with each monitored zone's engine level drawn on the cells
 *  it holds, the district outlines and names, and the selected cell.
 *
 *  Risk and crops never share a fill: with crops showing, risk is an outline in the level's colour; with
 *  crops hidden, it becomes a light fill. Cells outside every zone get no risk colour at all (not
 *  monitored, which is not "no risk"). A click anywhere on a cell, or on a marker in it, opens that cell.
 *  Like every layer, all of this is re-added after a style load (a basemap switch drops runtime sources). */

import { useEffect, useRef } from "react";
import { Marker, type GeoJSONSource, type MapLayerMouseEvent, type MapMouseEvent } from "maplibre-gl";
import { useMap, useMapReady } from "../map/MapView";
import { useAppStore } from "../state/useAppStore";
import { useAgriStore } from "../agri/useAgriStore";
import { cropFill, cropOpacity, farmlandFilter, zoneFilter, zoneLevelColor } from "./format";
import { useMapStore, type CellTab } from "./useMapStore";

const CELLS = "ag-cells";
const DISTRICTS = "ag-districts";
const CROP_FILL = "ag-crop-fill";
const CROP_EDGE = "ag-crop-edge";
const RISK_FILL = "ag-risk-fill";
const RISK_LINE = "ag-risk-line";
const HIT = "ag-hit";
const DISTRICT_LINE = "ag-district-line";
const HOVER = "ag-hover";
const SELECTED_CASING = "ag-selected-casing";
const SELECTED = "ag-selected";
/** Marker layers that open a cell on a different tab (see PinsLayer). */
export const PIN_TABS: Record<string, CellTab> = { "ag-pin-alerts": "alerts", "ag-pin-reports": "reports", "ag-pin-tasks": "inspections" };
/** Layers drawn above the cells, if present: the cells go beneath them whenever they are (re)added. */
const ABOVE = ["agri-line-official", "agri-line-demo", ...Object.keys(PIN_TABS), "aoi-fill"];
/** Room for the floating panels when framing: toolbar above, layers panel right, command bar below. */
const PADDING = { top: 90, bottom: 120, left: 80, right: 310 };

export function AgLayers() {
  const map = useMap();
  const styleReady = useMapReady();
  const data = useMapStore((s) => s.data);
  const load = useMapStore((s) => s.load);
  const layers = useMapStore((s) => s.layers);
  const district = useMapStore((s) => s.district);
  const crop = useMapStore((s) => s.crop);
  const cell = useMapStore((s) => s.cell);
  const view = useMapStore((s) => s.view);
  const selectCell = useMapStore((s) => s.selectCell);
  const closeCell = useMapStore((s) => s.closeCell);
  const areas = useAgriStore((s) => s.overview?.areas);
  const darkBase = useAppStore((s) => s.theme === "dark" || s.basemap !== "standard");
  const framed = useRef(false);
  const hovered = useRef<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // --- sources and layers, re-added after every style load
  useEffect(() => {
    if (!map || !styleReady || !data) return;
    if (map.getSource(CELLS)) return;
    const before = ABOVE.find((id) => map.getLayer(id));
    map.addSource(CELLS, { type: "geojson", data: data.cells, promoteId: "cell" });
    map.addSource(DISTRICTS, { type: "geojson", data: data.districts });
    map.addLayer({ id: CROP_FILL, type: "fill", source: CELLS, paint: {} }, before);
    map.addLayer({ id: CROP_EDGE, type: "line", source: CELLS, paint: { "line-width": 0.6, "line-opacity": 0.55 } }, before);
    map.addLayer({ id: RISK_FILL, type: "fill", source: CELLS, paint: {} }, before);
    map.addLayer({ id: RISK_LINE, type: "line", source: CELLS, paint: {} }, before);
    // Every cell, invisible: what a click lands on, whether or not the cell is drawn.
    map.addLayer({ id: HIT, type: "fill", source: CELLS, paint: { "fill-color": "#000", "fill-opacity": 0 } }, before);
    map.addLayer({ id: DISTRICT_LINE, type: "line", source: DISTRICTS, paint: { "line-opacity": 0.85 } }, before);
    map.addLayer({
      id: HOVER, type: "line", source: CELLS, filter: ["==", ["get", "cell"], ""],
      paint: { "line-width": 1.5, "line-opacity": 0.9 },
    }, before);
    map.addLayer({
      id: SELECTED_CASING, type: "line", source: CELLS, filter: ["==", ["get", "cell"], ""],
      paint: { "line-color": "#0b0b0b", "line-width": 5, "line-opacity": 0.55 },
    });
    map.addLayer({
      id: SELECTED, type: "line", source: CELLS, filter: ["==", ["get", "cell"], ""],
      paint: { "line-color": "#ffffff", "line-width": 2.5 },
    });
  }, [map, styleReady, data]);

  // --- paint, filters and visibility follow the layers panel, the filters and the risk engine
  useEffect(() => {
    if (!map || !styleReady || !data || !map.getLayer(CROP_FILL)) return;
    const show = (on: boolean) => (on ? "visible" : "none");
    const farmland = farmlandFilter({ minCropland: data.min_cropland, district, crop });
    const zones = zoneFilter(district);
    const level = zoneLevelColor(areas ?? []);
    const ink = darkBase ? "#f3f4f6" : "#334155";

    map.setFilter(CROP_FILL, farmland);
    map.setFilter(CROP_EDGE, farmland);
    map.setPaintProperty(CROP_FILL, "fill-color", cropFill(crop));
    map.setPaintProperty(CROP_FILL, "fill-opacity", cropOpacity(crop, data.min_cropland));
    // The 2px gap between neighbouring fills, in the basemap's own tone, so each cell reads as one.
    map.setPaintProperty(CROP_EDGE, "line-color", darkBase ? "#111418" : "#ffffff");
    map.setLayoutProperty(CROP_FILL, "visibility", show(layers.crops));
    map.setLayoutProperty(CROP_EDGE, "visibility", show(layers.crops));

    map.setFilter(RISK_FILL, zones);
    map.setFilter(RISK_LINE, zones);
    map.setPaintProperty(RISK_FILL, "fill-color", level);
    map.setPaintProperty(RISK_FILL, "fill-opacity", layers.crops ? 0 : 0.55);
    map.setPaintProperty(RISK_LINE, "line-color", level);
    map.setPaintProperty(RISK_LINE, "line-width", layers.crops ? 2.5 : 1);
    map.setPaintProperty(RISK_LINE, "line-offset", layers.crops ? 1.25 : 0);
    map.setLayoutProperty(RISK_FILL, "visibility", show(layers.risk));
    map.setLayoutProperty(RISK_LINE, "visibility", show(layers.risk));

    map.setPaintProperty(DISTRICT_LINE, "line-color", ink);
    map.setPaintProperty(DISTRICT_LINE, "line-width", ["case", ["==", ["get", "name"], district ?? ""], 2.75, 1.1]);
    map.setLayoutProperty(DISTRICT_LINE, "visibility", show(layers.districts));
    map.setPaintProperty(HOVER, "line-color", ink);
  }, [map, styleReady, data, layers, district, crop, areas, darkBase]);

  // --- the selected cell, always on top of the cells
  useEffect(() => {
    if (!map || !styleReady || !map.getLayer(SELECTED)) return;
    map.setFilter(SELECTED_CASING, ["==", ["get", "cell"], cell ?? ""]);
    map.setFilter(SELECTED, ["==", ["get", "cell"], cell ?? ""]);
    const top = Object.keys(PIN_TABS).find((id) => map.getLayer(id));
    map.moveLayer(SELECTED_CASING, top);
    map.moveLayer(SELECTED, top);
  }, [map, styleReady, data, cell]);

  // --- the details panel covers the right of a wide screen: keep the selected cell in view beside it
  useEffect(() => {
    const anchor = useMapStore.getState().anchor;
    if (!map || view !== "details" || !anchor || window.innerWidth < 640) return;
    const { x } = map.project(anchor);
    if (x > map.getContainer().clientWidth - 460) map.easeTo({ center: anchor, offset: [-220, 0], duration: 500 });
  }, [map, view]);

  // --- click: a marker opens its cell on the marker's tab; anywhere else opens the cell's summary
  useEffect(() => {
    if (!map) return;
    const click = (event: MapMouseEvent) => {
      if (useAppStore.getState().drawMode) return; // the area-drawing tool owns clicks while it is on
      if (!map.getLayer(HIT)) return;
      const pinLayers = Object.keys(PIN_TABS).filter((id) => map.getLayer(id));
      const pin = pinLayers.length ? map.queryRenderedFeatures(event.point, { layers: pinLayers })[0] : undefined;
      const at: [number, number] = pin?.geometry.type === "Point"
        ? (pin.geometry.coordinates as [number, number])
        : [event.lngLat.lng, event.lngLat.lat];
      // A marker's own position decides its cell, not where on the marker the click landed.
      const hit = map.queryRenderedFeatures(pin ? map.project(at) : event.point, { layers: [HIT] })[0];
      const id = hit?.properties?.cell as string | undefined;
      if (!id) return closeCell();
      selectCell(id, at, pin ? PIN_TABS[pin.layer.id] : undefined);
      // From the state-wide view a cell is a few pixels across: come close enough to see it.
      if (map.getZoom() < 9) map.easeTo({ center: at, zoom: 9.5, duration: 600 });
    };
    map.on("click", click);
    return () => {
      map.off("click", click);
    };
  }, [map, selectCell, closeCell]);

  // --- hover: a thin outline on the cell under the pointer
  useEffect(() => {
    if (!map) return;
    const move = (event: MapLayerMouseEvent) => {
      const id = (event.features?.[0]?.properties?.cell as string | undefined) ?? null;
      if (id === hovered.current || !map.getLayer(HOVER)) return;
      hovered.current = id;
      map.setFilter(HOVER, ["==", ["get", "cell"], id ?? ""]);
      map.getCanvas().style.cursor = id ? "pointer" : "";
    };
    const leave = () => {
      hovered.current = null;
      if (map.getLayer(HOVER)) map.setFilter(HOVER, ["==", ["get", "cell"], ""]);
      map.getCanvas().style.cursor = "";
    };
    map.on("mousemove", HIT, move);
    map.on("mouseleave", HIT, leave);
    return () => {
      map.off("mousemove", HIT, move);
      map.off("mouseleave", HIT, leave);
    };
  }, [map]);

  // --- district names: DOM labels, so they survive a basemap switch and need no map fonts
  useEffect(() => {
    if (!map || !data || !layers.districts) return;
    const markers = data.district_list.map((d) => {
      const element = document.createElement("span");
      element.className = "ag-district-label";
      element.textContent = d.name;
      element.setAttribute("aria-hidden", "true");
      return new Marker({ element }).setLngLat(d.label_point).addTo(map);
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [map, data, layers.districts]);

  // --- frame Manipur once, when the layer first arrives; then the district a filter chooses
  useEffect(() => {
    if (!map || !data || framed.current || !data.district_list.length) return;
    framed.current = true;
    const b = data.district_list.map((d) => d.bounds);
    map.fitBounds(
      [[Math.min(...b.map((x) => x[0])), Math.min(...b.map((x) => x[1]))], [Math.max(...b.map((x) => x[2])), Math.max(...b.map((x) => x[3]))]],
      { padding: framePadding(), duration: 0 },
    );
  }, [map, data]);

  useEffect(() => {
    if (!map || !data || !district) return;
    const bounds = data.district_list.find((d) => d.name === district)?.bounds;
    if (bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: framePadding(), duration: 700, maxZoom: 11 });
  }, [map, data, district]);

  // --- a new layer response replaces the cells in place (no re-add needed)
  useEffect(() => {
    const source = map?.getSource(CELLS) as GeoJSONSource | undefined;
    if (source && data) source.setData(data.cells);
  }, [map, data]);

  return null;
}

/** Framing padding that fits the screen: the panels only take room on a wide one. */
function framePadding() {
  return window.innerWidth >= 768 ? PADDING : { top: 110, bottom: 110, left: 20, right: 20 };
}
