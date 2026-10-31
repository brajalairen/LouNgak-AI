/** A page that throws (while rendering, or in an effect cleanup when it closes, as a map layer once did)
 *  must leave a notice behind, never an empty app. */

import { act, createElement, useEffect, type FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Fine: FunctionComponent = () => createElement("p", null, "fine page");
const Broken: FunctionComponent = () => {
  throw new Error("render failed");
};
/** Throws while closing: the shape of the bug where a layer removed a control from an already-removed map. */
const BreaksOnClose: FunctionComponent = () => {
  useEffect(() => () => {
    throw new Error("cleanup failed");
  }, []);
  return createElement("p", null, "map page");
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined); // React and the boundary both log
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

const show = (page: string, Page: FunctionComponent) =>
  act(() => root.render(createElement(ErrorBoundary, { resetKey: page, children: createElement(Page) })));

describe("error boundary", () => {
  it("shows a notice with the error instead of a blank app", () => {
    show("map", Broken);
    expect(container.textContent).toContain("This page stopped working");
    expect(container.textContent).toContain("render failed");
  });

  it("clears the notice when another page opens", () => {
    show("map", Broken);
    show("watch", Fine);
    expect(container.textContent).toBe("fine page");
  });

  it("catches an error thrown by a page's cleanup as it closes, so the app never empties", () => {
    show("map", BreaksOnClose);
    show("watch", Fine);
    expect(container.innerHTML).not.toBe("");
    expect(container.textContent).toContain("cleanup failed");
  });
});
