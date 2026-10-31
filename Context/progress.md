# LouNgak AI — Progress

> **Current phase:** Stage 1 submission. Sprint 0 (the end-to-end slice) and the agricultural map are built,
> tested, committed and pushed (see "Commit and push" below).
> **Next deadline:** Stage 1 submission on the MY Bharat portal, **31 Oct 2026** (team target: noon).
> **Then:** Stage 2 state-level demo, from 7 Nov 2026.
> **Branches:** `feat/agri-map` holds the agricultural map, the error boundary and presentation mode, on top of
> `feat/mvp-slice` (Sprint 0). Both are pushed, and `main` is fast-forwarded to `feat/agri-map`.
> **Update this file at the end of every work session** (see [agents.md](agents.md)).

## Sprint 0 checklist (Stage 1)

| # | Item | Status | Owner |
|---|---|---|---|
| a | App shell: top bar, role-aware pages, DEMO account switcher; SQLite store; `seed-demo` / `reset` CLI | ✅ Done | Claude |
| b | Farmer report → officer queue (with reasons) → inspection → field outcome → farmer status | ✅ Done | Claude |
| c | LouNgak Watch: heavy rain (IMD categories), crop health (NDVI), pest/disease watch; acknowledge; create inspection | ✅ Done | Claude |
| d | H3 grid (res 8) over monitored zones; cell id on reports and tasks. The res-8 outline layer was later replaced by the statewide res-7 agricultural map | ✅ Done | Claude |
| e | Crop Atlas: DRAFT rice, Chak-hao and maize profiles with per-section source status | ✅ Done | Claude |
| f | Remove legacy and dead code | ✅ Done | Claude |
| g | README, architecture doc and Context docs updated | ✅ Done | Claude |
| h | Visual click-through of every page in a browser (desktop and phone width) | ✅ Done in headless Chrome (desktop and phone) and by the user; a real-phone check is still open | Claude + user |
| i | Record the 3–5 min demo video ([script](refined_foundation.md#9-demo-script-and-deck-outline)) | ☐ To do | Team |
| j | 7-slide deck on the HSC template | 🟡 Built as `HFSS/LouNgak_AI_HSC_Presentation.pptx`; the team still fills in the placeholders (see "Presentation deck") and saves it as PDF | Claude + team |
| k | Problem statement text for the portal | ☐ To do | Team |
| l | Self-declaration and ID proofs; team lead submits | ☐ To do | Team lead |
| m | Push `feat/mvp-slice` and fast-forward `main` on GitHub | ✅ Done (Sprint 0 only) | Claude |
| m2 | Commit the map work on `feat/agri-map`, push it, and fast-forward `main` so the GitHub link shows the new map | ✅ Done 31 Oct, authorised by the team lead (commit "feat: add statewide agricultural intelligence map") | Claude |
| n | Submit https://github.com/brajalairen/LouNgak-AI on the portal | ☐ To do | Team lead |

## Done so far (31 Oct 2026)

- Cloned `https://github.com/brajalairen/LouNgak-AI` at `bf22d3e`; audited backend, frontend, docs and the
  archived tags (see refined_foundation.md §3).
- **Cleanup** (commit "chore: remove legacy…"):
  - removed the Gradio HF Space (`app.py`, `satquery/ui.py`), the imagery CLI (`satquery/cli.py`,
    `satquery/__main__.py`) and SIH-era `presentation-assets/`;
  - removed the unused `SatelliteDataProvider`, `query.is_agri`, Copernicus `cache_dir`, `ThresholdsNotice`, the
    `FileImage` re-export, the `aoi-point` map layer, unused CSS variables and `BrandMark`;
  - moved `EmptyState` into `ui/primitives`; made `scrub()` public.
- **Backend slice** (commit "feat: LouNgak Watch alerts, field operations…"): `satquery/store.py`, `ops/`,
  `watch/`, `grid.py`, `atlas/`; per-day forecast rain in the weather summary; 14 new tests in
  `tests/test_ops.py`; 21 new wire models in the contract test.
- **Frontend slice** (commit "feat(web): role-based app shell…"): `shell/`, `pages/`, `ops/`, `map/H3Layer`,
  `map/OpsLayer`; page smoke tests.
- **Verified:**
  - pytest: 832 passed; Vitest: 109 passed; typecheck clean; production build OK.
  - On the live server, real Open-Meteo data gave 8 pest/disease watches across the 7 zones, plus the DEMO
    weather alert. The H3 grid has 491 cells.
  - The full report → inspection → outcome loop ran over HTTP, with 401/403 outside a role or jurisdiction.
- **Security fix:** real Copernicus credentials had been pasted into `.env.example` (tracked by git). They were
  moved to `.env` (gitignored) and the commit was amended **before any push**. Consider rotating them if they were
  shared anywhere else.

## Agricultural map (31 Oct 2026, after the Sprint 0 slice; branch `feat/agri-map`, not pushed)

- **Replaced the 7-rectangle map** with a statewide agricultural map on H3 resolution-7 cells (3,993):
  - farmland from ESA WorldCover 2021: cropland ≥ 5% in 852 cells, and colour strength follows the share;
  - crop colours from a labelled **SAMPLE** pattern;
  - each zone's engine level on its cells, as an outline over the crops (a fill when crops are hidden);
  - alerts, reports and inspections as markers;
  - **district boundaries fixed:** OpenStreetMap outlines now ship; the option used to be greyed out because the
    Survey of India file is local only.
- **New UI** (`web/src/agmap/`):
  - search (district, zone, place, cell id) and filters (district, crop, period);
  - a layers panel with every legend, the base map and the data sources;
  - a cell summary card on click, and a detail panel with tabs (overview, crops, risk, alerts, reports,
    inspections) and actions (zone explanation, create inspection, copy cell id).
- **Removed:**
  - the legend strip, the layers popover, the resolution-8 outline grid (`H3Layer`) and the old pins layer
    (`OpsLayer`);
  - the sidebar's place search (now in the toolbar) and `/api/grid/zones`.
  - The sidebar now opens collapsed, and the map controls moved bottom left.
- **Backend:** `satquery/agmap/` (`/api/map/layers`, `/api/map/cells/{cell}`, with server-side record
  permissions), GZip responses, and `scripts/build_map_assets.py`.
- **Docs:** `docs/geo/map-data-sources.md`, README and architecture.
- **Verified:**
  - pytest: 852 passed (3 skipped); Vitest: 126 passed (final, after the later fixes below); typecheck clean; build OK.
  - Clicked through in headless Chrome at 1440 × 900 and 390 × 844, in dark and light themes, on the Standard and
    Satellite base maps. Checked: the public, state-officer and district-officer views, cell search, the summary,
    every tab, and creating an inspection from an alert.
- **Fixed: blank page after leaving the map.**
  - Cause: the scale bar's cleanup called `removeControl` on a map that `MapView` had already removed. React runs
    the parent's cleanup first.
  - Fix: the scale bar now lives in `MapView`, and a persistent `ErrorBoundary` around the pages (`ui/ErrorBoundary.tsx`)
    turns any page error into a notice instead of an empty app.
  - Verified: a 48-step headless click-through (page switches, account change, base maps, theme, cells, tabs) ran
    with no blank page and no console errors.
  - Rule now noted in `MapView`: child cleanups may only call `map.off` and `marker.remove()`.
- **Presentation mode (default on), at the professor's request** to show the finished look:
  - DEMO/SAMPLE badges are hidden, and the server's demo wording is reworded for display (`web/src/ui/presentation.ts`):
    "Demo farmer" becomes "Farmer"; the `DEMO:` prefixes, "(sample)" and "SAMPLE report(s)" are dropped.
  - The server, the API data and the status fields are unchanged. The map's "Data sources and limits" note still
    says the crop types are SAMPLE.
  - Turn the labels back on with **Show data labels** at the foot of the map's layers panel (the page reloads).
  - The README and docs still describe what is real and what is synthetic.
- **Servers:** every test server on :8010–:8013 has been stopped, and so has the old one on :8000, so none is
  running. Start your own with `.venv\Scripts\python -m uvicorn satquery.server:app --port 8000` (uses the real
  `data/loungak.sqlite3`). The built `web/dist` already contains all of the above.

## Presentation deck (31 Oct 2026)

- **File:** `HFSS/LouNgak_AI_HSC_Presentation.pptx`. It has 7 slides on the Hack for Social Cause template (team
  oval, logo, footer; the instructions slide is deleted, as the template asks). Save it as a **PDF** for the portal.
  Slides: cover; problem and solution; technical approach (flowchart from the actual code); impact; feasibility and
  risk; team; references with the comparison table.
- **Built with:** a pptxgenjs script that lived in a temporary session folder and is **not** in the repo or backed up.
  Edit the PPTX directly in PowerPoint; asking for a rebuild means regenerating it from this description.
- **Still to fill in (placeholders in square brackets):**
  - Team ID (cover);
  - demo video link (slide 3);
  - the three member names (slide 6).
- **Content decisions:**
  - No mention of SIH or SatQuery AI anywhere (the user's call: it should not read as a re-used project);
  - the journey on slide 6 is the team's own story (started naive, learned as they built, sleepless nights);
  - roles: member 1 (the user) leads product, geospatial data and the risk engine and chose the Copernicus and
    Sentinel-2 data; member 2 designed and decided what the app shows; member 3 did research, data sourcing and
    testing and typed the Manipuri text.
- **To double-check before submitting:**
  - the comparison table: the NPSS and Manipur agromet columns come from `docs/pest-data-sources.md`; the Plantix,
    Meghdoot and Google Earth Engine cells are from general knowledge;
  - the theme (AI, GIS & Emerging Technologies) against what was chosen on the portal;
  - the "extent of AI tools" wording on slide 3;
  - the link to `docs/geo/map-data-sources.md` (slide 7): it resolves now that the map work is on `main`.

## Push checklist (the Context docs go public with the repo)

The Context docs are part of the repository, so everything in them is published on GitHub with the code. Before each
push:

1. **Update these docs first.** Bring progress.md (done, next, blockers, session log), agents.md (new conventions or
   gotchas) and refined_foundation.md (decisions, status table) up to date, so GitHub never shows stale state.
2. **Run the checks:** `.venv\Scripts\python -m pytest`, then in `web/`: `npm test`, `npm run typecheck`,
   `npm run build`. Update the counts quoted in these docs if they changed.
3. **Scan for secrets and personal data** in what will be published (`git ls-files -m -o --exclude-standard`): no
   value from `.env`, no local paths or personal emails. `.env.example` must stay untouched with empty values.
4. **Never add** `.env`, `data/` (local database and the Survey of India file), `uploads/` or `runs/` (all are in
   `.gitignore`).
5. **Review the wording** of docs that name people or advice (for example, decision D15 credits the professor's
   advice) and the team's decision to keep the SIH project out of the story.
6. Commit with conventional prefixes, then push only when the team lead says so.

**Last audit (31 Oct 2026, before the agricultural map commit):**
- 63 files in the commit (map backend and frontend, tests, docs, the build script, the OSM and WorldCover assets,
  and 5 deleted legacy map components);
- none contains a value from `.env`, a credential-like string, a local path or a personal email, and no secret is
  found in the history being pushed;
- `.env`, `data/`, `uploads/` and `runs/` are ignored, `.env.example` holds empty values, and the PPTX is not in the
  repo;
- pytest 852 passed (3 skipped), Vitest 126 passed, typecheck clean, production build OK, `git diff --check` clean.

## Commit and push (31 Oct 2026)

- The team lead authorised publishing the map work. It is one commit, "feat: add statewide agricultural intelligence
  map", on `feat/agri-map`. That branch is pushed to `origin`, and `main` is fast-forwarded to it and pushed. The
  hash is in `git log`.
- `feat/mvp-slice` stays at the Sprint 0 commit (`c8c49be`). Existing tags and `future/conversation-voice-stub` are
  untouched. Nothing was force-pushed.
- The deck PPTX sits outside the repo and is not published.
- For later work: start a new branch from `main`, keep these docs current, and follow the push checklist above.

## Decisions log

| Date | Decision | By |
|---|---|---|
| 31 Oct | Planning docs in `LouNgak-AI/Context/` | User |
| 31 Oct | Stage 1 = thin end-to-end slice, submitted as the GitHub link around noon | User |
| 31 Oct | AI assistant: deterministic default; optional LLM layer later (explain and summarise only) | User |
| 31 Oct | Remove legacy and dead code | User |
| 31 Oct | SQLite + demo accounts with server-side checks; no scheduler; H3 res 8; IMD rainfall categories | Claude (engineering) |
| 31 Oct | Presentation mode on by default: inline DEMO/SAMPLE labels hidden; disclosure kept in the map's data sources and the docs; one switch restores labels | User (professor's advice) |
| 31 Oct | The deck does not mention SIH or SatQuery AI; the journey is told as this project's own | User |
| 31 Oct | Map: H3 res 7 display cells; WorldCover cropland; SAMPLE crop colours; OSM reference district outlines; cells show their zone's level only | Claude (engineering, from the user's map brief) |

Full register: [refined_foundation.md §10](refined_foundation.md#10-decisions-register).

## Open questions and blockers

- **Real-device check:** the UI was clicked through in headless Chrome at desktop and phone width and by the user,
  but not on a real phone. Do this before recording.
- **Submission blockers:** fill in the deck placeholders (team ID, member names, video link); record the demo video;
  save the deck as PDF; submit the repo link on the portal.
- Who records the video, and on which machine? That machine needs `.env`, a built `web/dist` and a warm-up.
- An agronomist or KVK contact to review `pest_rules.json` and the Crop Atlas.
- Copernicus quota on the demo machine; whether to rotate the credentials.
- **The map's crop types are SAMPLE.** Find a real source (DES district crop areas, a crop-type map) before
  presenting crops as real; say "illustrative" in the video.
- Also see [refined_foundation.md §11](refined_foundation.md#11-open-questions).

## Next (Stage 2, in order)

1. Situation report (printable HTML) per zone, district or drawn area.
2. Per-cell NDVI, and the WorldCover cropland share as the NDVI mask (the share itself is built and drawn).
3. Optional LLM explanation layer (with template fallback).
4. Automatic district routing of reports from the OSM outlines (the outlines themselves now ship).
5. Farmer reports and outcomes feeding the risk engine (replacing SAMPLE reports).
6. Water/flood alerts from Sentinel-1.

## Session log

| Date | Who | What changed | Next |
|---|---|---|---|
| 31 Oct 2026, 00:45–02:30 IST | User + Claude | Audit; cleanup; Sprint 0 backend and frontend; README; Context docs | Browser click-through, video, deck, submit |
| 31 Oct 2026, 09:10–14:15 IST | User + Claude | Agricultural map: WorldCover cropland, SAMPLE crops, zone risk on cells, OSM districts, layers panel, search and filters, cell summary and details; legacy map UI removed. Fixed the blank page after leaving the map and added an error boundary. Presentation mode (DEMO/SAMPLE labels hidden by default). 7-slide HSC deck built. Docs brought current; full checks and security audit; map work committed, pushed and `main` fast-forwarded (team lead's approval) | Fill in the deck placeholders; record the demo video; save the deck as PDF; submit |
| 31 Oct 2026, 14:30 IST | User + Claude | Rewrote the demo video script (refined_foundation.md §9) for the new agricultural map — the old one still described the pre-map "zoom in, the pins" flow on the 7-rectangle map | Record the video; save the deck as PDF; submit |
| _date_ | _who_ | _what changed_ | _what's next_ |
