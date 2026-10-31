import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Alert, CellDetail } from "../state/types";
import { ApiError } from "../state/api";
import { summary } from "../agri/testFixtures";
import { LEVEL_COLOR } from "../agri/format";
import {
  alertGroups, CROP_COLOR, cropFill, cropOpacity, farmlandFilter, inPeriod, isDisplayCell, zoneFilter, zoneLevelColor,
} from "./format";
import { useMapStore } from "./useMapStore";

const mapCell = vi.fn();
vi.mock("../state/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../state/api")>();
  return { ...actual, api: { ...actual.api, mapCell: (...args: unknown[]) => mapCell(...args) } };
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function alert(id: string, zone: string, priority: Alert["priority"], status: Alert["status"] = "active"): Alert {
  return {
    id, category: "weather", subtype: "heavy", title: id, summary: "", priority, evidence_status: "forecast",
    gate: "published", rule_id: "heavy_rain", rule_status: "SOURCED", zone_id: zone, zone_name: zone, district: "Bishnupur",
    label_point: [93.8, 24.66], issued_at: "", valid_from: "", valid_until: "", evidence: [], limitations: [],
    recommended_action: "", provenance: [], status, acknowledged_by: null, acknowledged_at: null, is_demo: false,
  };
}

function cell(id: string): CellDetail {
  return {
    cell: id, resolution: 7, center: [93.8, 24.66], boundary: { type: "Polygon", coordinates: [] }, area_km2: 5.2,
    district: "Bishnupur", landcover: [], cropland: 0.8, is_farmland: true, crop_mix: [{ crop: "rice", share: 1 }],
    dominant: "rice", zone: null, zone_note: "", alerts: [], reports: [], tasks: [], reports_visible: false,
    tasks_visible: false, notes: [],
  };
}

describe("map expressions only restate server data", () => {
  it("draws farmland from the cropland share, narrowed by district and crop", () => {
    expect(farmlandFilter({ minCropland: 0.05, district: null, crop: null })).toEqual(
      ["all", [">=", ["coalesce", ["get", "cropland"], 0], 0.05]]);
    const narrowed = farmlandFilter({ minCropland: 0.05, district: "Thoubal", crop: "maize" });
    expect(narrowed).toContainEqual(["==", ["get", "district"], "Thoubal"]);
    expect(narrowed).toContainEqual([">=", ["coalesce", ["get", "p_maize"], 0], 0.1]);
  });

  it("colours by the dominant crop, or one colour when a crop is chosen", () => {
    expect(cropFill("maize")).toBe(CROP_COLOR.maize);
    const match = cropFill(null) as unknown[];
    expect(match[0]).toBe("match");
    expect(match).toContain(CROP_COLOR.rice);
    expect(cropOpacity(null, 0.05)).toEqual(["interpolate", ["linear"], ["coalesce", ["get", "cropland"], 0], 0.05, 0.35, 0.6, 0.8]);
  });

  it("gives a cell its zone's engine colour and nothing outside every zone", () => {
    const colour = zoneLevelColor([summary("z1", { level: "HIGH" }), summary("z2", { level: "LOW" })]) as unknown[];
    expect(colour).toEqual(["match", ["coalesce", ["get", "zone"], ""], "z1", LEVEL_COLOR.HIGH, "z2", LEVEL_COLOR.LOW, "rgba(0,0,0,0)"]);
    expect(zoneLevelColor([])).toBe("rgba(0,0,0,0)");
    expect(zoneFilter("Bishnupur")).toContainEqual(["==", ["get", "district"], "Bishnupur"]);
  });

  it("groups active alerts per zone, most urgent first", () => {
    const groups = alertGroups([alert("a", "z1", "low"), alert("b", "z1", "high"), alert("c", "z2", "moderate"),
      alert("d", "z3", "high", "acknowledged")]);
    expect(groups.map((g) => [g.zoneId, g.priority, g.alerts.map((a) => a.id)])).toEqual([
      ["z1", "high", ["b", "a"]], ["z2", "moderate", ["c"]]]);
  });

  it("filters records by period and recognises display cell ids", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    expect(inPeriod("2026-10-25T00:00:00Z", 7, now)).toBe(true);
    expect(inPeriod("2026-10-01T00:00:00Z", 7, now)).toBe(false);
    expect(inPeriod("2020-01-01T00:00:00Z", null, now)).toBe(true);
    expect(isDisplayCell("873cea081ffffff")).toBe(true);
    expect(isDisplayCell("883cea0811fffff")).toBe(false);
  });
});

describe("selecting a cell", () => {
  beforeEach(() => {
    mapCell.mockReset();
    useMapStore.getState().closeCell();
  });

  it("opens the summary, then fills it with what the server said", async () => {
    mapCell.mockResolvedValue(cell("873cea081ffffff"));
    useMapStore.getState().selectCell("873cea081ffffff", [93.8, 24.66]);
    expect(useMapStore.getState()).toMatchObject({ view: "summary", tab: "overview", detailStatus: "loading" });
    await flush();
    expect(useMapStore.getState().detail?.cell).toBe("873cea081ffffff");
  });

  it("a marker opens the details on its tab", () => {
    mapCell.mockResolvedValue(cell("873cea081ffffff"));
    useMapStore.getState().selectCell("873cea081ffffff", [93.8, 24.66], "reports");
    expect(useMapStore.getState()).toMatchObject({ view: "details", tab: "reports" });
  });

  it("a slow answer for an earlier cell never overwrites the current one", async () => {
    let finishFirst: (value: CellDetail) => void = () => undefined;
    mapCell.mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)));
    mapCell.mockResolvedValueOnce(cell("873cea0a3ffffff"));
    useMapStore.getState().selectCell("873cea081ffffff", [93.8, 24.66]);
    useMapStore.getState().selectCell("873cea0a3ffffff", [93.9, 24.7]);
    await flush();
    finishFirst(cell("873cea081ffffff"));
    await flush();
    expect(useMapStore.getState().detail?.cell).toBe("873cea0a3ffffff");
  });

  it("says why a cell could not be loaded, and closing clears it", async () => {
    mapCell.mockRejectedValue(new ApiError("'x' is not an H3 resolution-7 cell.", 404));
    useMapStore.getState().selectCell("873cea081ffffff", [93.8, 24.66]);
    await flush();
    expect(useMapStore.getState()).toMatchObject({ detailStatus: "error", detailError: "'x' is not an H3 resolution-7 cell." });
    useMapStore.getState().closeCell();
    expect(useMapStore.getState()).toMatchObject({ cell: null, view: null, detail: null });
  });

  it("toggles one layer without touching the others", () => {
    const before = useMapStore.getState().layers;
    useMapStore.getState().toggleLayer("crops");
    expect(useMapStore.getState().layers).toEqual({ ...before, crops: !before.crops });
  });
});
