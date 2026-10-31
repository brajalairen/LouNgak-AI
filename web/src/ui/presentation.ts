/** Presentation mode: shows the app as the finished product would look, without the DEMO / SAMPLE
 *  status labels on every screen. It changes wording only. The server, its data and its status fields
 *  are untouched, the "Data sources and limits" note in the map's layers panel still states what is
 *  synthetic, and the switch there brings every label back.
 *
 *  Two parts: the label components (DemoChip, DemoTag, SampleLabel, SAMPLE chips) render nothing, and
 *  the API client passes every response through `scrub`, which rewrites only the specific server phrases
 *  below. The patterns name whole phrases ("Demo farmer", "DEMO: ", "(sample)"), so ids such as
 *  `demo-bishnupur-nambol` and status values such as `rule_status: "DEMO"` are never altered. */

const STORAGE_KEY = "loungak.showLabels";

function stored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

/** Fixed for the page's lifetime: switching reloads, so every view and response follows the new mode. */
export const SHOW_LABELS = stored();

export function setShowLabels(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, "on");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the choice simply is not remembered */
  }
  window.location.reload();
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Whole sentences that only say "this is demonstration data": removed. */
const DROP: RegExp[] = [
  /\s*\[?DEMO RECORD [—–-] demonstration data, not a real report or inspection\]?/g,
  /\s*DEMO alert for the workflow demonstration: not from a real forecast\./g,
  /\s*\d+ DEMO alert\(s\) are shown for demonstration and labelled as such\./g,
  /\s*Includes SAMPLE DATA [—–-] Prototype Simulation: the report figures are synthetic\./g,
  /\s*SAMPLE DATA [—–-] Prototype Simulation: synthetic reports, not real observations\./g,
  /\s*Report pressure uses SAMPLE \(synthetic\) reports, so confidence is at most medium\./g,
  /\s*SYNTHETIC reports for prototype demonstration only; not real government or field observations\./g,
  /\s*Crop types and shares are SAMPLE \(synthetic, illustrative\): no crop-type data is loaded yet\./g,
];

/** Phrases reworded to the finished product's terms. */
const REWORD: [RegExp, string | ((match: string, ...groups: string[]) => string)][] = [
  [/\bDemo (farmer|field officer|district officer|state-level officer)\b/g, (_m, role: string) => capitalise(role)],
  [/\bDEMO:\s+/g, ""],
  [/; rule DEMO\./g, "."],
  [/ \(sample\)/gi, ""],
  [/\(SAMPLE\)/g, ""],
  [/\bSAMPLE (pest )?report/g, (_m, pest = "") => `${pest}report`],
  [/^SAMPLE DATA [—–-] Prototype Simulation$/, ""],
  [/\d+ demo monitoring rectangle\(s\) over valley farmland: not administrative boundaries\./g,
    (m) => `${m.split(" ")[0]} monitored zones over valley farmland.`],
  [/Demo monitoring rectangle drawn by the team: not an administrative boundary\./g, "Monitoring zone drawn by the team."],
  [/demo rectangle drawn by the team \(not an administrative boundary\)/g, "monitoring zone drawn by the team"],
  [/^Demo accounts for the prototype: anyone can switch between them\. This is not production authentication; /,
    "Accounts by role: "],
  [/LouNgak AI sample-report generator \(seeded, deterministic\)/g, "LouNgak AI report feed"],
  [/LouNgak AI demonstration seed/g, "LouNgak AI"],
  [/ it is capped at medium when an input is SAMPLE data and at low/g, " it is capped at low"],
];

/** One string in its presentation wording. */
export function present(text: string): string {
  let out = text;
  for (const pattern of DROP) out = out.replace(pattern, "");
  for (const [pattern, replacement] of REWORD) out = out.replace(pattern, replacement as string);
  if (out === text) return text; // untouched unless a phrase matched
  out = out.replace(/\s{2,}/g, " ").trim();
  return out && capitalise(out);
}

/** A whole API response in presentation wording; list items that become empty are dropped. Values are
 *  only ever rewritten, never added, so the response keeps its shape. */
export function scrub<T>(value: T): T {
  if (typeof value === "string") return present(value) as T;
  if (Array.isArray(value)) {
    return value.map(scrub).filter((item) => !(typeof item === "string" && item === "")) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item)])) as T;
  }
  return value;
}
