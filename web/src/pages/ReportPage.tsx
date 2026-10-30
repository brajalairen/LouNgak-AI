/** Report an issue: a farmer tells the agricultural officers about a suspected problem at a place,
 *  without having to register a farm. The report is stored as unverified and goes to the officer
 *  responsible for the district. Mobile-first: one column, a small map for the pin, device location. */

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { CheckCircle2, LocateFixed } from "lucide-react";
import { api } from "../state/api";
import type { CropId, FarmerReport, ReportCategory } from "../state/types";
import { useAppStore } from "../state/useAppStore";
import { basemapStyle, INITIAL_VIEW } from "../map/basemap";
import { Button, Field } from "../ui/primitives";
import { useSession } from "../shell/useSession";
import { Card, CATEGORY_LABEL, CROP_LABEL, DISTRICTS, ErrorLine, errorText, fieldClass, Notice, PageBody } from "../ops/ui";

export function ReportPage() {
  const user = useSession((s) => s.user);
  const setPage = useSession((s) => s.setPage);
  const changed = useSession((s) => s.changed);
  const [category, setCategory] = useState<ReportCategory>("pest");
  const [crop, setCrop] = useState<CropId>("rice");
  const [stage, setStage] = useState("");
  const [description, setDescription] = useState("");
  const [district, setDistrict] = useState<string>(user?.districts[0] ?? "Bishnupur");
  const [point, setPoint] = useState<{ lat: number; lon: number; source: "map_pin" | "device_gps" } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<FarmerReport | null>(null);

  const locate = () => {
    if (!navigator.geolocation) return setError("This device cannot share its location; drop a pin on the map instead.");
    navigator.geolocation.getCurrentPosition(
      (p) => setPoint({ lat: p.coords.latitude, lon: p.coords.longitude, source: "device_gps" }),
      () => setError("Location permission was not given; drop a pin on the map instead."),
    );
  };

  const submit = async () => {
    if (!point) return;
    setBusy(true);
    setError(null);
    try {
      const report = await api.createReport({
        category, crop, growth_stage: stage.trim() || null, description, latitude: point.lat, longitude: point.lon,
        location_source: point.source, district, consent,
      });
      setSent(report);
      changed();
    } catch (e) {
      setError(errorText(e, "The report could not be sent. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <PageBody title="Report received">
        <Card>
          <CheckCircle2 className="h-6 w-6 text-ok" />
          <p className="mt-2 text-[14px] font-semibold text-ink">Your report {sent.id} has been received.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            It is marked unverified until an agricultural officer reviews it. You can follow its progress under My reports.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => setPage("my-reports")}>My reports</Button>
            <Button variant="outline" onClick={() => setSent(null)}>Report another issue</Button>
          </div>
        </Card>
      </PageBody>
    );
  }

  return (
    <PageBody title="Report an issue" intro="Tell the agricultural officers what you have noticed. You do not need to register your farm.">
      <Card className="space-y-3">
        <Field label="What did you notice?">
          <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
            {Object.entries(CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Crop">
            <select className={fieldClass} value={crop} onChange={(e) => setCrop(e.target.value as CropId)}>
              {Object.entries(CROP_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Growth stage (if known)">
            <input className={fieldClass} placeholder="e.g. flowering, harvest" value={stage} onChange={(e) => setStage(e.target.value)} />
          </Field>
        </div>
        <Field label="Describe what you see">
          <textarea className={fieldClass} rows={3} placeholder="For example: brown spots on leaves in one corner of the field since Monday."
                    value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="District">
          <select className={fieldClass} value={district} onChange={(e) => setDistrict(e.target.value)}>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">Where is it?</p>
          <PinMap point={point} onPick={(lat, lon) => setPoint({ lat, lon, source: "map_pin" })} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={locate}><LocateFixed className="h-3.5 w-3.5" /> Use my location</Button>
            <span className="text-[12px] text-muted">
              {point ? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)} (${point.source === "device_gps" ? "device location" : "map pin"})` : "Tap the map to drop a pin."}
            </span>
          </div>
        </div>
        <label className="flex items-start gap-2 text-[13px] text-ink">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I agree that agricultural officers may use this location and description to follow up. My name is not shown publicly.</span>
        </label>
        <ErrorLine error={error} />
        <Button variant="primary" className="w-full sm:w-auto" disabled={busy || !point || !consent || description.trim().length < 3} onClick={submit}>
          Send report
        </Button>
      </Card>
      <Notice tone="info">For emergencies, follow official warnings from IMD and the district administration. LouNgak AI does not issue official warnings.</Notice>
    </PageBody>
  );
}

function PinMap({ point, onPick }: { point: { lat: number; lon: number } | null; onPick: (lat: number, lon: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const theme = useAppStore((s) => s.theme);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!container.current) return;
    const instance = new MapLibreMap({
      container: container.current, style: basemapStyle("hybrid", theme), center: INITIAL_VIEW.center, zoom: 9,
      attributionControl: { compact: true },
    });
    instance.on("click", (event) => pick.current(event.lngLat.lat, event.lngLat.lng));
    map.current = instance;
    return () => instance.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !point) return;
    if (!marker.current) marker.current = new Marker({ color: "#d97706" });
    marker.current.setLngLat([point.lon, point.lat]).addTo(map.current);
    map.current.easeTo({ center: [point.lon, point.lat], zoom: Math.max(map.current.getZoom(), 13) });
  }, [point]);

  return <div ref={container} className="h-64 w-full overflow-hidden rounded-[var(--radius-sm)] border border-line" aria-label="Map: tap to place the report" />;
}
