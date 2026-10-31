/** The map's search and filters, top left. One search box finds a district, a monitored zone, a place
 *  (OpenStreetMap Nominatim, camera only) or a pasted H3 cell id. The filters narrow what is drawn:
 *  a district (and frames it), a crop (its SAMPLE share), and how far back reports and inspections go.
 *  Filtering is presentation only. */

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { searchPlaces, type Place } from "../state/api";
import { useAppStore } from "../state/useAppStore";
import { useAgriStore } from "../agri/useAgriStore";
import { fitBounds, useMap } from "../map/MapView";
import { cx, Spinner, Surface } from "../ui/primitives";
import { SHOW_LABELS } from "../ui/presentation";
import { CROP_LABEL, isDisplayCell, PERIODS, type Period } from "./format";
import { useMapStore } from "./useMapStore";

type Hit =
  | { kind: "district"; label: string; bounds: [number, number, number, number] }
  | { kind: "zone"; label: string; id: string; detail: string }
  | { kind: "place"; label: string; place: Place }
  | { kind: "cell"; label: string; cell: string };

const SELECT =
  "h-9 shrink-0 rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-[12px] text-ink shadow-[var(--shadow-md)] " +
  "hover:border-line-strong focus:border-accent focus:outline-none";

export function MapToolbar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen && s.section !== null);
  const data = useMapStore((s) => s.data);
  const district = useMapStore((s) => s.district);
  const crop = useMapStore((s) => s.crop);
  const period = useMapStore((s) => s.period);
  const setDistrict = useMapStore((s) => s.setDistrict);
  const setCrop = useMapStore((s) => s.setCrop);
  const setPeriod = useMapStore((s) => s.setPeriod);

  return (
    <div
      className={cx(
        "pointer-events-none absolute top-4 z-20 flex flex-wrap items-start gap-2 transition-[left]",
        sidebarOpen ? "left-[352px]" : "left-[76px]",
        "right-[304px] max-md:right-[60px] max-sm:left-[68px]",
      )}
    >
      <SearchBox />
      <div className="scroll-quiet pointer-events-auto flex gap-2 max-md:w-full max-md:overflow-x-auto max-md:pb-1">
        <label className="sr-only" htmlFor="map-district">District</label>
        <select id="map-district" className={SELECT} value={district ?? ""} onChange={(e) => setDistrict(e.target.value || null)}>
          <option value="">All districts</option>
          {(data?.district_list ?? []).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="map-crop">Crop</label>
        <select id="map-crop" className={SELECT} value={crop ?? ""} onChange={(e) => setCrop(e.target.value || null)}
                title={SHOW_LABELS ? "Crop types are a SAMPLE pattern" : "Crop"}>
          <option value="">All crops</option>
          {(data?.crop_legend ?? []).filter((c) => c.id !== "mixed").map((c) => (
            <option key={c.id} value={c.id}>{CROP_LABEL[c.id] ?? c.label}{SHOW_LABELS ? " (SAMPLE)" : ""}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="map-period">Reports and inspections from</label>
        <select id="map-period" className={SELECT} value={period ?? "all"}
                title="Which farmer reports and inspections are shown"
                onChange={(e) => setPeriod(e.target.value === "all" ? null : (Number(e.target.value) as Period))}>
          {PERIODS.map((p) => <option key={p.label} value={p.value ?? "all"}>Reports: {p.label.toLowerCase()}</option>)}
        </select>
      </div>
    </div>
  );
}

function SearchBox() {
  const map = useMap();
  const data = useMapStore((s) => s.data);
  const selectCell = useMapStore((s) => s.selectCell);
  const areas = useAgriStore((s) => s.overview?.areas);
  const selectZone = useAgriStore((s) => s.select);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const term = query.trim().toLowerCase();

  const local = useMemo<Hit[]>(() => {
    if (!term) return [];
    if (isDisplayCell(term)) return [{ kind: "cell", label: `Cell ${term}`, cell: term }];
    const districts: Hit[] = (data?.district_list ?? [])
      .filter((d) => d.name.toLowerCase().includes(term))
      .map((d) => ({ kind: "district", label: d.name, bounds: d.bounds }));
    const zones: Hit[] = (areas ?? [])
      .filter((a) => `${a.name} ${a.district ?? ""}`.toLowerCase().includes(term))
      .map((a) => ({ kind: "zone", label: a.name, id: a.id, detail: a.district ?? "" }));
    return [...districts, ...zones].slice(0, 6);
  }, [term, data, areas]);

  // Places only after three letters, debounced, superseded requests aborted (Nominatim's usage policy).
  useEffect(() => {
    if (term.length < 3 || isDisplayCell(term)) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setPlaces(await searchPlaces(`${term}, Manipur`, controller.signal));
      } catch {
        setPlaces([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => !box.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const hits: Hit[] = [...local, ...places.slice(0, 4).map((place) => ({ kind: "place" as const, label: place.name, place }))];

  const go = (hit: Hit) => {
    setOpen(false);
    if (!map) return;
    if (hit.kind === "district") fitBounds(map, hit.bounds, 60);
    if (hit.kind === "zone") selectZone(hit.id);
    if (hit.kind === "place") {
      if (hit.place.bbox) fitBounds(map, hit.place.bbox, 60);
      else map.flyTo({ center: [hit.place.lon, hit.place.lat], zoom: 12, duration: 800 });
    }
    if (hit.kind === "cell") {
      const feature = data?.cells.features.find((f) => f.properties.cell === hit.cell);
      const ring = feature?.geometry.coordinates[0];
      if (!ring) return;
      const center: [number, number] = [
        ring.slice(0, -1).reduce((s, p) => s + p[0]!, 0) / (ring.length - 1),
        ring.slice(0, -1).reduce((s, p) => s + p[1]!, 0) / (ring.length - 1),
      ];
      map.flyTo({ center, zoom: Math.max(map.getZoom(), 10.5), duration: 700 });
      selectCell(hit.cell, center);
    }
  };

  return (
    <div ref={box} className="pointer-events-auto relative w-[300px] max-md:w-full">
      <Surface className="flex h-9 items-center gap-2 px-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) go(hits[0]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search district, zone, place or cell"
          aria-label="Search the map"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
        />
        {searching && <Spinner className="text-faint" />}
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-faint hover:text-ink">
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </Surface>
      {open && term && (
        <Surface raised className="absolute inset-x-0 top-full mt-1 overflow-hidden py-1">
          {hits.length === 0 && !searching && <p className="px-3 py-2 text-[12px] text-muted">Nothing matched.</p>}
          <ul role="listbox" aria-label="Search results">
            {hits.map((hit, i) => (
              <li key={`${hit.kind}-${hit.label}-${i}`}>
                <button type="button" onClick={() => go(hit)}
                        className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-[12px] text-ink hover:bg-hover">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{hit.label}</span>
                    <span className="block text-[10px] tracking-wide text-faint uppercase">
                      {hit.kind === "zone" ? `Monitored zone · ${hit.detail}` : hit.kind === "place" ? "Place (OpenStreetMap)" : hit.kind}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}
