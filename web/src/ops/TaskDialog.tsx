/** Approve an inspection for a report or an alert and assign it to a field officer who covers the
 *  district. The suggested priority and its reasons come from the queue; the officer may change the
 *  priority, and the reasons travel with the task so the field officer sees why it was raised. */

import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../state/api";
import type { Priority } from "../state/types";
import { Button, Field, IconButton, Surface } from "../ui/primitives";
import { useSession } from "../shell/useSession";
import { ErrorLine, errorText, fieldClass, PRIORITY_LABEL } from "./ui";

export interface TaskTarget {
  kind: "report" | "alert";
  id: string;
  title: string;
  district: string | null;
  priority: Priority;
  reasons: string[];
}

export function TaskDialog({ target, onClose }: { target: TaskTarget; onClose: () => void }) {
  const users = useSession((s) => s.users);
  const changed = useSession((s) => s.changed);
  const officers = users.filter(
    (u) => u.role === "field_officer" && (!u.districts.length || (target.district && u.districts.includes(target.district))),
  );
  const [reason, setReason] = useState(
    target.kind === "report" ? `Verify the farmer's report: ${target.title}.` : `Field check for: ${target.title}.`,
  );
  const [priority, setPriority] = useState<Priority>(target.priority);
  const [assignee, setAssignee] = useState(officers[0]?.id ?? "");
  const [due, setDue] = useState(() => new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createTask({
        report_ids: target.kind === "report" ? [target.id] : [],
        alert_ids: target.kind === "alert" ? [target.id] : [],
        reason,
        priority,
        priority_rationale: priority === target.priority ? target.reasons
          : [...target.reasons, `Priority set to ${PRIORITY_LABEL[priority].toLowerCase()} by the reviewing officer.`],
        assigned_to: assignee || null,
        due_on: due || null,
      });
      changed();
      onClose();
    } catch (e) {
      setError(errorText(e, "The inspection could not be created."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-modal="true">
      <Surface raised className="w-full max-w-md p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Approve a field inspection</h2>
            <p className="mt-0.5 text-[12px] text-muted">{target.title} · {target.district ?? "no district"}</p>
          </div>
          <IconButton label="Close" side="left" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="mt-3 space-y-3">
          <Field label="Reason for inspection">
            <textarea className={fieldClass} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label="Priority" hint="Suggested from the queue; your decision overrides it and is recorded.">
            <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(["low", "moderate", "high", "urgent"] as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </Field>
          <Field label="Assign to field officer" hint={officers.length ? undefined : "No demo field officer covers this district; the task is created unassigned."}>
            <select className={fieldClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Leave unassigned</option>
              {officers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Due by">
            <input type="date" className={fieldClass} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          {target.reasons.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted">
              {target.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
          <ErrorLine error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={busy || reason.trim().length < 3} onClick={submit}>
              {assignee ? "Approve and assign" : "Approve inspection"}
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}
