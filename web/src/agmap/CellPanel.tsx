/** One cell in full, in tabs: overview and actions, crops and land cover, its zone's risk, the zone's
 *  alerts, and the reports and inspections in the cell that this account may see. Every figure is the
 *  server's; every SAMPLE, DEMO and unverified record is labelled where it appears.
 *
 *  Actions: open the zone's full "Why is this area at risk?" explanation (weather day by day and NDVI
 *  against earlier years), create an inspection from an alert or report (an officer covering the
 *  district), or jump to the page that handles the records. */

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ClipboardCheck, Copy, ListChecks, TriangleAlert, X } from "lucide-react";
import type { Alert, CellDetail, FactorId, FarmerReport, InspectionTask } from "../state/types";
import { useSession } from "../shell/useSession";
import { useAgriStore } from "../agri/useAgriStore";
import { CompletenessBar, LevelBadge, PlaceholderNotice } from "../agri/badges";
import { FACTOR_LABEL, formatScore } from "../agri/format";
import { TaskDialog, type TaskTarget } from "../ops/TaskDialog";
import {
  CATEGORY_LABEL, Chip, CROP_LABEL as REPORT_CROP_LABEL, DemoChip, EvidenceChip, OUTCOME_LABEL, PriorityChip,
  REPORT_STATUS_LABEL, TASK_STATUS_LABEL, when,
} from "../ops/ui";
import { Button, cx, IconButton, Spinner, Surface, useToast } from "../ui/primitives";
import { SHOW_LABELS } from "../ui/presentation";
import { cropColor, cropLabel, LANDCOVER_COLOR, percent } from "./format";
import { Tag } from "./LayerPanel";
import { MixBar } from "./CellSummary";
import { useMapStore, type CellTab } from "./useMapStore";

const OFFICERS = ["district_officer", "state_officer"];

export function CellPanel() {
  const view = useMapStore((s) => s.view);
  const cell = useMapStore((s) => s.cell);
  const detail = useMapStore((s) => s.detail);
  const status = useMapStore((s) => s.detailStatus);
  const error = useMapStore((s) => s.detailError);
  const tab = useMapStore((s) => s.tab);
  const setTab = useMapStore((s) => s.setTab);
  const closeCell = useMapStore((s) => s.closeCell);
  const refreshCell = useMapStore((s) => s.refreshCell);
  const revision = useSession((s) => s.revision);

  // A new account or a changed record (an inspection created here) reloads what the cell holds.
  useEffect(() => {
    if (revision) refreshCell();
  }, [revision, refreshCell]);

  if (view !== "details" || !cell) return null;
  const ready = detail?.cell === cell ? detail : null;
  const tabs: { id: CellTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "crops", label: "Crops" },
    { id: "risk", label: "Risk" },
    { id: "alerts", label: "Alerts", count: ready?.alerts.length },
    { id: "reports", label: "Reports", count: ready?.reports_visible ? ready.reports.length : undefined },
    { id: "inspections", label: "Inspections", count: ready?.tasks_visible ? ready.tasks.length : undefined },
  ];

  return (
    <Surface
      raised
      role="dialog"
      aria-label="Cell details"
      className={cx(
        // Above the question bar (z-30), which would otherwise run across its foot.
        "absolute top-4 right-4 bottom-4 z-[35] flex w-[400px] flex-col overflow-hidden",
        "max-sm:fixed max-sm:inset-2 max-sm:z-40 max-sm:w-auto",
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-2 py-2.5 pr-2 pl-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] text-muted">H3 cell {cell} · resolution 7</p>
          <h2 className="text-[15px] font-semibold text-ink">{ready?.district ?? (ready ? "Outside the district outlines" : "Loading")}</h2>
        </div>
        <IconButton label="Close" side="left" onClick={closeCell} className="h-7 w-7">
          <X className="h-4 w-4" strokeWidth={2} />
        </IconButton>
      </header>
      <nav aria-label="Cell sections" className="scroll-quiet flex shrink-0 overflow-x-auto border-b border-line px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
            className={cx(
              "-mb-px shrink-0 border-b-2 px-1.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors",
              tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1 text-faint tabular-nums">{t.count}</span>}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {ready ? (
          <Tab tab={tab} detail={ready} />
        ) : status === "error" ? (
          <p className="px-4 py-8 text-center text-[12px] text-danger">{error}</p>
        ) : (
          <div className="flex justify-center py-10"><Spinner /></div>
        )}
      </div>
    </Surface>
  );
}

