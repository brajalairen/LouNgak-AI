/** The top bar: the wordmark, the pages this account can open, and the DEMO account switcher. The
 *  switcher is labelled as demo accounts everywhere: anyone can switch, so it is not authentication. */

import { Moon, Sun } from "lucide-react";
import { useAppStore } from "../state/useAppStore";
import { cx, IconButton, Tooltip } from "../ui/primitives";
import { pagesFor, useSession } from "./useSession";

export function TopBar() {
  const users = useSession((s) => s.users);
  const user = useSession((s) => s.user);
  const page = useSession((s) => s.page);
  const note = useSession((s) => s.note);
  const setUser = useSession((s) => s.setUser);
  const setPage = useSession((s) => s.setPage);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  return (
    <header className="z-40 shrink-0 border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-[17px] font-semibold tracking-tight text-ink">LouNgak AI</span>
          <span className="hidden text-[11px] text-muted lg:inline">Agricultural &amp; environmental intelligence · Manipur</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip label={note || "Demo accounts"} side="bottom">
            <span className="rounded-[4px] border border-warn/60 bg-warn/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-warn uppercase">
              Demo accounts
            </span>
          </Tooltip>
          <label className="sr-only" htmlFor="demo-account">Demo account</label>
          <select
            id="demo-account"
            value={user?.id ?? ""}
            onChange={(e) => setUser(e.target.value || null)}
            className="max-w-[220px] rounded-[var(--radius-sm)] border border-line bg-surface px-2 py-1 text-[12px] text-ink"
          >
            <option value="">Public visitor</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <IconButton label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} side="bottom" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
          </IconButton>
        </div>

        <nav aria-label="Pages" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto pb-0.5 md:order-none md:mx-0 md:w-auto md:flex-1">
          {pagesFor(user).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={page === p.id ? "page" : undefined}
              onClick={() => setPage(p.id)}
              className={cx(
                "shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                page === p.id ? "bg-accent-soft text-accent" : "text-ink hover:bg-hover",
              )}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
