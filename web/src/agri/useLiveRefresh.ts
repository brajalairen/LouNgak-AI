/** Keeps the risk assessment on screen current.
 *
 *  A farmer report or an inspection outcome makes the server recompute the zones' scores in the background
 *  (`AssessmentService.invalidate`). The overview was fetched only when the app started, so without this the
 *  priority panel and the map's zone colours kept the old score while the drawer showed the new one. Any
 *  change in the session (`revision`: a report, an outcome, an account switch) now re-fetches it twice
 *  shortly after, to catch the recompute, and the page also re-fetches every minute while it is visible,
 *  so changes made from another device appear too. A refresh never blanks what is shown. */

import { useEffect } from "react";
import { useSession } from "../shell/useSession";
import { useAgriStore } from "./useAgriStore";

/** After a change: the server's recompute usually takes well under a second once its inputs are cached. */
export const AFTER_CHANGE_MS = [1500, 5000] as const;
export const EVERY_MS = 60_000;

/** Schedule `refresh` at each delay; returns a function that cancels whatever has not run yet. */
export function scheduleRefreshes(refresh: () => void, delays: readonly number[] = AFTER_CHANGE_MS): () => void {
  const timers = delays.map((ms) => setTimeout(refresh, ms));
  return () => timers.forEach(clearTimeout);
}

export function useLiveRefresh(): void {
  const revision = useSession((s) => s.revision);
  const refresh = useAgriStore((s) => s.refresh);

  useEffect(() => {
    if (revision === 0) return; // the first load happens when the app starts
    return scheduleRefreshes(() => void refresh());
  }, [revision, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [refresh]);
}
