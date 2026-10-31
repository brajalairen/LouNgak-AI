/** Markers: active alerts (one triangle per zone, coloured by the most urgent), farmer reports (rings) and
 *  inspections (diamonds) that the current demo account may see. A public visitor sees alerts only; the
 *  server decides, and the reports and tasks lists simply come back empty or forbidden.
 *
 *  Icons are drawn on a canvas and added as map images, so they need no sprite sheet or map fonts and work
 *  on every basemap; like the sources, they are re-added after each style load. A click is handled by
 *  AgLayers, which opens the marker's cell on the matching tab. */

import { useEffect } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { api } from "../state/api";
import type { FarmerReport, InspectionTask, Priority } from "../state/types";
import { useSession } from "../shell/useSession";
import { useMap, useMapReady } from "../map/MapView";
import { alertGroups, inPeriod } from "./format";
import { useMapStore } from "./useMapStore";

const SOURCE = "ag-pins";
const LAYERS = { alerts: "ag-pin-alerts", reports: "ag-pin-reports", tasks: "ag-pin-tasks" } as const;
/** Alert triangles take the priority's status colour; the label beside every alert says it in words. */
export const ALERT_COLOR: Record<Priority, string> = { urgent: "#d03b3b", high: "#d03b3b", moderate: "#ec835a", low: "#fab219" };
export const REPORT_COLOR = "#2563eb";
export const TASK_COLOR = "#7c3aed";

export function PinsLayer() {
  const map = useMap();
  const styleReady = useMapReady();
  const user = useSession((s) => s.user);
  const revision = useSession((s) => s.revision);
  const pins = useMapStore((s) => s.pins);
  const setPins = useMapStore((s) => s.setPins);
  const layers = useMapStore((s) => s.layers);
  const period = useMapStore((s) => s.period);

  // --- what this account may see, reloaded whenever the account or any record changes
  useEffect(() => {
    let live = true;
    const reports = user && user.role !== "field_officer" ? api.reports().catch(() => []) : Promise.resolve([] as FarmerReport[]);
    const tasks = user && user.role !== "farmer" ? api.tasks().catch(() => []) : Promise.resolve([] as InspectionTask[]);
    void Promise.all([api.watch().then((w) => w.alerts).catch(() => []), reports, tasks]).then(
      ([alerts, r, t]) => live && setPins({ alerts, reports: r.filter((x) => x.status !== "DISMISSED"), tasks: t }),
    );
    return () => {
      live = false;
    };
  }, [user, revision, setPins]);

  useEffect(() => {
    if (!map || !styleReady) return;
    addIcons(map);
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        ...alertGroups(pins.alerts).map((g) => point(g.point, { kind: "alert", icon: `ag-alert-${g.priority}` })),
        ...pins.reports.filter((r) => inPeriod(r.submitted_at, period)).map((r) => point([r.longitude, r.latitude], { kind: "report", icon: "ag-report" })),
        ...pins.tasks.filter((t) => inPeriod(t.created_at, period)).map((t) => point([t.longitude, t.latitude], { kind: "task", icon: "ag-task" })),
      ],
    };
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource(SOURCE, { type: "geojson", data });
      const symbol = (id: string, kind: string, anchor: "left" | "center") =>
        map.addLayer({
          id, type: "symbol", source: SOURCE, filter: ["==", ["get", "kind"], kind],
          layout: { "icon-image": ["get", "icon"], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-anchor": anchor },
        });
      symbol(LAYERS.tasks, "task", "center");
      symbol(LAYERS.reports, "report", "center");
      // Beside the zone's rank chip, which sits just left of the same point.
      symbol(LAYERS.alerts, "alert", "left");
    }
    for (const id of [LAYERS.tasks, LAYERS.reports, LAYERS.alerts]) map.moveLayer(id);
    map.setLayoutProperty(LAYERS.alerts, "visibility", layers.alerts ? "visible" : "none");
    map.setLayoutProperty(LAYERS.reports, "visibility", layers.reports ? "visible" : "none");
    map.setLayoutProperty(LAYERS.tasks, "visibility", layers.inspections ? "visible" : "none");
  }, [map, styleReady, pins, period, layers.alerts, layers.reports, layers.inspections]);

  return null;
}

function point(coordinates: [number, number], properties: Record<string, string>): GeoJSON.Feature {
  return { type: "Feature", properties, geometry: { type: "Point", coordinates } };
}

const SCALE = 2; // drawn at twice the size for sharp icons on high-density screens

function addIcons(map: MapLibreMap) {
  const draw = (id: string, size: number, paint: (c: CanvasRenderingContext2D, s: number) => void) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size * SCALE;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(SCALE, SCALE);
    paint(context, size);
    map.addImage(id, context.getImageData(0, 0, size * SCALE, size * SCALE), { pixelRatio: SCALE });
  };
  for (const [priority, color] of Object.entries(ALERT_COLOR)) {
    draw(`ag-alert-${priority}`, 22, (c, s) => {
      c.beginPath();
      c.moveTo(s / 2, 2);
      c.lineTo(s - 2, s - 3);
      c.lineTo(2, s - 3);
      c.closePath();
      c.fillStyle = color;
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2;
      c.lineJoin = "round";
      c.fill();
      c.stroke();
      c.fillStyle = "#ffffff";
      c.fillRect(s / 2 - 1, 8, 2, 6);
      c.fillRect(s / 2 - 1, 15.5, 2, 2);
    });
  }
  draw("ag-report", 16, (c, s) => {
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - 2.5, 0, Math.PI * 2);
    c.fillStyle = "#ffffff";
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = REPORT_COLOR;
    c.stroke();
  });
  draw("ag-task", 18, (c, s) => {
    c.beginPath();
    c.moveTo(s / 2, 1.5);
    c.lineTo(s - 1.5, s / 2);
    c.lineTo(s / 2, s - 1.5);
    c.lineTo(1.5, s / 2);
    c.closePath();
    c.fillStyle = TASK_COLOR;
    c.strokeStyle = "#ffffff";
    c.lineWidth = 2;
    c.fill();
    c.stroke();
  });
}
