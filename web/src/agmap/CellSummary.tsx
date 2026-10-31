/** The quick look at a clicked cell, pinned beside it on the map (a bottom sheet on a phone): its SAMPLE
 *  crops, how much of it is farmland, its monitored zone's level and drivers, and how many alerts,
 *  reports and inspections it holds. "View details" opens the full panel. */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import { useMap } from "../map/MapView";
import { FACTOR_LABEL, formatScore } from "../agri/format";
import { LevelBadge } from "../agri/badges";
import type { CellDetail, FactorId } from "../state/types";
import { Button, cx, IconButton, Spinner, Surface } from "../ui/primitives";
import { SHOW_LABELS } from "../ui/presentation";
import { cropColor, cropLabel, percent } from "./format";
import { Tag } from "./LayerPanel";
import { useMapStore } from "./useMapStore";

const WIDTH = 300;

export function CellSummary() {
  const map = useMap();
  const view = useMapStore((s) => s.view);
  const cell = useMapStore((s) => s.cell);
  const anchor = useMapStore((s) => s.anchor);
  const detail = useMapStore((s) => s.detail);
  const status = useMapStore((s) => s.detailStatus);
  const error = useMapStore((s) => s.detailError);
  const closeCell = useMapStore((s) => s.closeCell);
  const card = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!map || !anchor) return;
    const place = () => {
      const p = map.project(anchor);
      setPoint({ x: p.x, y: p.y });
    };
    place();
    map.on("move", place);
    return () => {
      map.off("move", place);
    };
  }, [map, anchor]);

  useLayoutEffect(() => setHeight(card.current?.offsetHeight ?? 0), [detail, status]);

  if (view !== "summary" || !cell || !point || !map) return null;
  const container = map.getContainer();
  // Above the point when there is room under the toolbar, otherwise below it; never off the sides.
  const above = point.y - height - 18 > 64;
  const left = Math.min(Math.max(point.x - WIDTH / 2, 12), container.clientWidth - WIDTH - 12);
  const top = above ? point.y - height - 18 : point.y + 18;

  return (
    <div
      ref={card}
      style={{ left, top, width: WIDTH }}
      className="absolute z-30 max-sm:!fixed max-sm:!inset-x-2 max-sm:!top-auto max-sm:!bottom-2 max-sm:!left-2 max-sm:z-40 max-sm:!w-auto"
    >
      <Surface raised role="dialog" aria-label="Cell summary">
        <header className="flex items-start justify-between gap-2 border-b border-line py-2 pr-1.5 pl-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-muted" title="H3 resolution 7 cell">Cell {cell}</p>
            <p className="text-[13px] font-semibold text-ink">
              {detail?.cell === cell ? detail.district ?? "Outside the district outlines" : " "}
            </p>
          </div>
          <IconButton label="Close" side="left" onClick={closeCell} className="h-7 w-7">
            <X className="h-4 w-4" strokeWidth={2} />
          </IconButton>
        </header>
        <div className="px-3 py-2.5">
          {detail?.cell === cell ? (
            <Summary detail={detail} />
          ) : status === "error" ? (
            <p className="text-[12px] text-danger">{error}</p>
          ) : (
            <p className="flex items-center gap-2 text-[12px] text-muted"><Spinner /> Loading this cell</p>
          )}
        </div>
      </Surface>
    </div>
  );
}

function Summary({ detail }: { detail: CellDetail }) {
  const openDetails = useMapStore((s) => s.openDetails);
  const top = detail.landcover[0];
  return (
    <div className="flex flex-col gap-2.5">
      {detail.is_farmland ? (
        <div>
          <p className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Crops {SHOW_LABELS && <Tag tone="warn" title="Synthetic crop pattern: no crop-type data is loaded yet">SAMPLE</Tag>}
          </p>
          <MixBar detail={detail} />
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {detail.crop_mix.slice(0, 3).map((s) => (
              <li key={s.crop} className="flex items-center gap-1.5 text-[12px] text-ink">
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: cropColor(s.crop) }} />
                <span className="flex-1">{cropLabel(s.crop)}{detail.dominant === s.crop && <span className="text-muted"> · dominant</span>}</span>
                <span className="text-muted tabular-nums">{percent(s.share)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted">
            Cropland {percent(detail.cropland)} of about {detail.area_km2} km² (WorldCover 2021)
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-ink">
          {top ? <>Mostly {top.label.toLowerCase()} ({percent(top.share)}).</> : "No land-cover data."}{" "}
          <span className="text-muted">Cropland {percent(detail.cropland)}: not drawn as farmland.</span>
        </p>
      )}

      {detail.zone ? (
        <div className="rounded-[var(--radius-sm)] bg-sunken px-2.5 py-2">
          <p className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={detail.zone.level} />
            <span className="text-[12px] text-ink tabular-nums">{formatScore(detail.zone.score)}/100</span>
            {detail.zone.rank && <span className="text-[12px] text-muted">priority #{detail.zone.rank}</span>}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Zone: <span className="text-ink">{detail.zone.name}</span>
            {detail.zone.top_factors.length > 0 && (
              <> · drivers: {detail.zone.top_factors.map((f) => FACTOR_LABEL[f as FactorId] ?? f).join(", ")}</>
            )}
          </p>
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-muted">Not in a monitored zone: no risk assessment here (not the same as no risk).</p>
      )}

      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink">
        <Count n={detail.alerts.length} label="alert" />
        {detail.reports_visible && <Count n={detail.reports.length} label="report" />}
        {detail.tasks_visible && <Count n={detail.tasks.length} label="inspection" />}
      </p>

      <Button variant="primary" size="sm" className="self-stretch" onClick={() => openDetails("overview")}>
        View details <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Button>
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }): ReactNode {
  return <span className={cx(n === 0 && "text-muted")}><strong className="font-semibold tabular-nums">{n}</strong> {label}{n === 1 ? "" : "s"}</span>;
}

/** The SAMPLE crop shares as one stacked bar, 2px surface gaps between segments. */
export function MixBar({ detail }: { detail: CellDetail }) {
  return (
    <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
      {detail.crop_mix.map((s) => (
        <span key={s.crop} style={{ width: `${s.share * 100}%`, background: cropColor(s.crop) }} />
      ))}
    </div>
  );
}
