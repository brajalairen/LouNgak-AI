/** Situation Monitor: the map page. The map fills the page and everything else floats above it: the
 *  monitored zones coloured by the risk engine, the H3 grid, reports and inspections, the priority
 *  sidebar, the "Why is this area at risk?" drawer and the question bar. */

import { MapView } from "../map/MapView";
import { AoiLayer } from "../map/AoiLayer";
import { H3Layer } from "../map/H3Layer";
import { OpsLayer } from "../map/OpsLayer";
import { ImageCanvas } from "../map/ImageCanvas";
import { CompassControl, ZoomControls } from "../map/MapControls";
import { Sidebar } from "../sidebar/Sidebar";
import { AICommandBar } from "../command/AICommandBar";
import { ResultOverlay } from "../results/ResultOverlay";
import { useAppStore } from "../state/useAppStore";
import { Surface } from "../ui/primitives";
import { RiskLayer } from "../agri/RiskLayer";
import { MapLayersControl } from "../agri/MapLayersControl";
import { AreaRiskDrawer } from "../agri/AreaRiskDrawer";
import { AgriAnswerCard } from "../agri/AgriAnswerCard";
import { StatusStrip } from "../agri/StatusStrip";

export function SituationMonitor() {
  const modelIsFake = useAppStore((s) => s.modelIsFake);
  return (
    <MapView>
      <RiskLayer />
      <H3Layer />
      <OpsLayer />
      <AoiLayer />
      <StatusStrip />
      <Sidebar />
      <ImageCanvas />
      <ResultOverlay />
      <AgriAnswerCard />
      <AICommandBar />
      <AreaRiskDrawer />

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {/* A stand-in model must be visible at all times, never mistaken for the real one. */}
        {modelIsFake && (
          <Surface className="px-2.5 py-1.5 text-[11px] font-medium text-warn">
            Demo model - answers are placeholders
          </Surface>
        )}
        <CompassControl />
      </div>

      {/* Anchored where the zoom buttons always were; the basemap picker stacks above them. */}
      <div className="absolute right-4 bottom-28 z-20 flex flex-col items-end gap-2">
        <MapLayersControl />
        <ZoomControls />
      </div>
    </MapView>
  );
}
