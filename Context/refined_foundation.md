# LouNgak AI — Refined Foundation

> **Status:** v1.1, 31 October 2026. Supersedes [foundation_v1.md](foundation_v1.md) for **decisions and scope**.
> `foundation_v1.md` stays the long-form reference for principles, user roles, SDG and hackathon detail.
> **Read order for newcomers:** [agents.md](agents.md) → [progress.md](progress.md) → this file.

This document is the product foundation after (1) an audit of the code actually in the repository, and (2) a
feasibility review of every proposal in `foundation_v1.md`: what we keep, what we make concrete, what we defer and
what we drop. It also records what the Sprint 0 slice built for the Stage 1 submission.

---

## 1. Product in one page

**LouNgak AI is an agricultural and environmental intelligence platform for Manipur. It combines satellite
imagery, weather data, geospatial analysis and regional crop knowledge to issue explainable early warnings, and
connects those warnings, and farmers' own reports, to human field inspection and verification.**

*Tagline:* From geospatial observation to early warning and informed action.

**Problem.** Agricultural officers cannot inspect every field. Farmers notice problems, but their reports are
delayed and scattered. Satellite and weather data hold useful signals, but they are hard to read and do not lead
to field action on their own.

**The loop:** Monitor → Detect → Explain → Prioritise → Report → Assign → Inspect → Verify → Learn.

**Users** (one application, two dashboards):

| Dashboard | Who | Core jobs |
|---|---|---|
| Community & Farmer | Farmers, rural community, public visitors | Local alerts, Crop Atlas, report an issue, follow own reports |
| Agricultural Officer | Field officers, district officers, state-level officers | Situation map, alerts with evidence, review queue, assign inspections, record verification |

**What it is not:** a chatbot with an agriculture theme; an imagery viewer with no workflow; a replacement for
officers, IMD, CWC or NDMA; a disease-diagnosis or pesticide-prescription system; a flood forecaster; an
ERP/marketplace/insurance engine.

### Non-negotiable honesty rules

1. Rules decide; AI only retrieves, explains and summarises. An LLM never creates a threshold, score, alert or
   official warning.
2. **Priority, evidence status, rule status and record status are separate fields.** One colour or number never
   carries both urgency and certainty.
3. Missing ≠ zero ≠ normal. Stale ≠ current. Cloud-obscured ≠ healthy. An anomaly ≠ a diagnosis.
   Farmer-reported ≠ verified. Officer-observed ≠ laboratory-confirmed. A forecast ≠ an observed event.
4. All synthetic, placeholder and demo data is labelled where it appears: `SAMPLE`, `PLACEHOLDER`, `UNVALIDATED`,
   `DEMO`.
5. Never invent crop distribution, pest prevalence, thresholds, field observations, beneficiaries or impact.
   Unknown stays unknown, shown as *source needed*.

---

## 2. Hackathon context and timeline

**Programme:** Hack for Social Cause, under Viksit Bharat Young Leaders Dialogue (VBYLD) 2027, through the MY
Bharat portal. Theme: *Think Global, Hack Local – Technology for Social Transformation.*

**Positioning:** primary theme **AI, GIS & Emerging Technologies**; supporting themes **Rural Development &
Livelihoods** and **Environment & Sustainability**. Disaster mitigation is mentioned only as agricultural hazard
awareness, not as a theme we claim. **SDGs:** 2 (Zero Hunger, targets 2.3 and 2.4) and 13 (Climate Action, 13.1)
are primary; 15 (Life on Land) and 11 are supporting. We describe a *contribution*, never an achievement.

| Stage | Dates | What we need |
|---|---|---|
| 1 Registration & submission | until **31 Oct 2026** (team target: noon) | Problem statement, 6–7 slide deck, repo link, 3–5 min video, self-declaration, ID proofs |
| 2 State-level hackathon and demo | 7 Nov – 5 Dec 2026 | Live demo of a coherent end-to-end workflow; mentoring |
| 3 National shortlisting (IIT Bombay) | 5–15 Dec 2026 | Top 10 per state/UT |
| 4 National showcase, New Delhi | 10–12 Jan 2027 | Top 5 for awards |

