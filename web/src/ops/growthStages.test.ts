import { describe, expect, it } from "vitest";
import { isListedStage, stageGroups } from "./growthStages";

const all = (crop: string, audience: "farmer" | "officer") => stageGroups(crop, audience).flatMap((g) => g.stages);

describe("growth-stage choices", () => {
  it("gives farmers a short, plain list and officers the detailed stages by phase", () => {
    expect(all("rice", "farmer")).toHaveLength(6);
    expect(stageGroups("rice", "farmer").every((g) => g.phase === null)).toBe(true);
    expect(stageGroups("rice", "officer").map((g) => g.phase)).toEqual(["Vegetative", "Reproductive", "Ripening", "After harvest"]);
    expect(all("rice", "officer")).toContain("Tillering");
    expect(all("maize", "officer")).toContain("Silking (R1)");
  });

  it("follows rice for Chak-hao, and plain words for other or unknown crops", () => {
    expect(stageGroups("chakhao", "officer")).toEqual(stageGroups("rice", "officer"));
    expect(stageGroups("chakhao", "farmer")).toEqual(stageGroups("rice", "farmer"));
    expect(stageGroups("other", "officer")).toEqual(stageGroups("unknown", "farmer"));
  });

  it("lists harvest for every crop, since many fields are harvested by November", () => {
    for (const crop of ["rice", "chakhao", "maize", "other", "unknown"]) {
      for (const audience of ["farmer", "officer"] as const) {
        expect(all(crop, audience).some((s) => s.startsWith("Harvested"))).toBe(true);
      }
    }
  });

  it("tells a listed choice from typed text", () => {
    expect(isListedStage("rice", "farmer", "Flowering")).toBe(true);
    expect(isListedStage("rice", "farmer", "Tillering")).toBe(false);
    expect(isListedStage("rice", "officer", "Tillering")).toBe(true);
    expect(isListedStage("maize", "officer", null)).toBe(false);
  });

  it("keeps every choice within the API's 80-character limit", () => {
    for (const crop of ["rice", "maize", "other"]) {
      for (const audience of ["farmer", "officer"] as const) {
        for (const stage of all(crop, audience)) expect(stage.length).toBeLessThanOrEqual(80);
      }
    }
  });
});
