/** Agricultural map state: the layer data from /api/map/layers, which layers show, the filters, and the
 *  selected cell with its detail. It holds server results only; hiding a layer or filtering never
 *  changes a figure. */

import { create } from "zustand";
import { api, ApiError } from "../state/api";
import type { AgMap, Alert, CellDetail, FarmerReport, InspectionTask } from "../state/types";
import type { Period } from "./format";

type Status = "idle" | "loading" | "ready" | "error";

/** What the map draws. Presentation only. */
export interface MapLayers {
  crops: boolean;        // farmland cells coloured by SAMPLE dominant crop (WorldCover says where)
  risk: boolean;         // monitored zones' engine levels on their cells, plus zone outlines and ranks
  alerts: boolean;       // active LouNgak Watch alerts, one marker per zone
  reports: boolean;      // farmer reports this account may see
  inspections: boolean;  // inspection tasks this account may see
  districts: boolean;    // district outlines and names (context, never scored)
}

export type CellTab = "overview" | "crops" | "risk" | "alerts" | "reports" | "inspections";

/** Records drawn as markers. Loaded for the current account by the pins layer. */
export interface Pins {
  alerts: Alert[];
  reports: FarmerReport[];
  tasks: InspectionTask[];
}

interface MapState {
  data: AgMap | null;
  status: Status;
  error: string | null;

  layers: MapLayers;
  district: string | null;
  crop: string | null;
  period: Period;
  pins: Pins;
  /** The layers panel is open (desktop starts open, a phone starts with the button only). */
  panelOpen: boolean;

  cell: string | null;
  /** Where the cell was chosen: the summary card points at it. */
  anchor: [number, number] | null;
  view: "summary" | "details" | null;
  tab: CellTab;
  detail: CellDetail | null;
  detailStatus: Status;
  detailError: string | null;

  load: () => Promise<void>;
  toggleLayer: (layer: keyof MapLayers) => void;
  setDistrict: (district: string | null) => void;
  setCrop: (crop: string | null) => void;
  setPeriod: (period: Period) => void;
  setPins: (pins: Pins) => void;
  setPanelOpen: (open: boolean) => void;
  selectCell: (cell: string, anchor: [number, number], tab?: CellTab) => void;
  openDetails: (tab?: CellTab) => void;
  setTab: (tab: CellTab) => void;
  closeCell: () => void;
  /** Reload the open cell, e.g. after an inspection was created or the account changed. */
  refreshCell: () => void;
}

let detailRequest = 0;

const wide = () => typeof window === "undefined" || window.matchMedia?.("(min-width: 768px)").matches !== false;

export const useMapStore = create<MapState>((set, get) => ({
  data: null,
  status: "idle",
  error: null,
  layers: { crops: true, risk: true, alerts: true, reports: true, inspections: true, districts: true },
  district: null,
  crop: null,
  period: 30,
  pins: { alerts: [], reports: [], tasks: [] },
  panelOpen: wide(),
  cell: null,
  anchor: null,
  view: null,
  tab: "overview",
  detail: null,
  detailStatus: "idle",
  detailError: null,

  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      set({ data: await api.mapLayers(), status: "ready" });
    } catch (error) {
      set({ status: "error", error: error instanceof ApiError ? error.message : "The map layers could not be loaded." });
    }
  },

  toggleLayer: (layer) => set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),
  setDistrict: (district) => set({ district }),
  setCrop: (crop) => set({ crop }),
  setPeriod: (period) => set({ period }),
  setPins: (pins) => set({ pins }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),

  selectCell: (cell, anchor, tab) => {
    // A marker opens straight onto its records; a plain click on a cell shows the summary first.
    set({ cell, anchor, view: tab ? "details" : "summary", tab: tab ?? "overview" });
    get().refreshCell();
  },

  openDetails: (tab) => set((state) => ({ view: "details", tab: tab ?? state.tab })),
  setTab: (tab) => set({ tab }),

  closeCell: () => {
    detailRequest += 1;
    set({ cell: null, anchor: null, view: null, detail: null, detailStatus: "idle", detailError: null });
  },

  refreshCell: () => {
    const cell = get().cell;
    if (!cell) return;
    // Only the latest request may fill the card: a slow earlier answer never overwrites it.
    const ticket = ++detailRequest;
    set((state) => ({ detailStatus: "loading", detailError: null, detail: state.detail?.cell === cell ? state.detail : null }));
    api
      .mapCell(cell)
      .then((detail) => ticket === detailRequest && set({ detail, detailStatus: "ready" }))
      .catch((error) => {
        if (ticket === detailRequest) {
          set({ detailStatus: "error", detailError: error instanceof ApiError ? error.message : "This cell could not be loaded." });
        }
      });
  },
}));
