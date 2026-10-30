/** Who is looking and at which page. One application, two dashboards: the community & farmer pages and
 *  the officer pages, chosen by the demo account. A public visitor (no account) sees the public pages. */

import { create } from "zustand";
import { api, setDemoUser } from "../state/api";
import type { DemoUser, Role } from "../state/types";

export type Page = "monitor" | "watch" | "field-ops" | "my-tasks" | "report" | "my-reports" | "atlas";
type Audience = Role | "public";

export const PAGES: { id: Page; label: string; audience: Audience[] }[] = [
  { id: "watch", label: "Alerts", audience: ["public", "farmer", "field_officer", "district_officer", "state_officer"] },
  { id: "report", label: "Report an issue", audience: ["farmer"] },
  { id: "my-reports", label: "My reports", audience: ["farmer"] },
  { id: "monitor", label: "Situation Monitor", audience: ["district_officer", "state_officer", "field_officer", "public"] },
  { id: "field-ops", label: "Field Operations", audience: ["district_officer", "state_officer"] },
  { id: "my-tasks", label: "My inspections", audience: ["field_officer"] },
  { id: "atlas", label: "Crop Atlas", audience: ["public", "farmer", "field_officer", "district_officer", "state_officer"] },
];

const HOME: Record<Audience, Page> = {
  public: "watch",
  farmer: "watch",
  field_officer: "my-tasks",
  district_officer: "field-ops",
  state_officer: "monitor",
};

const STORAGE_KEY = "loungak.demoUser";

function stored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function pagesFor(user: DemoUser | null) {
  const audience: Audience = user?.role ?? "public";
  return PAGES.filter((p) => p.audience.includes(audience));
}

interface SessionState {
  users: DemoUser[];
  note: string;
  user: DemoUser | null;
  page: Page;
  /** Bumped after any change to reports or tasks, so every open view reloads. */
  revision: number;
  loadUsers: () => Promise<void>;
  setUser: (id: string | null) => void;
  setPage: (page: Page) => void;
  changed: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  users: [],
  note: "",
  user: null,
  page: "watch",
  revision: 0,

  loadUsers: async () => {
    const people = await api.opsUsers();
    set({ users: people.users, note: people.note });
    const remembered = stored();
    if (remembered && people.users.some((u) => u.id === remembered)) get().setUser(remembered);
  },

  setUser: (id) => {
    const user = get().users.find((u) => u.id === id) ?? null;
    setDemoUser(user?.id ?? null);
    try {
      if (user) localStorage.setItem(STORAGE_KEY, user.id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode: the choice simply is not remembered */
    }
    set({ user, page: HOME[user?.role ?? "public"], revision: get().revision + 1 });
  },

  setPage: (page) => set({ page }),

  changed: () => set({ revision: get().revision + 1 }),
}));
