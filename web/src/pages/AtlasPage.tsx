/** Crop Atlas: the DRAFT profiles for rice, Chak-hao and maize. Every section shows whether it is
 *  sourced, still to verify, or deliberately empty until a regional source is found. */

import { useState } from "react";
import { api } from "../state/api";
import type { SectionStatus } from "../state/types";
import { Segmented } from "../ui/primitives";
import { Card, Chip, ErrorLine, Notice, PageBody, useLoad } from "../ops/ui";

const STATUS: Record<SectionStatus, { label: string; tone: string }> = {
  SOURCED: { label: "Sourced", tone: "border-ok/50 text-ok" },
  TO_VERIFY: { label: "To verify", tone: "border-warn/50 text-warn" },
  SOURCE_NEEDED: { label: "Source needed", tone: "border-line-strong text-muted" },
};

export function AtlasPage() {
  const { data, error } = useLoad(api.atlas);
  const [cropId, setCropId] = useState("rice");
  const crop = data?.crops.find((c) => c.id === cropId) ?? data?.crops[0];
  const sources = new Map((data?.sources ?? []).map((s) => [s.id, s]));

  return (
    <PageBody title="Crop Atlas" intro="Crop knowledge for Manipur's priority crops, with the source behind each section.">
      <ErrorLine error={error} />
      {data && (
        <>
          <Notice><strong>{data.status}:</strong> {data.note}</Notice>
          <Segmented value={crop?.id ?? "rice"} onChange={setCropId} options={data.crops.map((c) => ({ value: c.id, label: c.name.split(" (")[0] ?? c.name }))} />
        </>
      )}
      {crop && (
        <>
          <Card>
            <h2 className="text-[17px] font-semibold text-ink">{crop.name}</h2>
            <p className="text-[13px] text-muted italic">{crop.scientific_name}</p>
            <p className="mt-1 text-[12px] text-muted">
              {crop.category} · Local name: {crop.local_names.map((n) => `${n.name} (${n.language}, ${STATUS[n.status].label.toLowerCase()})`).join("; ")}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink">{crop.summary}</p>
          </Card>
          {crop.sections.map((section) => (
            <Card key={section.title}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-ink">{section.title}</h3>
                <Chip className={STATUS[section.status].tone}>{STATUS[section.status].label}</Chip>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-ink">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {section.sources.length > 0 && (
                <p className="mt-2 text-[11px] text-muted">
                  Source: {section.sources.map((id) => {
                    const s = sources.get(id);
                    return s ? `${s.title} (${s.publisher}${s.year ? `, ${s.year}` : ""})` : id;
                  }).join("; ")}
                </p>
              )}
            </Card>
          ))}
          <Card>
            <h3 className="text-[14px] font-semibold text-ink">What LouNgak AI can and cannot monitor</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold text-ok">Can</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-ink">
                  {crop.monitoring.can.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-danger">Cannot</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-ink">
                  {crop.monitoring.cannot.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="text-[13px] font-semibold text-ink">References</h3>
            <ul className="mt-1 space-y-1 text-[12px] text-muted">
              {data?.sources.map((s) => (
                <li key={s.id}>
                  {s.title} — {s.publisher}{s.year ? `, ${s.year}` : ""}.{" "}
                  {s.url.startsWith("http") ? <a className="text-accent underline" href={s.url} target="_blank" rel="noreferrer">{s.url}</a> : s.url}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </PageBody>
  );
}