The self-declaration and ID proofs are human tasks: they cannot be automated. Re-check the live portal for any
change to dates or formats.

---

## 3. Audit of the repository (31 Oct 2026)

The repository started at commit `bf22d3e`: a working crop & pest risk dashboard plus a satellite-imagery
question-answering engine. The table shows the state **after** Sprint 0 (branch `feat/mvp-slice`).

| Status | Capability | Where |
|---|---|---|
| **Implemented & tested** | Risk engine: 7 demo zones; Open-Meteo hourly weather (14 past + 7 forecast days, one point per zone); Sentinel-2 NDVI anomaly (30-day window vs up to 3 earlier years); SAMPLE pest reports; PLACEHOLDER weights 0.5/0.3/0.2; missing inputs excluded, never estimated; snapshot/offline modes | `satquery/agri/` |
| Implemented & tested | Imagery Q&A: intent → plan → execute → aggregate; Sentinel-1/2 retrieval (≤ 400 km² rectangles); NDWI with SAR fallback; change detection; HTML/JSON reports; optional Falcon 0.7B + LoRA model | `satquery/agent/`, `specialists/`, `providers/` |
| Implemented & tested | English/Manipuri question routing; Meitei Mayek → Latin transliteration; 24 reviewed Manipuri answer templates (lexicon still DRAFT) | `satquery/agent/language.py`, `satquery/agri/answer_language.py` |
| **Implemented in Sprint 0** | LouNgak Watch: heavy-rain (IMD categories), crop-health (NDVI) and pest/disease-watch alerts derived from the assessment; separate priority / evidence / rule status / gate; stable ids (dedupe); acknowledgements | `satquery/watch/` |
| Implemented in Sprint 0 | Field operations: demo accounts with server-side role and jurisdiction checks; farmer reports (unverified) → review queue with reasons → inspection tasks → assigned field officer → 5 verification outcomes → farmer-visible status; DEMO seed | `satquery/ops/`, `satquery/store.py` |
| Implemented in Sprint 0 | H3 resolution 8: every report and task carries its cell | `satquery/grid.py` |
| **Implemented after Sprint 0** | Agricultural map: statewide H3 resolution-7 cells (3,993); cropland per cell from ESA WorldCover 2021 (SOURCED); crop colours from a SAMPLE pattern; each zone's level on its cells; alerts, reports and inspections as markers; OpenStreetMap district outlines (REFERENCE); layers panel with legends; search and filters; cell summary and detail panel with actions | `satquery/agmap/`, `scripts/build_map_assets.py`, `web/src/agmap/`, [docs/geo/map-data-sources.md](../docs/geo/map-data-sources.md) |
| Implemented in Sprint 0 | Crop Atlas: DRAFT profiles for rice, Chak-hao and maize, each section tagged SOURCED / TO_VERIFY / SOURCE_NEEDED | `satquery/atlas/` |
| Implemented in Sprint 0 | Web: top bar with role-aware pages and DEMO account switcher; Situation Monitor (map), Alerts, Field Operations, My inspections, Report an issue, My reports, Crop Atlas | `web/src/shell/`, `web/src/pages/` |
| **Partial** | Combined situation summary: per-zone counts only (no situation-report document yet) | `/api/ops/situation` |
| Partial | Water analysis exists on demand for a drawn area, but there are no water/flood alerts | `satquery/specialists/tools.py` |
| Partial | Archived contracts for inspections and observations (tag `archive/recover-local-ag04-work`): ideas were ported, not the files | git tag |
| **Not implemented** | Real authentication; official IMD/CWC/NDMA warnings; crop-type data (the map's crops are SAMPLE); per-cell risk or NDVI analysis; automatic district routing of reports; verified district boundaries in the repository; farmer reports feeding the risk score; situation reports; LLM explanation layer; notifications; offline field mode; farm registration | — |
| **Removed in Sprint 0** | Legacy Gradio HF Space (`app.py`, `satquery/ui.py`), imagery CLI (`satquery/cli.py`), SIH-era `presentation-assets/`, dead code (see progress.md) | — |

**Tests (31 Oct 2026, after the agricultural map):** 852 backend (pytest; 3 skipped) and 126 frontend (Vitest), all
passing. `tests/test_contract.py` keeps the 64 Python wire models and their TypeScript mirrors in step.

---

## 4. Feasibility review of foundation_v1

### 4.1 Keep (sound, and either built or ready to build)

- **Identity and scope:** agricultural intelligence plus early warning, connected to field action. Not a disaster
  command centre.
- **Two dashboards in one app.** Built as role-aware pages behind one top bar.
- **Hybrid rules + AI**, with AI never deciding risk.
- **Separate category, priority, evidence status and rule status** on every alert. Built.
- **Two entry paths into one officer workflow** (system alert, farmer report). Built.
- **Hierarchical assignment** (state → district → field officer) with configurable titles, and the **five
  verification outcomes**, recorded by the assigned field officer with no supervisory approval by default. Built.
- **Farm registration optional.** H3 monitoring and reports work without a registered farm. Built.
- **Crop Atlas** for rice, Chak-hao and maize, source-backed. Built as DRAFT.
- **Provenance on everything.** Each alert carries its sources, retrieval times and limitations.

### 4.2 Improve: the vague parts made concrete

| Topic in v1 | Decision now | Why |
|---|---|---|
| H3 resolution ("to be decided") | **Resolution 8** (~0.74 km², ~0.5 km edge) for analysis inside monitored zones; resolution 7 (~5.2 km², ~4,300 cells statewide) if a statewide display grid is added | Res 8 holds ~7,400 Sentinel-2 pixels per cell, enough for a stable statistic, and is still far larger than a valley farm, so we never present cells as farms. The 7 zones give 491 cells, which is light to draw. |
| Per-cell analysis | **Stage 2:** retrieve one NDVI raster per zone (each zone is within the 400 km² limit) and aggregate it per cell locally, not one API call per cell | Avoids 4 Statistical API calls × 491 cells; keeps Copernicus quota manageable |
| Weather resolution | Weather stays **one shared model point per zone**, labelled as such; never copied to cells as if observed there | Output precision cannot exceed input precision |
| Weather alert thresholds | **IMD 24-hour rainfall categories** (heavy ≥ 64.5 mm, very heavy ≥ 115.6 mm, extremely heavy ≥ 204.5 mm), status SOURCED, to be confirmed against IMD's current glossary | A named authority instead of invented numbers; capped at High because they are forecasts, not IMD warnings |
| Agricultural land mask | **Stage 2:** ESA WorldCover 2021, 10 m, CC BY 4.0, cropland fraction per cell precomputed offline into a small asset; check visually against imagery (valley paddy may be classed as wetland or grassland) | Licensed, documented, redistributable, one-off cost |
| District boundaries | **Stage 2:** OpenStreetMap admin_level 5 (ODbL) as the shipped asset for jurisdiction routing; the Survey of India file stays local only (no redistribution permission) | Today a report's district is the reporter's choice, which is honest but not verified |
| Database | **SQLite through stdlib `sqlite3` + pydantic**, one document table; PostGIS only if multi-user production ever happens | No new service to run; the prototype's scale is thousands of records |
| Authentication | **Demo account switcher** (`X-Demo-User` header) with real server-side role and jurisdiction checks, labelled "not production authentication" | Shows the access model honestly without building identity |
| Job scheduler | **None.** Alerts are derived on request from the cached assessment (30-min refresh, background warm-up at start) | Nothing in the MVP needs a periodic job |
| Alert lifecycle | **Simplified:** derived alerts are `active` or `acknowledged`; expiry is their `valid_until`; ids are dedupe keys | v1's 7-state lifecycle had no consumer yet |
| Task lifecycle | NEW → ASSIGNED → IN_PROGRESS → COMPLETED / CANCELLED; the "accepted" step is dropped | Fewer clicks in the field; it can return if departments need it |
| Priority queue | Transparent rules with the **reasons shown in words**: a farmer report starts at moderate and is raised to high when an active alert of the matching category covers the same zone; then reports before alerts; then oldest first. The officer can override, and the override is recorded | v1 asked for explainable ordering without a formula; this is the smallest honest one |
| AI Assistant | Keep the **deterministic router + reviewed templates** as the default. Add an **optional LLM layer** (e.g. Claude API) only to explain and summarise structured results, behind a setting, with a template fallback | Works with no key or network at a demo; LLM never decides |

### 4.3 Defer to Stage 2 or later (in priority order)

1. **Situation report** (printable HTML, then PDF via the browser) for a zone, district or drawn area, reusing
   the imagery report pattern (`satquery/evidence.py`).
2. **Per-cell NDVI and the cropland mask** (see 4.2). *The WorldCover cropland share per resolution-7 cell is built
   and drawn on the map; using it to mask the NDVI factor, and per-cell NDVI, are still to do.*
3. **Optional LLM explanation layer** for alerts and situation summaries; Manipuri output only from reviewed
   templates or with fluent-speaker review.
4. **District boundaries from OSM** and automatic district routing of reports. *The OSM outlines ship and draw on
   the map; routing a report to the district containing its pin is still to do.*
5. **Farmer reports and verified outcomes feeding the risk engine**, replacing the SAMPLE report factor (the
   seam is `Sources.reports.for_area()` in `satquery/agri/pipeline.py`).
6. **Water/flood alerts** from Sentinel-1 water extent for monitored zones.
7. **Official warnings:** investigate NDMA SACHET's CAP feed and IMD district warnings; link-outs first,
   ingestion only after checking terms.
8. Manipuri UI strings; photo attachments on reports; offline-tolerant field form; alert subscriptions.
9. **Later phases** (as foundation_v1 §16): farm polygons, crop mapping, ML risk models (only with labelled local
   data), route optimisation, notifications (SMS/WhatsApp), multi-state configuration, voice.

### 4.4 Drop (and why)

| Dropped | Why |
|---|---|
| A sixth "environmental/community hazard" category in the MVP UI | No credible data source yet; it remains a reserved schema value (`environment`) and shows a zero count |
| Supervisory approval of outcomes, and the "accepted" task status | The agreed default is that the assigned officer records the outcome; both add steps without users asking for them |
| The Gradio Hugging Face Space, the imagery CLI and SIH-era slides | Legacy, untested, and not part of the product (removed in Sprint 0) |
| Renaming the `satquery` package | Costly churn with no user value |
| VLM scene description and the European BigEarthNet examples as headline demo items | The LoRA adapter only improves yes/no answers on European patches; the VLM stays an optional tool |
| "Kumbh Mela" disaster framing | Not our product; it would weaken the story |
| Seven-state alert lifecycle and a numeric "confidence %" for alerts | Replaced by explicit evidence and rule status, which are defensible; percentages invented by a model are not |

---

## 5. Architecture (as built)

```
web/ (React, MapLibre, Zustand)                     satquery/ (FastAPI, one port, also serves web/dist)
 shell/  top bar, demo account, pages     ──HTTP──▶  agri/    risk engine, /api/agri/*   (weather, NDVI, SAMPLE reports)
 pages/  Monitor, Alerts, Field Ops,                 watch/   alerts derived from the assessment  /api/watch/*
         My inspections, Report, My reports,         ops/     reports, queue, tasks, outcomes      /api/ops/*
         Crop Atlas                                  agmap/   H3 res-7 map cells, WorldCover,      /api/map/*
 agmap/  AgLayers, PinsLayer, LayerPanel,                     SAMPLE crop mix, district outlines
         MapToolbar, CellSummary, CellPanel          grid.py  H3 res-8 cell of each record
 map/    MapView (map, scale bar), AoiLayer          atlas/   crop profiles                        /api/atlas/*
 agri/   RiskLayer (zone outlines, ranks),           agent/, specialists/, providers/   imagery Q&A, /api/analyze …
         PriorityPanel, AreaRiskDrawer               store.py SQLite (data/loungak.sqlite3, gitignored)
 ui/     ErrorBoundary, presentation mode
 results/, sidebar/, command/                        scripts/build_map_assets.py: offline build of the map assets
```

**Key endpoints:** `GET /api/watch/alerts` (public), `POST /api/watch/alerts/{id}/ack`, `POST|GET /api/ops/reports`,
`POST /api/ops/reports/{id}/review`, `GET /api/ops/queue`, `POST|GET /api/ops/tasks`,
`POST /api/ops/tasks/{id}/assign|start|outcome`, `GET /api/ops/situation`, `GET /api/ops/users`,
`GET /api/map/layers`, `GET /api/map/cells/{cell}`, `GET /api/atlas/crops`, plus the existing `/api/agri/*`, `/api/route`, `/api/weather`,
`/api/analyze`, `/api/fetch-imagery`, `/api/uploads`.

**Demo accounts** (`satquery/ops/users.py`): two farmers (Bishnupur, Thoubal), two field officers (Bishnupur;
Thoubal + Kakching), two district officers (same areas), one state-level officer; plus *Public visitor* (no
account).

## 6. Data model (stored records)

All records live in one SQLite table `records(kind, id, doc JSON, updated_at)`; models in
`satquery/ops/models.py` and `satquery/watch/alerts.py`.

| Kind | Key fields | Notes |
|---|---|---|
| `report` (FarmerReport) | id `RPT-0001`; category; crop; growth_stage; description; lat/lon; location_source; district; **h3_cell**; zone_id; reporter; status; `evidence_status = farmer_reported_unverified`; task_id; public_outcome; history[]; officer_notes[] (internal); is_demo | Officer notes are removed before a farmer sees the report |
| `task` (InspectionTask) | id `INS-0001`; report_ids[]; alert_ids[]; lat/lon; h3_cell; district; zone_id; reason; priority + priority_rationale[]; assigned_to; due_on; status; history[]; outcome; is_demo | One task can cover several reports and alerts |
| outcome (inside a task) | result (5 values); observed crop and stage; crop/water condition; symptoms; *suspected* issue; action; follow-up; public_summary; optional GPS; `evidence_status = field_observed_officer` | Never shown as a laboratory diagnosis |
| `alert_state` | alert id; acknowledged by and at | The only stored part of a derived alert |
| `demo_alert` | a full Alert with `rule_status = DEMO`, `is_demo = true` | Only created by `python -m satquery.ops seed-demo` |

Derived (not stored): **Alert**. Fields: category, subtype, priority, evidence_status, gate (`published` /
`qualified_watch`), rule_id, rule_status, zone, district, label point, issued/valid_from/valid_until, evidence[],
limitations[], recommended_action, provenance[], status, is_demo.

## 7. Alert rules in force

| Rule | Category | Evidence status | Priority | Rule status | Gate | Trigger |
|---|---|---|---|---|---|---|
| `heavy_rain` | weather | forecast | moderate (heavy) / high (very or extremely heavy) | SOURCED (IMD terms) | published; qualified if weather is stale | Forecast day total ≥ 64.5 mm with ≥ 20 known hours |
| `crop_health` | crop_health | satellite_observed | moderate | PLACEHOLDER | qualified_watch | NDVI factor score ≥ 0.3 (a drop beyond the engine's ignore band) |
| `rice_blast` | disease | rule_triggered | low | UNVALIDATED | qualified_watch | ≥ 1 forecast day meeting the PLACEHOLDER blast conditions |
| `brown_planthopper` | pest | rule_triggered | low | UNVALIDATED | qualified_watch | ≥ 1 forecast day meeting the PLACEHOLDER BPH conditions |

**Known effect in early November:** the valley's kharif paddy is being harvested and rain is rare, so real
heavy-rain alerts are unlikely and NDVI drops are expected. That is why the seed command adds one clearly
labelled DEMO heavy-rain alert for the walkthrough.

## 8. Phased plan

### Sprint 0, Stage 1 submission (31 Oct 2026): built

The thin end-to-end slice: app shell and demo roles, SQLite store and seed, farmer report → queue → assignment →
outcome → farmer status, Watch alerts, the H3 overlay, and the Crop Atlas. Status per item is in
[progress.md](progress.md).

**Acceptance (all met in tests or on the live server):** a farmer submits at a location without a registered farm;
the report enters the right officer's queue as unverified with its reasons; the officer assigns a covering field
officer; the field officer records an outcome; the farmer sees the outcome without internal notes; alerts show
evidence and limitations; DEMO data is labelled; permissions return 401/403 outside a role or jurisdiction.

### Stage 2 sprint (1 Nov → state demo, from 7 Nov)

Take items 1–6 of §4.3 in order. Acceptance for each: tests in `tests/` and the contract test; a visible label for
any placeholder input; `progress.md` updated.

Also before the state demo:
- an agronomist or KVK review of `pest_rules.json` and the Crop Atlas (even partial);
- run `python -m satquery.agri warm --save-snapshot --crop-health` on the demo machine;
- a rehearsed 7–8 minute live script (§9).

### Later

As in foundation_v1 §16, phases 2–4. Nothing there is claimed until built and tested.

## 9. Demo script and deck outline

> **Update (31 Oct, after the agricultural map):** the script below replaces the pre-map version (it used to say
> "Situation Monitor: zones, H3 cells, pins" for the old 7-rectangle map). It now opens on the statewide map,
> which is the strongest visual, and closes the full report to inspection to outcome loop on camera.

**Video (3-5 min), one story, recorded in presentation mode (`SHOW_LABELS` off, the default):**
1. *(15 s)* **Open on the state map, Satellite basemap, zoomed out.** Let all 16 districts and the crop-coloured
   farmland cells sit on screen for a few seconds before narrating. State the problem over it: officers cannot
   inspect every field, farmers' reports are scattered, satellite and weather data are hard to act on.
2. *(20 s)* **Zoom into Bishnupur, click a hexagon.** The summary card: crop composition, cropland %, the zone's
   risk badge. Say once, on camera: "crop types here are an illustrative pattern; risk is from real weather and
   satellite data." Do not let the zoomed-out map sit on screen while narrating in detail - zoom in first.
3. *(20 s)* **"View details" then "Why is this zone flagged?"** The score breakdown (weather, NDVI, pest-report
   factors, each weighted, with reasons and the PLACEHOLDER/confidence notices). This is the differentiator:
   every number traces to its source, never a bare colour.
4. *(20 s)* **Create an inspection from that cell's active alert**, directly on the map. Proves the loop is
   actionable from the exact place the risk was found, not just a separate workflow.
5. *(15 s)* **Farmer (Bishnupur) to Report an issue.** Drop a pin, describe the problem, send; it shows as
   "unverified".
6. *(20 s)* **District officer (Bishnupur) to Field Operations.** The queue explains its order in words (the
   report is raised because it matches an active alert in the same zone). Approve the inspection, assign it.
7. *(20 s)* **Field officer to My inspections.** Record "Concern observed" with a message for the farmer.
8. *(15 s)* **Farmer to My reports.** The progress bar shows *Inspected*, with the officer's message - the loop
   closes on camera.
9. *(15 s)* **Close** on the Alerts page (evidence/limitation chips) or Crop Atlas (Chak-hao), then the SDGs and
   the Manipur pilot.

Before recording: `python -m satquery.ops reset`, then `python -m satquery.ops seed-demo`, start the server, warm
the assessment (`python -m satquery.agri warm --save-snapshot --crop-health`), and open each page once.

> **Update (31 Oct):** the portal's template is the HSC one (cover, problem and solution, technical approach, impact,
> feasibility and risk, team, references). The deck was built on it: `HFSS/LouNgak_AI_HSC_Presentation.pptx`, with
> placeholders left for the team ID, demo video link and member names. See progress.md.

**Deck (7 slides, the earlier outline):** 1 LouNgak AI: from geospatial observation to early warning and action · 2 The problem in
Manipur · 3 The solution: the loop and the two dashboards · 4 Technology: Sentinel-1/2, Open-Meteo, H3, rules +
AI, field feedback · 5 The working prototype (screenshots, DEMO labels visible) · 6 Social impact and SDGs 2/13
(15/11 supporting) with measurable indicators (foundation_v1 §17) · 7 Pilot plan, milestones, path to other states.

## 10. Decisions register

| # | Date | Decision | Status |
|---|---|---|---|
| D1 | 31 Oct | Docs live in `LouNgak-AI/Context/` | Agreed with user |
| D2 | 31 Oct | Stage 1: build a thin end-to-end slice tonight, submit the repo link around noon | Agreed with user; done |
| D3 | 31 Oct | AI assistant: deterministic default, optional LLM layer later | Agreed with user |
| D4 | 31 Oct | Team of 2–3 with an NVIDIA GPU; Falcon VLM available but not headline | Agreed with user |
| D5 | 31 Oct | Remove legacy and dead code (Gradio app, CLI, SIH slides, unused code) | Agreed with user; done |
| D6 | 31 Oct | SQLite document store; demo accounts with real permission checks; no scheduler | Engineering decision |
| D7 | 31 Oct | H3 resolution 8 inside monitored zones | Engineering decision; revisit with the cropland mask |
| D8 | 31 Oct | IMD rainfall categories for heavy-rain alerts | Engineering decision; confirm against IMD glossary |
| D9 | 31 Oct | Simplified alert and task lifecycles; 5 outcomes kept | Engineering decision |
| D10 | 31 Oct | Real credentials only in `.env` (gitignored), never in `.env.example` | Rule |
| D11 | 31 Oct | Map display grid: H3 resolution 7 statewide; resolution 8 stays the record and analysis cell | Engineering decision |
| D12 | 31 Oct | Crop colours on the map come from a labelled SAMPLE pattern until crop-type data exists; cropland from ESA WorldCover | Engineering decision, following the user's map brief; replace when a source is found |
| D13 | 31 Oct | OpenStreetMap district outlines (ODbL) ship as reference outlines; verified outlines take precedence when configured | Engineering decision (implements §4.2) |
| D14 | 31 Oct | Map cells show their zone's level only (outline over crops, fill without); cells outside zones are "not monitored" | Engineering decision |
| D15 | 31 Oct | Presentation mode on by default: DEMO/SAMPLE labels hidden for the finished-product look; the data sources note, README and docs keep the disclosure; one switch restores labels | User (the professor's advice); implemented by Claude |
| D16 | 31 Oct | The submission deck does not mention SIH or SatQuery AI and tells the project's own journey | User |

## 11. Open questions

| Question | Owner | Needed by |
|---|---|---|
| Can an agronomist, KVK or CAU Imphal review `pest_rules.json` and the Crop Atlas? | Team | State demo |
| Manipur crop calendar and district crop areas: which official source? | Team | Stage 2 |
| Is the IMD glossary URL for rainfall categories still current? | Engineer | Stage 2 |
| WorldCover cropland classes over valley paddy: usable or misleading? (Valley districts average 48–64% cropland; check against imagery) | Engineer | Before the NDVI mask uses it |
| Which source can replace the SAMPLE crop pattern (DES area by crop per district, a crop-type map)? | Team | Before the map's crops are presented as real |
| NDMA SACHET CAP feed: terms, coverage of Manipur, format | Engineer | Stage 2 |
| Real officer titles and jurisdictions in the Manipur Department of Agriculture | Team | Before any pilot |
| Copernicus quota on the demo machine (the NDVI factor costs 4 requests per zone per refresh) | Engineer | State demo |

## 12. Risks

- **Empty real alerts** at demo time (dry season, harvest), so the walkthrough uses the labelled DEMO alert. Say
  so in the video.
- **Copernicus credentials or quota** fail, and the NDVI factor becomes unavailable; the app labels it, and
  `warm --save-snapshot` gives a frozen fallback.
- **Venue network** is slow or down: use `SATQUERY_AGRI_MODE=snapshot`; the basemap falls back to a plain canvas.
- **Secrets:** real Copernicus credentials were once found in `.env.example` (caught before any push). Keep them in
  `.env` only; rotate them if they were ever shared.
- **Windows paths:** clone to a short path or enable `core.longpaths`.
- **Model pins:** Falcon needs `transformers==4.49`; `uv sync` removes torch.
- **Contract drift:** every new wire model needs its TypeScript mirror and a `MIRRORED` entry in
  `tests/test_contract.py`.
