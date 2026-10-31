/** Map layers: every layer's switch with its legend beside it, the base map, and what the data is built
 *  from. It replaces the old legend strip and layers popover, so a colour and its meaning are always read
 *  in one place. Presentation only: hiding a layer never changes a figure.
 *
 *  Each layer states its status the same way the rest of the app does: crop types are SAMPLE, cropland is
 *  ESA WorldCover (sourced), district outlines are OpenStreetMap reference outlines unless verified ones are
 *  configured, and risk is the monitored zones' engine output with its prototype labels. */

import { useState, type ReactNode } from "react";
import { ChevronDown, Layers, X } from "lucide-react";
import { BASEMAPS } from "../map/basemap";
import { useAppStore } from "../state/useAppStore";
import { useSession } from "../shell/useSession";
import { useAgriStore } from "../agri/useAgriStore";
import { formatTime, LEVEL_COLOR, LEVEL_LABEL, LEVELS } from "../agri/format";
import { StateChip } from "../agri/badges";
import { cx, IconButton, Segmented, Surface } from "../ui/primitives";
import type { LayerSource } from "../state/types";
import { setShowLabels, SHOW_LABELS } from "../ui/presentation";
import { CROP_COLOR, CROP_LABEL, inPeriod } from "./format";
import { ALERT_COLOR, REPORT_COLOR, TASK_COLOR } from "./PinsLayer";
import { useMapStore, type MapLayers } from "./useMapStore";

