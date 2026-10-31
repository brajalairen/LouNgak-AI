import { describe, expect, it } from "vitest";
import { present, scrub, SHOW_LABELS } from "./presentation";

describe("presentation wording", () => {
  it("is the default: labels stay hidden until switched on", () => {
    expect(SHOW_LABELS).toBe(false);
  });

  it("rewords the server's demo and sample phrases", () => {
    expect(present("DEMO: Heavy rain forecast near Bishnupur farmland")).toBe("Heavy rain forecast near Bishnupur farmland");
    expect(present("DEMO: check drainage of low-lying paddy fields.")).toBe("Check drainage of low-lying paddy fields.");
    expect(present("Demo field officer (Bishnupur)")).toBe("Field officer (Bishnupur)");
    expect(present("Assigned to Demo field officer (Bishnupur), due 2026-11-02.")).toBe(
      "Assigned to Field officer (Bishnupur), due 2026-11-02.");
    expect(present("mainly from pest-favourable weather and recent pest reports (sample).")).toBe(
      "Mainly from pest-favourable weather and recent pest reports.");
    expect(present("7 SAMPLE report(s), 3 high severity")).toBe("7 report(s), 3 high severity");
    expect(present("Recent pest reports (SAMPLE)")).toBe("Recent pest reports");
    expect(present("Weather alert, forecast; rule DEMO.")).toBe("Weather alert, forecast.");
    expect(present("cut); it is capped at medium when an input is SAMPLE data and at low while any threshold is a PLACEHOLDER."))
      .toBe("Cut); it is capped at low while any threshold is a PLACEHOLDER.");
    expect(present("Water standing in the fields. [DEMO RECORD — demonstration data, not a real report or inspection]"))
      .toBe("Water standing in the fields.");
  });

  it("drops sentences that only say the data is for demonstration", () => {
    expect(present("DEMO alert for the workflow demonstration: not from a real forecast.")).toBe("");
    expect(present("Includes SAMPLE DATA — Prototype Simulation: the report figures are synthetic.")).toBe("");
  });

  it("never touches ids, status values or unrelated text", () => {
    for (const text of ["demo-bishnupur-nambol", "demo.weather.heavy_rain.demo-bishnupur-nambol", "DEMO", "SAMPLE",
      "demo", "  spaced text  ", "Sample size is small"]) {
      expect(present(text)).toBe(text);
    }
  });

  it("keeps a response's shape and drops list items that become empty", () => {
    const response = {
      id: "demo.weather.heavy_rain.demo-bishnupur-nambol", rule_status: "DEMO", is_demo: true, score: 70,
      title: "DEMO: Heavy rain", limitations: ["DEMO RECORD — demonstration data, not a real report or inspection", "Forecast only."],
    };
    expect(scrub(response)).toEqual({
      id: "demo.weather.heavy_rain.demo-bishnupur-nambol", rule_status: "DEMO", is_demo: true, score: 70,
      title: "Heavy rain", limitations: ["Forecast only."],
    });
  });
});
