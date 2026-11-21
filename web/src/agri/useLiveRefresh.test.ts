import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AFTER_CHANGE_MS, scheduleRefreshes } from "./useLiveRefresh";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("refreshing after a change", () => {
  it("re-fetches shortly after a change, and once more to catch a slower recompute", () => {
    const refresh = vi.fn();
    scheduleRefreshes(refresh);
    vi.advanceTimersByTime(AFTER_CHANGE_MS[0] - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(AFTER_CHANGE_MS[1]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("a newer change cancels the refreshes still waiting from the previous one", () => {
    const refresh = vi.fn();
    const cancel = scheduleRefreshes(refresh);
    vi.advanceTimersByTime(AFTER_CHANGE_MS[0]);
    cancel();
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
