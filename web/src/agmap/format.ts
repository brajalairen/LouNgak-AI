/** Presentation only for the agricultural map: colours, labels, filters and MapLibre expressions.
 *
 *  Nothing here computes a figure. Cropland shares come from ESA WorldCover, crop shares are the
 *  server's SAMPLE pattern, and risk levels are the risk engine's, joined onto a cell by its zone id. */

import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import type { Alert, AreaSummary, Priority } from "../state/types";
import { LEVEL_COLOR } from "../agri/format";

/** Crop identity: categorical steps checked with the dataviz validator (every pair clears the
 *  normal-vision floor; colour-blind separation does not hold for all seven pairs, so every crop is
 *  also named wherever it appears). Kept clear of the reserved risk hues: risk is drawn as an outline
 *  over the crops, never as a second fill. "Mixed" is a deliberate neutral, not an identity. */
export const CROP_COLOR: Record<string, string> = {
  rice: "#1baf7a",
  maize: "#eda100",
  potato: "#a8662a",
  tomato: "#e87ba4",
  vegetables: "#008300",
  chakhao: "#7b3fa0",
  other: "#2a78d6",
  mixed: "#a99f8c",
};

export const CROP_LABEL: Record<string, string> = {
  rice: "Rice",
  maize: "Maize",
  potato: "Potato",
  tomato: "Tomato",
  vegetables: "Vegetables",
  chakhao: "Chak-hao",
  other: "Other crops",
  mixed: "Mixed",
};

export const cropLabel = (id: string | null | undefined) => (id ? CROP_LABEL[id] ?? id : "None");
export const cropColor = (id: string | null | undefined) => (id ? CROP_COLOR[id] ?? CROP_COLOR.mixed! : CROP_COLOR.mixed!);

/** WorldCover classes, coloured close to the product's own legend so a reader who knows it is at home. */
export const LANDCOVER_COLOR: Record<string, string> = {
  tree: "#006400",
  shrub: "#b48c1e",
  grass: "#c9c34b",
  crop: "#d97ab6",
  built: "#c4281b",
  bare: "#a49d8f",
  water: "#0064c8",
  wetland: "#0096a0",
  other: "#898781",
};

export type Period = 7 | 30 | 90 | null;

export const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: null, label: "All time" },
];

/** Is a record's timestamp inside the period (null: always)? */
export function inPeriod(iso: string, period: Period, now: number = Date.now()): boolean {
  if (period === null) return true;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && now - time <= period * 86_400_000;
}

export function percent(share: number | null | undefined): string {
  return share === null || share === undefined ? "–" : `${Math.round(share * 100)}%`;
}

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "moderate", "low"];

/** One alert marker per zone: the zone's alerts, most urgent first, at the zone's label point. */
export function alertGroups(alerts: Alert[]): { zoneId: string; point: [number, number]; priority: Priority; alerts: Alert[] }[] {
  const byZone = new Map<string, Alert[]>();
  for (const alert of alerts) {
    if (alert.status !== "active") continue;
    byZone.set(alert.zone_id, [...(byZone.get(alert.zone_id) ?? []), alert]);
  }
  return [...byZone.entries()].map(([zoneId, group]) => {
    const sorted = [...group].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
    return { zoneId, point: sorted[0]!.label_point, priority: sorted[0]!.priority, alerts: sorted };
  });
}

/* ------------------------------------------------------------------ MapLibre expressions */

export interface CellFilters {
  minCropland: number;
  district: string | null;
  crop: string | null;
}

/** The share of `crop` in a cell's SAMPLE mix; 0 where the crop is absent. */
const shareOf = (crop: string): ExpressionSpecification => ["coalesce", ["get", `p_${crop}`], 0];

/** Farmland cells to draw: enough cropland, inside the chosen district, holding the chosen crop. */
export function farmlandFilter({ minCropland, district, crop }: CellFilters): FilterSpecification {
  const parts: ExpressionSpecification[] = [[">=", ["coalesce", ["get", "cropland"], 0], minCropland]];
  if (district) parts.push(["==", ["get", "district"], district]);
  if (crop) parts.push([">=", shareOf(crop), 0.1]);
  return ["all", ...parts] as FilterSpecification;
}

/** Fill colour: the dominant crop, or (with one crop chosen) that crop's colour throughout. */
export function cropFill(crop: string | null): ExpressionSpecification | string {
  if (crop) return cropColor(crop);
  const pairs = Object.entries(CROP_COLOR).flatMap(([id, color]) => [id, color]);
  return ["match", ["coalesce", ["get", "dominant"], "mixed"], ...pairs, CROP_COLOR.mixed!] as unknown as ExpressionSpecification;
}

/** Opacity follows how much of the cell is farmland (or, with one crop chosen, that crop's share). */
export function cropOpacity(crop: string | null, minCropland: number): ExpressionSpecification {
  const value: ExpressionSpecification = crop
    ? ["*", ["coalesce", ["get", "cropland"], 0], shareOf(crop)]
    : ["coalesce", ["get", "cropland"], 0];
  const low = crop ? minCropland * 0.1 : minCropland;
  return ["interpolate", ["linear"], value, low, 0.35, crop ? 0.3 : 0.6, 0.8];
}

/** A cell's risk colour: its zone's engine level, transparent outside every zone. */
export function zoneLevelColor(areas: AreaSummary[]): ExpressionSpecification | string {
  if (!areas.length) return "rgba(0,0,0,0)";
  const pairs = areas.flatMap((area) => [area.id, LEVEL_COLOR[area.level]]);
  return ["match", ["coalesce", ["get", "zone"], ""], ...pairs, "rgba(0,0,0,0)"] as unknown as ExpressionSpecification;
}

/** Zone cells to outline or fill, limited to the chosen district. */
export function zoneFilter(district: string | null): FilterSpecification {
  const parts: ExpressionSpecification[] = [["!=", ["coalesce", ["get", "zone"], ""], ""]];
  if (district) parts.push(["==", ["get", "district"], district]);
  return ["all", ...parts] as FilterSpecification;
}

/** An H3 cell id at the display resolution (7): 15 hex digits starting "87". */
export const isDisplayCell = (text: string) => /^87[0-9a-f]{13}$/.test(text.trim().toLowerCase());
