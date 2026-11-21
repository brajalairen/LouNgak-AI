import { describe, expect, it } from "vitest";
import { dueState } from "./ui";

const today = new Date(2026, 10, 21, 15, 30); // 21 Nov 2026, mid-afternoon local time

describe("an inspection's due date", () => {
  it("is overdue after the day has passed, counting whole days", () => {
    expect(dueState("2026-11-20", "ASSIGNED", today)).toEqual({ tone: "overdue", text: "Overdue · 1 day" });
    expect(dueState("2026-11-18", "IN_PROGRESS", today)).toEqual({ tone: "overdue", text: "Overdue · 3 days" });
  });

  it("is due soon today and tomorrow", () => {
    expect(dueState("2026-11-21", "ASSIGNED", today)).toEqual({ tone: "soon", text: "Due today" });
    expect(dueState("2026-11-22", "NEW", today)).toEqual({ tone: "soon", text: "Due tomorrow" });
  });

  it("shows a later date plainly", () => {
    expect(dueState("2026-11-25", "ASSIGNED", today)).toEqual({ tone: "later", text: "Due 25 Nov" });
  });

  it("is never highlighted once the inspection is closed", () => {
    expect(dueState("2026-11-01", "COMPLETED", today).tone).toBe("closed");
    expect(dueState("2026-11-01", "CANCELLED", today).tone).toBe("closed");
  });
});
