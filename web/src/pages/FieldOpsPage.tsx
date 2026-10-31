/** Field Operations for district and state-level officers: the review queue (farmer reports and alerts,
 *  each with the reasons for its place), inspection tasks, every report in the jurisdiction, and a
 *  per-zone summary. The system suggests an order; the officer decides, and every decision is recorded. */

import { useState } from "react";
import { api } from "../state/api";
import { SHOW_LABELS } from "../ui/presentation";
import type { FarmerReport, InspectionTask, QueueItem } from "../state/types";
import { Button, Segmented } from "../ui/primitives";
import { useSession } from "../shell/useSession";
import { TaskDialog, type TaskTarget } from "../ops/TaskDialog";
import {
  Card, Chip, CATEGORY_LABEL, CROP_LABEL, DemoChip, ErrorLine, errorText, EvidenceChip, fieldClass, Notice,
  OUTCOME_LABEL, PageBody, PriorityChip, REPORT_STATUS_LABEL, TASK_STATUS_LABEL, useLoad, when,
} from "../ops/ui";

type Tab = "queue" | "tasks" | "reports" | "zones";

export function FieldOpsPage() {
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<Tab>("queue");
  const queue = useLoad(api.queue);
  const tasks = useLoad(api.tasks);
  const reports = useLoad(api.reports);
  const zones = useLoad(api.situation);

  return (
    <PageBody
      wide
      title="Field Operations"
      intro={<>Review queue, inspections and reports for {user?.districts.length ? user.districts.join(", ") : "all districts"}. The order is a suggestion with its reasons; you decide.</>}
    >
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "queue", label: `Review queue${queue.data ? ` · ${queue.data.length}` : ""}` },
          { value: "tasks", label: `Inspections${tasks.data ? ` · ${tasks.data.length}` : ""}` },
          { value: "reports", label: "All reports" },
          { value: "zones", label: "By zone" },
        ]}
      />
      {tab === "queue" && <Queue items={queue.data} error={queue.error} />}
      {tab === "tasks" && <Tasks tasks={tasks.data} error={tasks.error} />}
      {tab === "reports" && <Reports reports={reports.data} error={reports.error} />}
      {tab === "zones" && (
        <Card className="overflow-x-auto p-0">
          <ErrorLine error={zones.error} />
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead className="border-b border-line text-[11px] text-muted uppercase">
              <tr>
                <th className="px-3 py-2">Zone</th><th className="px-3 py-2">Alerts</th><th className="px-3 py-2">Open reports</th>
                <th className="px-3 py-2">Open inspections</th><th className="px-3 py-2">Completed</th><th className="px-3 py-2">Outcomes</th>
              </tr>
            </thead>
            <tbody>
              {(zones.data ?? []).map((z) => (
                <tr key={z.zone_id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink">{z.zone_name}<span className="block text-[11px] text-muted">{z.district}</span></td>
                  <td className="px-3 py-2">{Object.entries(z.alerts_by_category).filter(([, n]) => n).map(([c, n]) => `${c.replace("_", " ")} ${n}`).join(", ") || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{z.reports_open}</td>
                  <td className="px-3 py-2 tabular-nums">{z.tasks_open}</td>
                  <td className="px-3 py-2 tabular-nums">{z.tasks_completed}</td>
                  <td className="px-3 py-2">{Object.entries(z.outcomes).map(([o, n]) => `${OUTCOME_LABEL[o] ?? o} ${n}`).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-faint">A summary over separate records, not a combined risk score.</p>
        </Card>
      )}
    </PageBody>
  );
}

function Queue({ items, error }: { items: QueueItem[] | null; error: string | null }) {
  const [task, setTask] = useState<TaskTarget | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  if (error) return <ErrorLine error={error} />;
  if (!items) return <p className="text-[13px] text-muted">Loading the queue…</p>;
  if (!items.length) return <Card><p className="text-[13px] text-muted">Nothing awaits review in your jurisdiction.</p></Card>;
  return (
    <>
      {items.map((item, index) => (
        <Card key={`${item.kind}-${item.id}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-muted tabular-nums">#{index + 1}</span>
            <PriorityChip priority={item.priority} />
            <EvidenceChip status={item.evidence_status} />
            <Chip>{item.kind === "report" ? "Farmer report" : "Watch alert"}</Chip>
            {item.is_demo && <DemoChip />}
          </div>
          <h3 className="mt-2 text-[14px] font-semibold text-ink">{item.title}</h3>
          <p className="text-[12px] text-muted">
            {/* An alert id is an internal key built from the zone id; presentation mode names the kind instead. */}
            {item.kind === "alert" && !SHOW_LABELS ? "Alert" : item.id} · {item.district ?? "—"} · {when(item.created_at)}
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-ink">
            {item.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <Button variant="primary" size="sm" onClick={() => setTask({ kind: item.kind, id: item.id, title: item.title,
              district: item.district, priority: item.priority, reasons: item.reasons })}>
              Approve inspection
            </Button>
            {item.kind === "report" && (
              <>
                <MarkUnderReview id={item.id} />
                <Button variant="outline" size="sm" onClick={() => setDismissing(dismissing === item.id ? null : item.id)}>Dismiss…</Button>
              </>
            )}
          </div>
          {dismissing === item.id && <Dismiss id={item.id} onDone={() => setDismissing(null)} />}
        </Card>
      ))}
      {task && <TaskDialog target={task} onClose={() => setTask(null)} />}
    </>
  );
}

function MarkUnderReview({ id }: { id: string }) {
  const changed = useSession((s) => s.changed);
  return (
    <Button variant="outline" size="sm" onClick={async () => { await api.reviewReport(id, { action: "under_review" }); changed(); }}>
      Mark under review
    </Button>
  );
}

function Dismiss({ id, onDone }: { id: string; onDone: () => void }) {
  const changed = useSession((s) => s.changed);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try {
      await api.reviewReport(id, { action: "dismiss", public_note: reason });
      changed();
      onDone();
    } catch (e) {
      setError(errorText(e, "Could not dismiss the report."));
    }
  };
  return (
    <div className="mt-2 space-y-2">
      <textarea className={fieldClass} rows={2} placeholder="Reason the farmer will see (required)" value={reason}
                onChange={(e) => setReason(e.target.value)} />
      <ErrorLine error={error} />
      <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={submit}>Dismiss with this reason</Button>
    </div>
  );
}

function Tasks({ tasks, error }: { tasks: InspectionTask[] | null; error: string | null }) {
  const users = useSession((s) => s.users);
  const changed = useSession((s) => s.changed);
  if (error) return <ErrorLine error={error} />;
  if (!tasks) return <p className="text-[13px] text-muted">Loading inspections…</p>;
  if (!tasks.length) return <Card><p className="text-[13px] text-muted">No inspections yet. Approve one from the review queue.</p></Card>;
  return (
    <>
      {tasks.map((t) => (
        <Card key={t.id}>
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityChip priority={t.priority} />
            <Chip>{TASK_STATUS_LABEL[t.status]}</Chip>
            {t.outcome && <Chip className="border-ok/50 text-ok">{OUTCOME_LABEL[t.outcome.result]}</Chip>}
            {t.is_demo && <DemoChip />}
          </div>
          <h3 className="mt-2 text-[14px] font-semibold text-ink">{t.id}: {t.reason}</h3>
          <p className="text-[12px] text-muted">
            {t.district} · cell {t.h3_cell} · {t.assigned_to_name ? `assigned to ${t.assigned_to_name}` : "unassigned"}
            {t.due_on && ` · due ${t.due_on}`}
          </p>
          {t.status === "NEW" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {users.filter((u) => u.role === "field_officer" && (!u.districts.length || u.districts.includes(t.district))).map((u) => (
                <Button key={u.id} size="sm" variant="outline" onClick={async () => { await api.assignTask(t.id, u.id, t.due_on); changed(); }}>
                  Assign to {u.name}
                </Button>
              ))}
            </div>
          )}
          {t.outcome && (
            <div className="mt-2 rounded-[var(--radius-sm)] bg-sunken p-2 text-[12px] leading-relaxed text-ink">
              <p><strong>{OUTCOME_LABEL[t.outcome.result]}</strong> — recorded by {t.outcome.recorded_by_name}, {when(t.outcome.recorded_at)}.</p>
              <p>Crop {CROP_LABEL[t.outcome.observed_crop]}, condition {t.outcome.crop_condition.replace("_", " ")}
                {t.outcome.water_condition ? `, water ${t.outcome.water_condition}` : ""}.</p>
              {t.outcome.symptoms && <p>Symptoms: {t.outcome.symptoms}</p>}
              {t.outcome.suspected_issue && <p>Suspected (not a diagnosis): {t.outcome.suspected_issue}</p>}
              {t.outcome.follow_up && <p>Follow-up: {t.outcome.follow_up}</p>}
              <p className="mt-1 text-[11px] text-muted">An officer's field observation, not a laboratory-confirmed diagnosis.</p>
            </div>
          )}
          <History items={t.history} />
        </Card>
      ))}
    </>
  );
}

function Reports({ reports, error }: { reports: FarmerReport[] | null; error: string | null }) {
  if (error) return <ErrorLine error={error} />;
  if (!reports) return <p className="text-[13px] text-muted">Loading reports…</p>;
  if (!reports.length) return <Card><p className="text-[13px] text-muted">No farmer reports in your jurisdiction.</p></Card>;
  return (
    <>
      <Notice>Farmer reports are unverified until an officer inspects them.</Notice>
      {reports.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>{REPORT_STATUS_LABEL[r.status]}</Chip>
            <EvidenceChip status={r.evidence_status} />
            {r.is_demo && <DemoChip />}
          </div>
          <h3 className="mt-2 text-[14px] font-semibold text-ink">{r.id}: {CATEGORY_LABEL[r.category]} · {CROP_LABEL[r.crop]}</h3>
          <p className="text-[12px] text-muted">{r.reporter_name} · {r.district} · {when(r.submitted_at)} · cell {r.h3_cell}</p>
          <p className="mt-1 text-[13px] text-ink">{r.description}</p>
          {r.officer_notes.map((n) => (
            <p key={n.at} className="mt-1 text-[12px] text-muted">Internal note ({n.by_name}): {n.text}</p>
          ))}
          <History items={r.history} />
        </Card>
      ))}
    </>
  );
}

export function History({ items }: { items: { status: string; at: string; by_name: string; note: string | null }[] }) {
  return (
    <ol className="mt-2 space-y-1 border-l border-line pl-3 text-[11px] text-muted">
      {items.map((h, i) => (
        <li key={`${h.at}-${i}`}>
          <span className="font-semibold text-ink">{REPORT_STATUS_LABEL[h.status] ?? TASK_STATUS_LABEL[h.status] ?? h.status}</span>
          {" · "}{when(h.at)} · {h.by_name}{h.note ? ` — ${h.note}` : ""}
        </li>
      ))}
    </ol>
  );
}
