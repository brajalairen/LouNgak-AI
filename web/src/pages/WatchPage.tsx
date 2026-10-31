/** LouNgak Watch: alerts by category, each with its priority, evidence status, rule status and
 *  limitations side by side. Officers acknowledge alerts or turn them into field inspections; the
 *  public and farmers see the same evidence in plainer framing, without the officer actions. */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../state/api";
import { SHOW_LABELS } from "../ui/presentation";
import type { Alert, AlertCategory } from "../state/types";
import { Button, cx } from "../ui/primitives";
import { useSession } from "../shell/useSession";
import { TaskDialog, type TaskTarget } from "../ops/TaskDialog";
import {
  Card, Chip, DemoChip, ErrorLine, errorText, EvidenceChip, Notice, PageBody, PriorityChip, useLoad, when,
} from "../ops/ui";

const RULE_TONE: Record<Alert["rule_status"], string> = {
  SOURCED: "border-ok/50 text-ok",
  PLACEHOLDER: "border-warn/50 text-warn",
  UNVALIDATED: "border-warn/50 text-warn",
  DEMO: "border-warn/60 bg-warn/10 text-warn",
};

export function WatchPage() {
  const user = useSession((s) => s.user);
  const setPage = useSession((s) => s.setPage);
  const { data, error, loading } = useLoad(api.watch);
  const [category, setCategory] = useState<AlertCategory | "all">("all");
  const officer = user?.role === "district_officer" || user?.role === "state_officer";
  const community = !user || user.role === "farmer";

  const alerts = (data?.alerts ?? []).filter((a) => category === "all" || a.category === category);
  const nearby = user?.role === "farmer" ? new Set(user.districts) : null;

  return (
    <PageBody
      wide
      title={community ? "Local alerts" : "LouNgak Watch"}
      intro={community
        ? "Weather, crop-health and pest or disease alerts for monitored farmland in Manipur. They point to where a closer look may help; they are not official warnings or diagnoses."
        : "Alerts by category, derived from the monitored zones' weather and satellite evidence. Priority, evidence status and rule status are shown separately."}
    >
      {user?.role === "farmer" && (
        <Notice tone="info">
          Noticed a problem in your field? <button type="button" className="font-semibold text-accent underline" onClick={() => setPage("report")}>Report an issue</button>{" "}
          and an agricultural officer will review it.
        </Notice>
      )}
      {data && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <FilterButton active={category === "all"} onClick={() => setCategory("all")}>
            All · {data.alerts.length}
          </FilterButton>
          {(Object.keys(data.categories) as AlertCategory[]).map((c) => (
            <FilterButton key={c} active={category === c} onClick={() => setCategory(c)}>
              {data.categories[c]} · {data.counts[c] ?? 0}
            </FilterButton>
          ))}
        </div>
      )}
      <ErrorLine error={error} />
      {loading && !data && <p className="text-[13px] text-muted">Loading alerts… the first assessment after a server start can take a minute.</p>}
      {data && alerts.length === 0 && (
        <Card><p className="text-[13px] text-muted">No active alerts in this category. Absence of an alert is not proof that all is well: it means no rule was triggered by the available evidence.</p></Card>
      )}
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} officer={officer} near={nearby?.has(alert.district ?? "") ?? false} />
      ))}
      {data && (
        <div className="space-y-1 pt-2 text-[11px] leading-relaxed text-faint">
          {data.notes.map((n) => <p key={n}>{n}</p>)}
          <p>Computed {when(data.computed_at)} ({data.assessment_mode}).</p>
        </div>
      )}
    </PageBody>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

function AlertCard({ alert, officer, near }: { alert: Alert; officer: boolean; near: boolean }) {
  const user = useSession((s) => s.user);
  const changed = useSession((s) => s.changed);
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<TaskTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = officer && (!user?.districts.length || user.districts.includes(alert.district ?? ""));

  const acknowledge = async () => {
    try {
      await api.acknowledgeAlert(alert.id);
      changed();
    } catch (e) {
      setError(errorText(e, "Could not acknowledge the alert."));
    }
  };

  return (
    <Card className={cx(alert.status === "acknowledged" && "opacity-80")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityChip priority={alert.priority} />
        <EvidenceChip status={alert.evidence_status} />
        {(SHOW_LABELS || alert.rule_status !== "DEMO") && (
          <Chip className={RULE_TONE[alert.rule_status]} title="How far the rule behind this alert is validated">
            Rule {alert.rule_status.toLowerCase()}
          </Chip>
        )}
        {alert.gate === "qualified_watch" && <Chip title="Published with its limitations stated">Qualified watch</Chip>}
        {alert.is_demo && <DemoChip />}
        {near && <Chip className="border-accent/50 text-accent">Your district</Chip>}
        {alert.status === "acknowledged" && <Chip>Acknowledged</Chip>}
      </div>
      <h3 className="mt-2 text-[15px] font-semibold text-ink">{alert.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink">{alert.summary}</p>
      <p className="mt-1 text-[12px] text-muted">
        {alert.district ?? "—"} · {alert.zone_name} · valid until {when(alert.valid_until)}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink"><strong className="font-semibold">Suggested next step:</strong> {alert.recommended_action}</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent"
        aria-expanded={open}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Evidence, limitations and sources
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[12px] leading-relaxed">
          <Section title="Evidence" items={alert.evidence} />
          <Section title="Limitations" items={alert.limitations} />
          <Section
            title="Sources"
            items={alert.provenance.map((p) => `${p.source} — ${p.state}${p.retrieved_at ? `, retrieved ${when(p.retrieved_at)}` : ""}${p.licence ? ` (${p.licence})` : ""}`)}
          />
          <p className="text-faint">Rule: {alert.rule_id} · alert id {alert.id}</p>
        </div>
      )}

      {mine && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setTask({ kind: "alert", id: alert.id, title: alert.title, district: alert.district,
                                     priority: alert.priority, reasons: [`${alert.title} (${alert.evidence_status.replace("_", " ")}).`] })}
          >
            Create inspection
          </Button>
          {alert.status === "active" && <Button variant="outline" size="sm" onClick={acknowledge}>Acknowledge</Button>}
          {alert.acknowledged_by && <span className="self-center text-[11px] text-muted">by {alert.acknowledged_by}, {when(alert.acknowledged_at)}</span>}
        </div>
      )}
      <ErrorLine error={error} />
      {task && <TaskDialog target={task} onClose={() => setTask(null)} />}
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="font-semibold text-ink">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-muted">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
