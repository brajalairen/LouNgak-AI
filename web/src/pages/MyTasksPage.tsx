/** The field officer's inspections: start a visit and record what was observed. The outcome is an
 *  officer's field observation; the form says so and asks for a suspicion, never a diagnosis. */

import { useState } from "react";
import { api } from "../state/api";
import type { CropCondition, CropId, InspectionTask, OutcomeCreate, OutcomeResult, WaterCondition } from "../state/types";
import { Button, Field } from "../ui/primitives";
import { useSession } from "../shell/useSession";
import {
  Card, Chip, CROP_LABEL, DemoChip, ErrorLine, errorText, fieldClass, Notice, OUTCOME_LABEL, PageBody, PriorityChip,
  TASK_STATUS_LABEL, useLoad,
} from "../ops/ui";
import { History } from "./FieldOpsPage";

const OUTCOME_HELP: Record<OutcomeResult, string> = {
  CONCERN_OBSERVED: "The condition that prompted the inspection was seen.",
  CONCERN_NOT_OBSERVED: "It was not seen at the time of the visit.",
  INCONCLUSIVE: "Not enough evidence to say either way.",
  DIFFERENT_ISSUE: "Something else was found instead.",
  FOLLOW_UP_REQUIRED: "Another visit or an expert assessment is needed.",
};

export function MyTasksPage() {
  const { data, error } = useLoad(api.tasks);
  const open = (data ?? []).filter((t) => t.status === "ASSIGNED" || t.status === "IN_PROGRESS");
  const done = (data ?? []).filter((t) => t.status === "COMPLETED");
  return (
    <PageBody title="My inspections" intro="Inspections assigned to you. Record what you observe in the field; your outcome is shown to the farmer who reported it.">
      <ErrorLine error={error} />
      {data && !open.length && <Card><p className="text-[13px] text-muted">No open inspections assigned to you.</p></Card>}
      {open.map((t) => <TaskCard key={t.id} task={t} />)}
      {done.length > 0 && <h2 className="pt-2 text-[13px] font-semibold text-muted uppercase">Completed</h2>}
      {done.map((t) => <TaskCard key={t.id} task={t} />)}
    </PageBody>
  );
}

