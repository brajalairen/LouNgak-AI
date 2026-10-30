/** Smoke test: every non-map page renders real server responses (captured in fixtures.json) for the
 *  accounts that open it, without a runtime error. Only `fetch` is stubbed. The map pages need WebGL
 *  and are checked in the browser instead. */

import { act, createElement, type FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "./fixtures.json";
import { useSession } from "../shell/useSession";
import { AtlasPage } from "./AtlasPage";
import { FieldOpsPage } from "./FieldOpsPage";
import { MyReportsPage } from "./MyReportsPage";
import { MyTasksPage } from "./MyTasksPage";
import { WatchPage } from "./WatchPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RESPONSES = fixtures as Record<string, unknown>;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      const body = RESPONSES[path];
      return body === undefined
        ? new Response(JSON.stringify({ detail: "not in fixtures" }), { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

async function render(page: FunctionComponent, userId: string | null): Promise<string> {
  await useSession.getState().loadUsers();
  useSession.getState().setUser(userId);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(page));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const text = container.textContent ?? "";
  act(() => root.unmount());
  return text;
}

describe("pages render real server responses", () => {
  it("Watch, for the public and for an officer", async () => {
    const publicText = await render(WatchPage, null);
    expect(publicText).toContain("Local alerts");
    expect(publicText).not.toContain("Create inspection");
    const officerText = await render(WatchPage, "district-bishnupur");
    expect(officerText).toContain("LouNgak Watch");
    expect(officerText).toContain("Create inspection");
    expect(officerText).toContain("Demo");
  });

  it("Field Operations: the queue with its reasons", async () => {
    const text = await render(FieldOpsPage, "district-bishnupur");
    expect(text).toContain("Review queue");
    expect(text).toContain("Farmer report: unverified until inspected.");
  });

  it("My inspections, My reports and the Crop Atlas", async () => {
    expect(await render(MyTasksPage, "field-bishnupur")).toContain("My inspections");
    expect(await render(MyReportsPage, "farmer-bishnupur")).toContain("My reports");
    const atlas = await render(AtlasPage, null);
    expect(atlas).toContain("Oryza sativa");
    expect(atlas).toContain("DRAFT");
  });
});
