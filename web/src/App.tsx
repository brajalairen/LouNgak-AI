/** Layout shell: the top bar, then one page. One application with two dashboards: the community &
 *  farmer pages and the officer pages, chosen by the demo account (shell/useSession.ts). */

import { useEffect } from "react";
import { api } from "./state/api";
import { applyTheme, useAppStore } from "./state/useAppStore";
import { ToastHost } from "./ui/primitives";
import { useAgriStore } from "./agri/useAgriStore";
import { TopBar } from "./shell/AppShell";
import { useSession, type Page } from "./shell/useSession";
import { SituationMonitor } from "./pages/SituationMonitor";
import { WatchPage } from "./pages/WatchPage";
import { FieldOpsPage } from "./pages/FieldOpsPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { ReportPage } from "./pages/ReportPage";
import { MyReportsPage } from "./pages/MyReportsPage";
import { AtlasPage } from "./pages/AtlasPage";

const PAGE: Record<Page, () => JSX.Element> = {
  monitor: SituationMonitor,
  watch: WatchPage,
  "field-ops": FieldOpsPage,
  "my-tasks": MyTasksPage,
  report: ReportPage,
  "my-reports": MyReportsPage,
  atlas: AtlasPage,
};

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const setModelIsFake = useAppStore((s) => s.setModelIsFake);
  const setError = useAppStore((s) => s.setError);
  const page = useSession((s) => s.page);
  const loadUsers = useSession((s) => s.loadUsers);

  useEffect(() => applyTheme(theme), [theme]);

  // The risk engine's assessment of every monitored area, the dashboard's starting point.
  const loadRisk = useAgriStore((s) => s.load);
  useEffect(() => {
    void loadRisk();
  }, [loadRisk]);

  useEffect(() => {
    void loadUsers().catch(() => undefined);
  }, [loadUsers]);

  useEffect(() => {
    api
      .health()
      .then((health) => setModelIsFake(health.model_is_fake))
      .catch(() => setError("Cannot reach the analysis server. Start it with: uvicorn satquery.server:app"));
  }, [setModelIsFake, setError]);

  const Current = PAGE[page];
  return (
    <ToastHost>
      <div className="flex h-full w-full flex-col">
        <TopBar />
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <Current />
        </main>
      </div>
    </ToastHost>
  );
}
