/** A farmer's own reports and their progress. The server removes officers' internal notes before
 *  these reach the farmer; what is shown is the status history and the outcome summary meant for them. */

import { api } from "../state/api";
import { Button } from "../ui/primitives";
import { useSession } from "../shell/useSession";
import {
  Card, Chip, CATEGORY_LABEL, CROP_LABEL, DemoChip, ErrorLine, EvidenceChip, Notice, PageBody, REPORT_STATUS_LABEL,
  useLoad, when,
} from "../ops/ui";
import { History } from "./FieldOpsPage";

const STEPS = ["SUBMITTED", "UNDER_REVIEW", "INSPECTION_ASSIGNED", "INSPECTED"];

export function MyReportsPage() {
  const setPage = useSession((s) => s.setPage);
  const { data, error } = useLoad(api.reports);
  return (
    <PageBody title="My reports" intro="Follow what happens to the issues you reported.">
      <ErrorLine error={error} />
      {data && !data.length && (
        <Card>
          <p className="text-[13px] text-muted">You have not reported anything yet.</p>
          <Button variant="primary" className="mt-2" onClick={() => setPage("report")}>Report an issue</Button>
        </Card>
      )}
      {data?.map((r) => {
        const reached = STEPS.indexOf(r.status === "FOLLOW_UP" ? "INSPECTED" : r.status);
        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip className="border-accent/50 text-accent">{REPORT_STATUS_LABEL[r.status]}</Chip>
              <EvidenceChip status={r.evidence_status} />
              {r.is_demo && <DemoChip />}
            </div>
            <h3 className="mt-2 text-[14px] font-semibold text-ink">{CATEGORY_LABEL[r.category]} · {CROP_LABEL[r.crop]}</h3>
            <p className="text-[12px] text-muted">{r.id} · {r.district} · sent {when(r.submitted_at)}</p>
            <p className="mt-1 text-[13px] text-ink">{r.description}</p>
            {r.status !== "DISMISSED" && (
              <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Progress">
                {STEPS.map((s, i) => (
                  <li key={s} className="text-center">
                    <span className={`block h-1.5 rounded-full ${i <= reached ? "bg-accent" : "bg-line"}`} />
                    <span className="mt-1 block text-[10px] leading-tight text-muted">{REPORT_STATUS_LABEL[s]}</span>
                  </li>
                ))}
              </ol>
            )}
            {r.public_outcome && (
              <Notice tone="info">
                <strong>Inspection result:</strong> {r.public_outcome}
                <span className="block text-[11px] text-muted">An agricultural officer's field observation, not a laboratory diagnosis.</span>
              </Notice>
            )}
            <History items={r.history} />
          </Card>
        );
      })}
    </PageBody>
  );
}
