# PROGRESS: current state

**As of:** 17 Nov 2026. The project is paused for a few weeks for exams.

This file is the current state. `Context/progress.md` is the older session log up to 31 Oct 2026 and has not been
updated since. Use it for history only.

## Where the code is

- **Branch:** `feat/agri-map`, pushed to `origin`. The handoff commit sits on top of the review commit.
- **Last code change:** `89a682d` (31 Oct 2026). No application code has changed since.
- **Review commit:** `f607b87`, which adds `docs/REVIEW-2026-11-17.md`. It is a read-only technical review with
  ranked problems, the top 5 upgrades and a step-by-step plan.
- **Handoff files** (this session): `CLAUDE.md`, `PROGRESS.md`, `HANDOFF.md`, `docs/decisions.md`.

## Verification status

| Check | Result | When |
|---|---|---|
| Backend tests (`pytest`) | 852 passed, 3 skipped (live and GPU tests deselected) | 17 Nov 2026 |
| Frontend tests (`npm test`, typecheck, build) | **Not run** | — |
| App opened in a browser | **No** | — |
| Secret scan | No credentials found in tracked files or git history; `.env.example` holds placeholders only | 17 Nov 2026 |

The local `.env` sets `SATQUERY_VLM_BACKEND=fake`. PyTorch is not installed in `.venv`.

## What works today

- **Risk engine:** a rule-based engine scores 7 demo zones from weather, NDVI and pest reports. The pest reports
  are SAMPLE (synthetic).
- **Alerts:** LouNgak Watch shows heavy-rain, crop-health and pest/disease alerts.
- **Field workflow:** farmer reports, the officer review queue, inspection tasks and outcomes, with demo accounts.
- **Map:** a statewide H3 map with WorldCover farmland, a SAMPLE crop pattern and OSM district outlines.
- **Questions:** English and Manipuri question routing, and an optional Falcon VLM with a LoRA adapter.

## Known problems, not yet fixed

See `docs/REVIEW-2026-11-17.md` section 2. The demo risks are summarised in `HANDOFF.md`.

## Next

Start with `HANDOFF.md`, task 1. The priorities are recorded in `docs/decisions.md`.
