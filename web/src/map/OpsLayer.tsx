/** Field operations on the map: open farmer reports (amber) and inspection tasks (blue) that the current
 *  demo account may see. Hidden for a public visitor, who has no access to reports or tasks. A click
 *  shows the record's id, status and evidence status. */

import { useEffect, useState } from "react";
import { Popup, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import { api } from "../state/api";
import type { FarmerReport, InspectionTask } from "../state/types";
import { useAgriStore } from "../agri/useAgriStore";
import { useSession } from "../shell/useSession";
import { REPORT_STATUS_LABEL, TASK_STATUS_LABEL } from "../ops/ui";
import { useMap, useMapReady } from "./MapView";

const SOURCE = "ops-points";
const CIRCLE = "ops-points-circle";

export function OpsLayer() {
  const map = useMap();
  const styleReady = useMapReady();
  const visible = useAgriStore((s) => s.layers.fieldops);
  const user = useSession((s) => s.user);
  const revision = useSession((s) => s.revision);
  const [data, setData] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });

  useEffect(() => {
    if (!user) {
      setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const reports = user.role === "field_officer" ? Promise.resolve([] as FarmerReport[]) : api.reports().catch(() => []);
    const tasks = user.role === "farmer" ? Promise.resolve([] as InspectionTask[]) : api.tasks().catch(() => []);
    void Promise.all([reports, tasks]).then(([r, t]) =>
      setData({
        type: "FeatureCollection",
        features: [
          ...r.filter((x) => x.status !== "DISMISSED").map((x) => point(x.longitude, x.latitude, {
            kind: "report", label: `${x.id} · farmer report, unverified · ${REPORT_STATUS_LABEL[x.status]}${x.is_demo ? " · DEMO" : ""}`,
          })),
          ...t.map((x) => point(x.longitude, x.latitude, {
            kind: "task", label: `${x.id} · inspection · ${TASK_STATUS_LABEL[x.status]}${x.is_demo ? " · DEMO" : ""}`,
          })),
        ],
      }),
    );
  }, [user, revision]);

  useEffect(() => {
    if (!map || !styleReady) return;
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource(SOURCE, { type: "geojson", data });
      map.addLayer({
        id: CIRCLE,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": ["match", ["get", "kind"], "report", "#d97706", "#2563eb"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
    map.moveLayer(CIRCLE);
    map.setLayoutProperty(CIRCLE, "visibility", visible ? "visible" : "none");
  }, [map, styleReady, data, visible]);

  useEffect(() => {
    if (!map) return;
    const click = (event: MapLayerMouseEvent) => {
      const label = event.features?.[0]?.properties?.label as string | undefined;
      if (label) new Popup({ closeButton: false }).setLngLat(event.lngLat).setText(label).addTo(map);
    };
    map.on("click", CIRCLE, click);
    return () => {
      map.off("click", CIRCLE, click);
    };
  }, [map]);

  return null;
}

function point(lon: number, lat: number, properties: Record<string, string>): GeoJSON.Feature {
  return { type: "Feature", properties, geometry: { type: "Point", coordinates: [lon, lat] } };
}