function TaskCard({ task }: { task: InspectionTask }) {
  const changed = useSession((s) => s.changed);
  const [form, setForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    try {
      await api.startTask(task.id);
      changed();
      setForm(true);
    } catch (e) {
      setError(errorText(e, "Could not start the inspection."));
    }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityChip priority={task.priority} />
        <Chip>{TASK_STATUS_LABEL[task.status]}</Chip>
        {task.outcome && <Chip className="border-ok/50 text-ok">{OUTCOME_LABEL[task.outcome.result]}</Chip>}
        {task.is_demo && <DemoChip />}
      </div>
      <h3 className="mt-2 text-[14px] font-semibold text-ink">{task.id}: {task.reason}</h3>
      <p className="text-[12px] text-muted">
        {task.district} · {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)} · cell {task.h3_cell}
        {task.due_on && ` · due ${task.due_on}`}
      </p>
      <a className="text-[12px] font-medium text-accent underline" target="_blank" rel="noreferrer"
         href={`https://www.openstreetmap.org/?mlat=${task.latitude}&mlon=${task.longitude}#map=16/${task.latitude}/${task.longitude}`}>
        Open location in a map
      </a>
      {task.priority_rationale.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-ink">
          {task.priority_rationale.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {task.status === "ASSIGNED" && (
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <Button variant="primary" size="sm" onClick={start}>Start inspection</Button>
          <Button variant="outline" size="sm" onClick={() => setForm(true)}>Record outcome</Button>
        </div>
      )}
      {task.status === "IN_PROGRESS" && !form && (
        <div className="mt-3 border-t border-line pt-3">
          <Button variant="primary" size="sm" onClick={() => setForm(true)}>Record outcome</Button>
        </div>
      )}
      <ErrorLine error={error} />
      {form && task.status !== "COMPLETED" && <OutcomeForm task={task} onDone={() => setForm(false)} />}
      <History items={task.history} />
    </Card>
  );
}

function OutcomeForm({ task, onDone }: { task: InspectionTask; onDone: () => void }) {
  const changed = useSession((s) => s.changed);
  const [value, setValue] = useState<OutcomeCreate>({
    result: "CONCERN_OBSERVED", observed_crop: (["rice", "chakhao", "maize"].includes(task.crop) ? task.crop : "unknown") as CropId,
    growth_stage: null, crop_condition: "normal", symptoms: null, suspected_issue: null, water_condition: null,
    action_taken: null, follow_up: null, public_summary: "", gps_latitude: null, gps_longitude: null, gps_accuracy_m: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof OutcomeCreate>(key: K, v: OutcomeCreate[K]) => setValue((s) => ({ ...s, [key]: v }));
  const text = (v: string) => (v.trim() ? v : null);

  const gps = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setValue((s) => ({ ...s, gps_latitude: p.coords.latitude, gps_longitude: p.coords.longitude,
                                 gps_accuracy_m: Math.round(p.coords.accuracy) })),
      () => setError("Location permission was not given; the outcome can be saved without it."),
    );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.recordOutcome(task.id, value);
      changed();
      onDone();
    } catch (e) {
      setError(errorText(e, "The outcome could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <Notice tone="info">Record what you observed. This is an officer's field observation; a suspected pest or disease is not a confirmed diagnosis.</Notice>
      <fieldset>
        <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">Outcome</legend>
        <div className="space-y-1">
          {(Object.keys(OUTCOME_LABEL) as OutcomeResult[]).map((r) => (
            <label key={r} className="flex cursor-pointer items-start gap-2 text-[13px] text-ink">
              <input type="radio" name={`outcome-${task.id}`} className="mt-1" checked={value.result === r} onChange={() => set("result", r)} />
              <span><strong className="font-semibold">{OUTCOME_LABEL[r]}</strong> <span className="text-muted">— {OUTCOME_HELP[r]}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Crop observed">
          <select className={fieldClass} value={value.observed_crop} onChange={(e) => set("observed_crop", e.target.value as CropId)}>
            {Object.entries(CROP_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <Field label="Growth stage">
          <input className={fieldClass} placeholder="e.g. grain filling" onChange={(e) => set("growth_stage", text(e.target.value))} />
        </Field>
        <Field label="Crop condition">
          <select className={fieldClass} value={value.crop_condition} onChange={(e) => set("crop_condition", e.target.value as CropCondition)}>
            <option value="normal">Normal</option><option value="stressed">Stressed</option>
            <option value="damaged">Damaged</option><option value="not_visible">Could not see</option>
          </select>
        </Field>
        <Field label="Water">
          <select className={fieldClass} value={value.water_condition ?? ""} onChange={(e) => set("water_condition", (e.target.value || null) as WaterCondition | null)}>
            <option value="">Not recorded</option><option value="none">No standing water</option>
            <option value="waterlogged">Waterlogged</option><option value="flooded">Flooded</option><option value="dry">Dry</option>
          </select>
        </Field>
      </div>
      <Field label="Symptoms seen">
        <textarea className={fieldClass} rows={2} onChange={(e) => set("symptoms", text(e.target.value))} />
      </Field>
      <Field label="Suspected issue (a suspicion, not a diagnosis)">
        <input className={fieldClass} onChange={(e) => set("suspected_issue", text(e.target.value))} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Advice given / action taken">
          <input className={fieldClass} onChange={(e) => set("action_taken", text(e.target.value))} />
        </Field>
        <Field label="Follow-up needed">
          <input className={fieldClass} onChange={(e) => set("follow_up", text(e.target.value))} />
        </Field>
      </div>
      <Field label="Message for the farmer (required)" hint="A short, plain summary. Internal remarks do not belong here.">
        <textarea className={fieldClass} rows={2} value={value.public_summary} onChange={(e) => set("public_summary", e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={gps}>Attach my GPS location</Button>
        {value.gps_latitude !== null && (
          <span className="text-[12px] text-muted">{value.gps_latitude.toFixed(5)}, {value.gps_longitude?.toFixed(5)} (±{value.gps_accuracy_m} m)</span>
        )}
      </div>
      <ErrorLine error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button variant="primary" disabled={busy || value.public_summary.trim().length < 3} onClick={submit}>Save outcome</Button>
      </div>
    </div>
  );
}