function Tab({ tab, detail }: { tab: CellTab; detail: CellDetail }) {
  if (tab === "crops") return <CropsTab detail={detail} />;
  if (tab === "risk") return <RiskTab detail={detail} />;
  if (tab === "alerts") return <AlertsTab detail={detail} />;
  if (tab === "reports") return <ReportsTab detail={detail} />;
  if (tab === "inspections") return <InspectionsTab detail={detail} />;
  return <OverviewTab detail={detail} />;
}

/* ------------------------------------------------------------------ overview & actions */

function OverviewTab({ detail }: { detail: CellDetail }) {
  const setTab = useMapStore((s) => s.setTab);
  const selectZone = useAgriStore((s) => s.select);
  const setPage = useSession((s) => s.setPage);
  const user = useSession((s) => s.user);
  const toast = useToast();
  const [target, setTarget] = useState<TaskTarget | null>(null);
  const inspectable = inspectionTarget(detail, user);
  const [lon, lat] = detail.center;

  return (
    <>
      <Block>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
          <Fact term="District">{detail.district ?? "–"}</Fact>
          <Fact term="Cell area">about {detail.area_km2} km²</Fact>
          <Fact term="Centre">{lat.toFixed(4)}° N, {lon.toFixed(4)}° E</Fact>
          <Fact term="Cropland">{percent(detail.cropland)} <span className="text-faint">(WorldCover 2021)</span></Fact>
          <Fact term="Main crop">
            {detail.dominant ? <>{cropLabel(detail.dominant)} {SHOW_LABELS && <Tag tone="warn">SAMPLE</Tag>}</> : "Not farmland"}
          </Fact>
          <Fact term="Zone risk">
            {detail.zone ? <LevelBadge level={detail.zone.level} /> : <span className="text-muted">Not monitored</span>}
          </Fact>
        </dl>
      </Block>

      <Block title="Actions">
        <div className="flex flex-col gap-1.5">
          <Action icon={<TriangleAlert className="h-4 w-4" />} onClick={() => setTab("alerts")}>
            View alerts ({detail.alerts.length})
          </Action>
          {detail.zone && (
            <Action icon={<ListChecks className="h-4 w-4" />} onClick={() => selectZone(detail.zone!.id)}>
              Why is this zone flagged? Weather, NDVI and pest signals
            </Action>
          )}
          {detail.reports_visible && (
            <Action icon={<ArrowRight className="h-4 w-4" />} onClick={() => setTab("reports")}>
              View reports in this cell ({detail.reports.length})
            </Action>
          )}
          {inspectable && (
            <Action primary icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => setTarget(inspectable)}>
              Create inspection
            </Action>
          )}
          {user?.role === "farmer" && (
            <Action icon={<ArrowRight className="h-4 w-4" />} onClick={() => setPage("report")}>Report an issue</Action>
          )}
          <Action
            icon={<Copy className="h-4 w-4" />}
            onClick={() => void navigator.clipboard?.writeText(detail.cell).then(() => toast("Cell id copied"), () => undefined)}
          >
            Copy cell id
          </Action>
        </div>
        {!inspectable && user && OFFICERS.includes(user.role) && (
          <p className="mt-2 text-[11px] leading-snug text-muted">
            An inspection starts from an alert or a farmer report; this cell has none open
            {covers(user, detail.district) ? "" : " in your jurisdiction"}.
          </p>
        )}
      </Block>

      <Block>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] leading-relaxed text-muted marker:text-faint">
          {detail.notes.map((n) => <li key={n}>{n}</li>)}
          <li>{detail.zone_note}</li>
        </ul>
      </Block>
      {target && <TaskDialog target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

/** The first open record an officer covering this district could inspect: a report before an alert. */
function inspectionTarget(detail: CellDetail, user: ReturnType<typeof useSession.getState>["user"]): TaskTarget | null {
  if (!user || !OFFICERS.includes(user.role)) return null;
  const report = detail.reports.find((r) => !r.task_id && r.status !== "DISMISSED" && covers(user, r.district));
  if (report) {
    return { kind: "report", id: report.id, title: `${CATEGORY_LABEL[report.category] ?? report.category} (${report.id})`,
             district: report.district, priority: "moderate", reasons: ["Farmer report, unverified, opened from the map."] };
  }
  const alert = detail.alerts.find((a) => a.status === "active" && covers(user, a.district));
  if (alert) {
    return { kind: "alert", id: alert.id, title: alert.title, district: alert.district, priority: alert.priority,
             reasons: [`Active ${alert.category} alert in ${alert.zone_name}, opened from the map.`] };
  }
  return null;
}

function covers(user: { districts: string[] }, district: string | null): boolean {
  return !user.districts.length || (district !== null && user.districts.includes(district));
}

/* ------------------------------------------------------------------ crops */

function CropsTab({ detail }: { detail: CellDetail }) {
  return (
    <>
      <Block title="Crop composition" tag={SHOW_LABELS ? <Tag tone="warn">SAMPLE</Tag> : undefined}>
        {detail.is_farmland ? (
          <>
            <MixBar detail={detail} />
            <ul className="mt-2 flex flex-col gap-1">
              {detail.crop_mix.map((s) => (
                <li key={s.crop} className="flex items-center gap-2 text-[12px] text-ink">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: cropColor(s.crop) }} />
                  <span className="flex-1">{cropLabel(s.crop)}</span>
                  <span className="text-muted tabular-nums">{percent(s.share)} of farmland</span>
                </li>
              ))}
            </ul>
            {SHOW_LABELS && (
              <p className="mt-2 rounded-[var(--radius-sm)] border border-warn/50 bg-warn/10 px-2.5 py-2 text-[11px] leading-relaxed text-ink">
                <strong className="font-semibold">SAMPLE, illustrative.</strong> No crop-type map or district crop statistics are
                loaded yet, so these shares are synthetic. Only where the farmland is comes from real data.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-muted">
            Cropland covers {percent(detail.cropland)} of this cell, below the share drawn as farmland, so no crops are shown.
          </p>
        )}
      </Block>
      <Block title="Land cover" tag={<Tag>ESA WorldCover 2021</Tag>}>
        {detail.landcover.length ? (
          <ul className="flex flex-col gap-1.5">
            {detail.landcover.map((c) => (
              <li key={c.cover} className="text-[12px] text-ink">
                <span className="flex justify-between"><span>{c.label}</span><span className="text-muted tabular-nums">{percent(c.share)}</span></span>
                <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-sunken">
                  <span className="block h-full rounded-full" style={{ width: `${c.share * 100}%`, background: LANDCOVER_COLOR[c.cover] }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted">No WorldCover data for this cell.</p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          A 2021 classification at 10 m. Hill shifting cultivation (jhum) is often classed as shrubland or grassland, and wet
          paddy as wetland, so farmland can be under-counted.
        </p>
      </Block>
    </>
  );
}

/* ------------------------------------------------------------------ risk */

function RiskTab({ detail }: { detail: CellDetail }) {
  const selectZone = useAgriStore((s) => s.select);
  const thresholdsNote = useAgriStore((s) => s.overview?.thresholds_note ?? null);
  const zone = detail.zone;
  if (!zone) {
    return (
      <Block>
        <p className="text-[13px] font-medium text-ink">Not monitored</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">{detail.zone_note} No assessment is not the same as no risk.</p>
      </Block>
    );
  }
  return (
    <>
      <Block>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <LevelBadge level={zone.level} className="self-start text-[12px]" />
            <p className="text-[12px] text-muted">{zone.rank ? `Priority #${zone.rank} of ${zone.rank_of} zones` : "Not ranked: not enough data"}</p>
          </div>
          <p className="text-right">
            <span className="text-[28px] leading-none font-semibold text-ink tabular-nums">{formatScore(zone.score)}</span>
            <span className="text-[12px] text-faint">/100</span>
          </p>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{zone.headline}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span>Confidence <strong className="font-semibold text-ink">{zone.confidence}</strong></span>
          <span className="inline-flex items-center gap-1.5">Data completeness <CompletenessBar fraction={zone.data_completeness} /></span>
        </div>
        {zone.top_factors.length > 0 && (
          <p className="mt-2 text-[12px] text-ink">
            Drivers: {zone.top_factors.map((f) => FACTOR_LABEL[f as FactorId] ?? f).join(", ")}
          </p>
        )}
        <div className="mt-3"><PlaceholderNotice note={thresholdsNote} compact /></div>
      </Block>
      <Block>
        <p className="text-[12px] leading-relaxed text-muted">{detail.zone_note}</p>
        <Button variant="outline" size="sm" className="mt-2.5" onClick={() => selectZone(zone.id)}>
          Open the full explanation <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Button>
      </Block>
    </>
  );
}

/* ------------------------------------------------------------------ records */

function AlertsTab({ detail }: { detail: CellDetail }) {
  const setPage = useSession((s) => s.setPage);
  if (!detail.alerts.length) {
    return <Empty>{detail.zone ? "No active alerts for this cell's zone." : "Alerts are derived for monitored zones only; this cell is in none."}</Empty>;
  }
  return (
    <>
      <ul>
        {detail.alerts.map((a) => <AlertItem key={a.id} alert={a} />)}
      </ul>
      <Block>
        <Button variant="outline" size="sm" onClick={() => setPage("watch")}>
          Open the Alerts page <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Button>
      </Block>
    </>
  );
}

function AlertItem({ alert }: { alert: Alert }) {
  const user = useSession((s) => s.user);
  const [target, setTarget] = useState<TaskTarget | null>(null);
  const canInspect = user && OFFICERS.includes(user.role) && covers(user, alert.district) && alert.status === "active";
  return (
    <li className="border-b border-line px-4 py-3">
      <p className="text-[13px] font-medium text-ink">{alert.title}</p>
      <p className="mt-1 flex flex-wrap gap-1">
        <PriorityChip priority={alert.priority} />
        <EvidenceChip status={alert.evidence_status} />
        {(SHOW_LABELS || alert.rule_status !== "DEMO") && <Chip title="Rule status">{alert.rule_status}</Chip>}
        {alert.status === "acknowledged" && <Chip>Acknowledged</Chip>}
        {alert.is_demo && <DemoChip />}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{alert.summary}</p>
      <p className="mt-1 text-[11px] text-faint">Valid until {when(alert.valid_until)} · zone {alert.zone_name}</p>
      {canInspect && (
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setTarget({
          kind: "alert", id: alert.id, title: alert.title, district: alert.district, priority: alert.priority,
          reasons: [`Active ${alert.category} alert in ${alert.zone_name}, opened from the map.`],
        })}>
          <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} /> Create inspection
        </Button>
      )}
      {target && <TaskDialog target={target} onClose={() => setTarget(null)} />}
    </li>
  );
}

function ReportsTab({ detail }: { detail: CellDetail }) {
  const user = useSession((s) => s.user);
  if (!detail.reports_visible) {
    return <Empty>{!user ? "Farmer reports are private. Choose an account to see the ones you may." : "Field officers see reports through their assigned inspections."}</Empty>;
  }
  if (!detail.reports.length) return <Empty>No reports you may see in this cell.</Empty>;
  return <ul>{detail.reports.map((r) => <ReportItem key={r.id} report={r} />)}</ul>;
}

function ReportItem({ report }: { report: FarmerReport }) {
  const user = useSession((s) => s.user);
  const [target, setTarget] = useState<TaskTarget | null>(null);
  const canInspect = user && OFFICERS.includes(user.role) && covers(user, report.district) && !report.task_id && report.status !== "DISMISSED";
  return (
    <li className="border-b border-line px-4 py-3">
      <p className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink">
        <span>{CATEGORY_LABEL[report.category] ?? report.category}</span>
        <span className="font-mono text-[11px] text-muted">{report.id}</span>
      </p>
      <p className="mt-1 flex flex-wrap gap-1">
        <EvidenceChip status={report.evidence_status} />
        <Chip>{REPORT_STATUS_LABEL[report.status] ?? report.status}</Chip>
        {report.is_demo && <DemoChip />}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink">{report.description}</p>
      <p className="mt-1 text-[11px] text-faint">
        {REPORT_CROP_LABEL[report.crop] ?? report.crop} · {when(report.submitted_at)} · {report.reporter_name}
      </p>
      {canInspect && (
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setTarget({
          kind: "report", id: report.id, title: `${CATEGORY_LABEL[report.category] ?? report.category} (${report.id})`,
          district: report.district, priority: "moderate", reasons: ["Farmer report, unverified, opened from the map."],
        })}>
          <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} /> Create inspection
        </Button>
      )}
      {target && <TaskDialog target={target} onClose={() => setTarget(null)} />}
    </li>
  );
}

function InspectionsTab({ detail }: { detail: CellDetail }) {
  const user = useSession((s) => s.user);
  if (!detail.tasks_visible) {
    return <Empty>{!user ? "Inspections are visible to officers. Choose an account." : "Farmers follow inspections through My reports."}</Empty>;
  }
  if (!detail.tasks.length) return <Empty>No inspections you may see in this cell.</Empty>;
  return <ul>{detail.tasks.map((t) => <TaskItem key={t.id} task={t} />)}</ul>;
}

function TaskItem({ task }: { task: InspectionTask }) {
  return (
    <li className="border-b border-line px-4 py-3">
      <p className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink">
        <span className="min-w-0 truncate">{task.reason}</span>
        <span className="font-mono text-[11px] text-muted">{task.id}</span>
      </p>
      <p className="mt-1 flex flex-wrap gap-1">
        <PriorityChip priority={task.priority} />
        <Chip>{TASK_STATUS_LABEL[task.status] ?? task.status}</Chip>
        {task.is_demo && <DemoChip />}
      </p>
      <p className="mt-1.5 text-[11px] text-faint">
        {task.assigned_to_name ? `Assigned to ${task.assigned_to_name}` : "Not assigned"}
        {task.due_on ? ` · due ${task.due_on}` : ""}
      </p>
      {task.outcome && (
        <p className="mt-1 text-[12px] text-ink">
          Outcome: <strong className="font-semibold">{OUTCOME_LABEL[task.outcome.result] ?? task.outcome.result}</strong>
          <span className="text-muted"> (field-observed by an officer, not a laboratory diagnosis)</span>
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ layout bits */

function Block({ title, tag, children }: { title?: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3 last:border-b-0">
      {title && (
        <h3 className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
          {title}
          {tag}
        </h3>
      )}
      {children}
    </section>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="flex flex-wrap items-center gap-1.5 text-ink">{children}</dd>
    </>
  );
}

function Action({ icon, children, onClick, primary }: { icon: ReactNode; children: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-[12px] font-medium transition-colors",
        primary ? "border-accent bg-accent text-accent-ink hover:brightness-110" : "border-line text-ink hover:bg-hover",
      )}
    >
      <span className={primary ? "" : "text-muted"}>{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-6 py-10 text-center text-[12px] leading-relaxed text-muted">{children}</p>;
}
