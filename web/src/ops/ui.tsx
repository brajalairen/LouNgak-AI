/** Shared pieces of the field-operations pages. Every priority, evidence status and DEMO label is
 *  printed in words next to any colour, so nothing depends on colour alone. */

import { useEffect, useState, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { ApiError } from "../state/api";
import type { Priority } from "../state/types";
import { cx } from "../ui/primitives";
import { useSession } from "../shell/useSession";

export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", moderate: "Moderate", high: "High", urgent: "Urgent" };
const PRIORITY_TONE: Record<Priority, string> = {
  low: "border-line-strong text-muted",
  moderate: "border-warn/60 text-warn",
  high: "border-danger/60 text-danger",
  urgent: "border-danger bg-danger/10 text-danger",
};

export const EVIDENCE_LABEL: Record<string, string> = {
  forecast: "Forecast",
  rule_triggered: "Rule-triggered (model)",
  satellite_observed: "Satellite-observed",
  farmer_reported: "Farmer-reported",
  farmer_reported_unverified: "Farmer-reported, unverified",
  field_verified: "Officer-verified",
  field_observed_officer: "Field-observed by officer",
  official_warning: "Official warning",
};

export const CATEGORY_LABEL: Record<string, string> = {
  pest: "Suspected pest problem",
  disease: "Suspected disease / symptoms",
  crop_damage: "Crop damage or unusual condition",
  waterlogging: "Waterlogging / flooding",
  weather_damage: "Weather damage (hail, rain, wind)",
  other: "Other concern",
};

export const CROP_LABEL: Record<string, string> = {
  rice: "Rice",
  chakhao: "Chak-hao (black rice)",
  maize: "Maize",
  other: "Other",
  unknown: "Not known",
};

export const REPORT_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Received",
  UNDER_REVIEW: "Under review",
  INSPECTION_ASSIGNED: "Inspection assigned",
  INSPECTED: "Inspected",
  FOLLOW_UP: "Follow-up needed",
  DISMISSED: "Closed without inspection",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  NEW: "Approved, not assigned",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const OUTCOME_LABEL: Record<string, string> = {
  CONCERN_OBSERVED: "Concern observed",
  CONCERN_NOT_OBSERVED: "Concern not observed",
  INCONCLUSIVE: "Inconclusive",
  DIFFERENT_ISSUE: "Different issue observed",
  FOLLOW_UP_REQUIRED: "Follow-up required",
};

/** The 16 districts of Manipur (Local Government Directory names; satquery/agri/assets/manipur_district_names.json). */
export const DISTRICTS = [
  "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong",
  "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul",
];

export function Chip({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-[4px] border px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
        className ?? "border-line-strong text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: Priority }) {
  return <Chip className={PRIORITY_TONE[priority]} title="Operational priority">{PRIORITY_LABEL[priority]} priority</Chip>;
}

export function EvidenceChip({ status }: { status: string }) {
  return <Chip className="border-accent/50 text-accent" title="Evidence status">{EVIDENCE_LABEL[status] ?? status}</Chip>;
}

export function DemoChip() {
  return (
    <Chip className="border-warn/60 bg-warn/10 text-warn" title="Demonstration record, not real data">
      <FlaskConical className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
      Demo
    </Chip>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-[var(--radius-card)] border border-line bg-surface p-4", className)}>{children}</div>;
}

/** A page body: scrolls on its own, readable width, phone-friendly gutters. */
export function PageBody({ title, intro, children, wide }: { title: string; intro?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto bg-sunken">
      <div className={cx("mx-auto px-4 py-5 sm:px-6", wide ? "max-w-6xl" : "max-w-3xl")}>
        <h1 className="text-[20px] font-semibold text-ink">{title}</h1>
        {intro && <div className="mt-1 text-[13px] leading-relaxed text-muted">{intro}</div>}
        <div className="mt-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "info" }) {
  return (
    <div
      role="note"
      className={cx(
        "rounded-[var(--radius-sm)] border px-3 py-2 text-[12px] leading-relaxed text-ink",
        tone === "warn" ? "border-warn/50 bg-warn/10" : "border-line bg-surface",
      )}
    >
      {children}
    </div>
  );
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="text-[12px] text-danger">{error}</p>;
}

export function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Load something for the current account; reloads when the account changes or any record changes.
 *  `load` must be stable (an `api.*` function, or wrapped in useCallback), or it reloads every render. */
export function useLoad<T>(load: () => Promise<T>, enabled = true) {
  const revision = useSession((s) => s.revision);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setLoading(true);
    load()
      .then((value) => {
        if (live) {
          setData(value);
          setError(null);
        }
      })
      .catch((e) => live && setError(errorText(e, "Could not load this page.")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [load, revision, enabled]);

  return { data, error, loading };
}

export const fieldClass =
  "w-full rounded-[var(--radius-sm)] border border-line bg-surface px-2.5 py-2 text-[13px] text-ink " +
  "placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none";
