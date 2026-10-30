# LouNgak AI — Progress

> **Current phase:** Stage 1 submission. Sprint 0 (the thin end-to-end slice) is built and tested.
> **Next deadline:** Stage 1 submission on the MY Bharat portal, **31 Oct 2026** (team target: noon).
> **Then:** Stage 2 state-level demo, from 7 Nov 2026.
> **Branch:** `feat/mvp-slice`, fast-forwarded to `main` for the submission.
> **Update this file at the end of every work session** (see [agents.md](agents.md)).

## Sprint 0 checklist (Stage 1)

| # | Item | Status | Owner |
|---|---|---|---|
| a | App shell: top bar, role-aware pages, DEMO account switcher; SQLite store; `seed-demo` / `reset` CLI | ✅ Done | Claude |
| b | Farmer report → officer queue (with reasons) → inspection → field outcome → farmer status | ✅ Done | Claude |
| c | LouNgak Watch: heavy rain (IMD categories), crop health (NDVI), pest/disease watch; acknowledge; create inspection | ✅ Done | Claude |
| d | H3 grid (res 8) over monitored zones; cell id on reports and tasks; map layers for cells and pins | ✅ Done | Claude |
| e | Crop Atlas: DRAFT rice, Chak-hao and maize profiles with per-section source status | ✅ Done | Claude |
| f | Remove legacy and dead code | ✅ Done | Claude |
| g | README, architecture doc and Context docs updated | ✅ Done | Claude |
| h | Visual click-through of every page in a browser (desktop and phone width) | ☐ To do | Team |
| i | Record the 3–5 min demo video ([script](refined_foundation.md#9-demo-script-and-deck-outline)) | ☐ To do | Team |
| j | 6–7 slide deck ([outline](refined_foundation.md#9-demo-script-and-deck-outline)) | ☐ To do | Team |
| k | Problem statement text for the portal | ☐ To do | Team |
| l | Self-declaration and ID proofs; team lead submits | ☐ To do | Team lead |
| m | Push `feat/mvp-slice` and fast-forward `main` on GitHub | ✅ Done | Claude |
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

## Decisions log

| Date | Decision | By |
|---|---|---|
| 31 Oct | Planning docs in `LouNgak-AI/Context/` | User |
| 31 Oct | Stage 1 = thin end-to-end slice, submitted as the GitHub link around noon | User |
| 31 Oct | AI assistant: deterministic default; optional LLM layer later (explain and summarise only) | User |
| 31 Oct | Remove legacy and dead code | User |
| 31 Oct | SQLite + demo accounts with server-side checks; no scheduler; H3 res 8; IMD rainfall categories | Claude (engineering) |

Full register: [refined_foundation.md §10](refined_foundation.md#10-decisions-register).

## Open questions and blockers

- **Not yet seen in a browser:** the pages pass smoke tests that render real API responses, and the API flow was
  verified live, but nobody has clicked through the UI yet. Do this before recording (item h).
- Who records the video, and on which machine? That machine needs `.env`, a built `web/dist` and a warm-up.
- An agronomist or KVK contact to review `pest_rules.json` and the Crop Atlas.
- Copernicus quota on the demo machine; whether to rotate the credentials.
- Also see [refined_foundation.md §11](refined_foundation.md#11-open-questions).

## Next (Stage 2, in order)

1. Situation report (printable HTML) per zone, district or drawn area.
2. Per-cell NDVI and the ESA WorldCover cropland mask.
3. Optional LLM explanation layer (with template fallback).
4. OSM district boundaries and automatic district routing.
5. Farmer reports and outcomes feeding the risk engine (replacing SAMPLE reports).
6. Water/flood alerts from Sentinel-1.

## Session log

| Date | Who | What changed | Next |
|---|---|---|---|
| 31 Oct 2026, 00:45–02:30 IST | User + Claude | Audit; cleanup; Sprint 0 backend and frontend; README; Context docs | Browser click-through, video, deck, submit |
| _date_ | _who_ | _what changed_ | _what's next_ |
