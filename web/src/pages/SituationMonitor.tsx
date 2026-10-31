/** Situation Monitor: the agricultural map. The map fills the page and everything else floats above it:
 *  statewide farmland cells coloured by SAMPLE crop type (WorldCover says where), each monitored zone's
 *  risk on its cells, alerts, reports and inspections, district outlines; search and filters top left,
 *  the layers panel right, a cell's summary and details on click; the priority sidebar, the "Why is this
 *  area at risk?" drawer and the question bar as before. */

import { MapView } from "../map/MapView";
import { AoiLayer } from "../map/AoiLayer";
import { ImageCanvas } from "../map/ImageCanvas";
import { CompassControl, ZoomControls } from "../map/MapControls";
import { Sidebar } from "../sidebar/Sidebar";
import { AICommandBar } from "../command/AICommandBar";
import { ResultOverlay } from "../results/ResultOverlay";
import { RiskLayer } from "../agri/RiskLayer";
import { AreaRiskDrawer } from "../agri/AreaRiskDrawer";
import { AgriAnswerCard } from "../agri/AgriAnswerCard";
import { AgLayers } from "../agmap/AgLayers";
import { PinsLayer } from "../agmap/PinsLayer";
import { LayerPanel } from "../agmap/LayerPanel";
import { MapToolbar } from "../agmap/MapToolbar";
import { CellSummary } from "../agmap/CellSummary";
import { CellPanel } from "../agmap/CellPanel";

export function SituationMonitor() {
  return (
    <MapView>
      {/* Order matters on a style reload: cells first, then zone outlines, then markers above them. */}
      <AgLayers />
      <RiskLayer />
      <PinsLayer />
      <AoiLayer />
      <Sidebar />
      <MapToolbar />
      <LayerPanel />
      <CellSummary />
      <CellPanel />
      <ImageCanvas />
      <ResultOverlay />
      <AgriAnswerCard />
      <AICommandBar />
      <AreaRiskDrawer />

      {/* Bottom left, above the scale bar: the right side belongs to the layers and cell panels. A phone
          pinches to zoom and rotate, so the buttons would only crowd the question bar there. */}
      <div className="absolute bottom-12 left-4 z-20 flex flex-col items-start gap-2 max-sm:hidden">
        <CompassControl />
        <ZoomControls />
      </div>
    </MapView>
  );
}
