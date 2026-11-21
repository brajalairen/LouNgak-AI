/** Growth-stage choices for the farmer's report and the officer's inspection outcome.
 *
 *  The stage names follow the Crop Atlas's SOURCED "Growth stages" sections
 *  (`satquery/atlas/assets/crops.json`): the IRRI Rice Knowledge Bank for rice and Chak-hao, and Iowa State
 *  University for maize. Farmers get a short list in plain words; officers get the detailed stages,
 *  grouped by phase. "Transplanted" and "Harvested" describe the field rather than the plant's
 *  botanical stage; they are listed because that is what people see in the valley's season.
 *  The value saved is the label itself: the API field stays free text, so "Other" can be typed. */

export type StageAudience = "farmer" | "officer";

/** One block of choices; `phase` is shown as a group heading when it is set. */
export interface StageGroup {
  phase: string | null;
  stages: string[];
}

/** The select value that reveals a text box for a stage the list does not cover. */
export const OTHER_STAGE = "__other__";

const RICE_FARMER: StageGroup[] = [
  { phase: null, stages: ["Nursery / seedling", "Transplanted, growing", "Flowering", "Grain filling", "Ready to harvest", "Harvested"] },
];

const RICE_OFFICER: StageGroup[] = [
  { phase: "Vegetative", stages: ["Germination", "Seedling", "Tillering", "Stem elongation"] },
  { phase: "Reproductive", stages: ["Panicle initiation", "Booting", "Heading", "Flowering"] },
  { phase: "Ripening", stages: ["Milk stage", "Dough stage", "Mature grain"] },
  { phase: "After harvest", stages: ["Harvested / stubble"] },
];

const MAIZE_FARMER: StageGroup[] = [
  { phase: null, stages: ["Seedling", "Growing (leaves)", "Tassels or silks showing", "Cobs filling", "Ready to harvest", "Harvested"] },
];

const MAIZE_OFFICER: StageGroup[] = [
  { phase: "Vegetative", stages: ["Emergence (VE)", "Leaf stages (V1–Vn)", "Tasselling (VT)"] },
  {
    phase: "Reproductive",
    stages: ["Silking (R1)", "Blister (R2)", "Milk (R3)", "Dough (R4)", "Dent (R5)", "Physiological maturity (R6)"],
  },
  { phase: "After harvest", stages: ["Harvested"] },
];

/** For "Other" and "Not known" crops: plain words that hold for most field crops. */
const GENERAL: StageGroup[] = [
  { phase: null, stages: ["Seedling", "Growing", "Flowering", "Fruit or grain forming", "Ready to harvest", "Harvested"] },
];

/** The choices for a crop. Chak-hao is a rice and follows the rice stages (as its Atlas profile says). */
export function stageGroups(crop: string, audience: StageAudience): StageGroup[] {
  if (crop === "rice" || crop === "chakhao") return audience === "farmer" ? RICE_FARMER : RICE_OFFICER;
  if (crop === "maize") return audience === "farmer" ? MAIZE_FARMER : MAIZE_OFFICER;
  return GENERAL;
}

/** True when the value is one of the listed choices (so it is not shown as typed "Other" text). */
export function isListedStage(crop: string, audience: StageAudience, value: string | null): boolean {
  return value !== null && stageGroups(crop, audience).some((g) => g.stages.includes(value));
}