export function LayerPanel() {
  const open = useMapStore((s) => s.panelOpen);
  const setOpen = useMapStore((s) => s.setPanelOpen);
  const covered = useMapStore((s) => s.view === "details");
  // An imagery answer's card opens in the same corner: fold to the button rather than overlap it.
  const answerShown = useAppStore((s) => s.result !== null);

  if (!open || answerShown) {
    return (
      <Surface className="pointer-events-auto absolute top-4 right-4 z-20 p-0">
        <IconButton label="Map layers and legend" side="left" onClick={() => setOpen(true)}>
          <Layers className="h-4 w-4" strokeWidth={2} />
        </IconButton>
      </Surface>
    );
  }
  return (
    <Surface
      raised
      aria-label="Map layers"
      className={cx(
        "absolute top-4 right-4 z-20 flex max-h-[calc(100%-9rem)] w-[272px] flex-col overflow-hidden",
        "max-md:fixed max-md:inset-x-2 max-md:top-auto max-md:bottom-2 max-md:z-40 max-md:max-h-[72vh] max-md:w-auto",
        covered && "md:invisible",
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-line py-1.5 pr-1.5 pl-3.5">
        <h2 className="text-[13px] font-semibold text-ink">Map layers</h2>
        <IconButton label="Hide map layers" side="left" onClick={() => setOpen(false)} className="h-7 w-7">
          <X className="h-4 w-4" strokeWidth={2} />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Body />
      </div>
    </Surface>
  );
}

function Body() {
  const data = useMapStore((s) => s.data);
  const layers = useMapStore((s) => s.layers);
  const toggle = useMapStore((s) => s.toggleLayer);
  const pins = useMapStore((s) => s.pins);
  const period = useMapStore((s) => s.period);
  const user = useSession((s) => s.user);
  const overview = useAgriStore((s) => s.overview);
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const modelIsFake = useAppStore((s) => s.modelIsFake);
  const activeAlerts = pins.alerts.filter((a) => a.status === "active").length;
  const reports = pins.reports.filter((r) => inPeriod(r.submitted_at, period)).length;
  const tasks = pins.tasks.filter((t) => inPeriod(t.created_at, period)).length;

  return (
    <>
      <Group layer="crops" title="Agricultural areas" checked={layers.crops} onToggle={toggle}
             tag={SHOW_LABELS ? <Tag tone="warn" title={data?.crops.note}>SAMPLE crop types</Tag> : undefined}>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {(data?.crop_legend ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 text-[11px] text-ink" title={c.examples}>
              <Swatch color={CROP_COLOR[c.id] ?? CROP_COLOR.mixed!} />
              {CROP_LABEL[c.id] ?? c.label}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          Cropland from ESA WorldCover 2021: a stronger colour means more farmland.
          {SHOW_LABELS && " Which crop: illustrative SAMPLE pattern, not survey data."}
        </p>
      </Group>

      <Group layer="risk" title="Risk overlay" checked={layers.risk} onToggle={toggle}
             tag={<Tag title="Scored per monitored zone by the risk engine">Monitored zones</Tag>}>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {LEVELS.map((level) => (
            <li key={level} className="flex items-center gap-1.5 text-[11px] text-ink">
              <span aria-hidden="true" className="h-2.5 w-3.5 rounded-[2px] border-2" style={{ borderColor: LEVEL_COLOR[level] }} />
              {LEVEL_LABEL[level]}
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-[11px] text-ink">
            <span aria-hidden="true" className="h-0 w-3.5 border-t-2 border-dashed border-ink" />
            {SHOW_LABELS ? "Demo zone edge" : "Zone edge"}
          </li>
        </ul>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          A cell shows its zone's level{layers.crops ? " as an outline" : ""}; cells are not scored on their own. No colour
          means not monitored, not "no risk".
        </p>
      </Group>

      <div className="border-b border-line py-1">
        <Row layer="alerts" label="Alerts" checked={layers.alerts} onToggle={toggle} count={activeAlerts}
             icon={<Triangle color={ALERT_COLOR.high} />} />
        <Row layer="reports" label="Farmer reports" checked={layers.reports} onToggle={toggle}
             count={user && user.role !== "field_officer" ? reports : null}
             note={!user ? "Choose an account to see reports" : user.role === "field_officer" ? "Seen through your inspections" : undefined}
             icon={<span aria-hidden="true" className="h-3 w-3 rounded-full border-[2.5px] bg-white" style={{ borderColor: REPORT_COLOR }} />} />
        <Row layer="inspections" label="Inspections" checked={layers.inspections} onToggle={toggle}
             count={user && user.role !== "farmer" ? tasks : null}
             note={!user ? "Choose an account to see inspections" : user.role === "farmer" ? "Follow them in My reports" : undefined}
             icon={<span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 border border-white" style={{ background: TASK_COLOR }} />} />
        <Row layer="districts" label="District boundaries" checked={layers.districts} onToggle={toggle}
             note={data ? (data.boundaries.status === "VERIFIED" ? "Verified boundaries" : "OpenStreetMap reference outlines") : undefined}
             icon={<Outline />} />
      </div>

      <div className="border-b border-line px-3.5 py-2.5">
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Base map</p>
        <Segmented value={basemap} onChange={setBasemap} options={BASEMAPS.map((b) => ({ value: b.id, label: b.label }))} />
      </div>

      <div className="flex flex-col gap-1.5 px-3.5 py-2.5 text-[11px] text-muted">
        {overview && (
          <p className="flex flex-wrap items-center gap-1.5">
            <span>Risk as of {formatTime(overview.as_of)}</span>
            {overview.data_states.map((state) => <StateChip key={state} state={state} />)}
          </p>
        )}
        {overview?.mode === "snapshot" && (
          <p className="text-accent" title={overview.fallback_reason ?? undefined}>Frozen SNAPSHOT of {formatTime(overview.snapshot_saved_at)}</p>
        )}
        {SHOW_LABELS && (
          <p className="tracking-wide text-faint uppercase">
            Prototype · {overview?.includes_sample_data ? "synthetic pest reports · " : ""}unvalidated thresholds
          </p>
        )}
        {SHOW_LABELS && modelIsFake && <p className="text-warn">Imagery questions use the demo model: answers are placeholders.</p>}
        {data && <Sources sources={[data.landcover, data.crops, data.boundaries]} />}
        <label className="flex cursor-pointer items-center gap-1.5 text-ink" title="Data-status labels on every page">
          <input type="checkbox" checked={SHOW_LABELS} onChange={(e) => setShowLabels(e.target.checked)}
                 className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" />
          Show data labels
        </label>
      </div>
    </>
  );
}

function Group({ layer, title, checked, onToggle, tag, children }: {
  layer: keyof MapLayers;
  title: string;
  checked: boolean;
  onToggle: (layer: keyof MapLayers) => void;
  tag?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line px-3.5 py-2.5">
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={checked} onChange={() => onToggle(layer)} className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" />
        <span className="flex-1 text-[13px] font-medium text-ink">{title}</span>
        {tag}
      </label>
      <div className={cx("mt-2 pl-[22px]", !checked && "opacity-45")}>{children}</div>
    </section>
  );
}

function Row({ layer, label, checked, onToggle, icon, count, note }: {
  layer: keyof MapLayers;
  label: string;
  checked: boolean;
  onToggle: (layer: keyof MapLayers) => void;
  icon: ReactNode;
  count?: number | null;
  note?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 px-3.5 py-1.5 hover:bg-hover">
      <input type="checkbox" checked={checked} onChange={() => onToggle(layer)}
             className="mt-0.5 h-3.5 w-3.5 accent-[rgb(var(--accent))]" />
      <span className="mt-0.5 flex w-4 shrink-0 justify-center">{icon}</span>
      <span className="min-w-0 flex-1 text-[13px] text-ink">
        {label}
        {note && <span className="block text-[10px] leading-snug text-faint">{note}</span>}
      </span>
      {count !== null && count !== undefined && <span className="text-[12px] text-muted tabular-nums">{count}</span>}
    </label>
  );
}

function Sources({ sources }: { sources: LayerSource[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
              className="flex items-center gap-1 font-medium text-ink hover:underline">
        Data sources and limits
        <ChevronDown className={cx("h-3 w-3 transition-transform", open && "rotate-180")} strokeWidth={2} />
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-col gap-2">
          {sources.map((s) => (
            <li key={s.name} className="leading-snug">
              <p className="flex flex-wrap items-center gap-1">
                <Tag tone={s.status === "SAMPLE" ? "warn" : undefined}>{s.status}</Tag>
                <span className="font-medium text-ink">{s.name}</span>
              </p>
              <p className="mt-0.5">{s.attribution}{s.licence ? ` · ${s.licence}` : ""}</p>
              <ul className="mt-0.5 list-disc pl-3.5 text-faint">
                {s.limitations.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Tag({ children, tone, title }: { children: ReactNode; tone?: "warn"; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex shrink-0 items-center rounded-[4px] border px-1.5 py-px text-[9.5px] font-semibold tracking-wide uppercase",
        tone === "warn" ? "border-warn/50 bg-warn/10 text-warn" : "border-line-strong text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="h-2.5 w-3.5 shrink-0 rounded-[2px]" style={{ background: color }} />;
}

function Outline() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 text-ink" aria-hidden="true">
      <path d="M2 4.5 L6.5 1.5 L12 3.5 L11 10 L5 12.5 L1.5 9 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function Triangle({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M7 1.5 L12.8 12 H1.2 Z" fill={color} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
