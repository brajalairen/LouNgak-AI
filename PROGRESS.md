# PROGRESS: current state

**As of:** 18 Nov 2026. State-level demo on **22 Nov 2026**.

This file is the current state. `Context/progress.md` is the older session log up to 31 Oct 2026 and has not been
updated since. Use it for history only.

## Where the code is

- **Branch:** `feat/stage2-hardening`, branched from `feat/agri-map` (`156eec2`). Not pushed.
- **Committed:** the 18 Nov work below is one commit on that branch (19 Nov 2026, at the user's request: "feat: demo
  hardening and field reports drive the risk score").
- **Review:** `docs/REVIEW-2026-11-17.md`. Decisions so far: `docs/decisions.md` (A to H).

## Verification status

| Check | Result | When |
|---|---|---|
| Backend tests (`pytest`) | **883 passed, 3 skipped** (live and GPU tests deselected). Baseline before the work: 852 passed, 3 skipped | 18 Nov 2026 |
| Frontend (`npm test`, typecheck, build) | **127 passed**, typecheck clean, build OK. Baseline: 126 passed, clean, OK | 18 Nov 2026 |
| Threaded tests repeated 8 times | 38 of 38 passed every run (refresh, alert lifecycle, field reports, ops) | 18 Nov 2026 |
| Real server, end to end over HTTP | Passed: live Open-Meteo weather, Copernicus switched off, throwaway database | 18 Nov 2026 |
| App opened in a browser | **No.** Click through the demo once before the 22nd | — |
| `python -m satquery.ops preflight` on this laptop | 0 FAIL, 2 WARN: no saved snapshot, and the DEMO alert has expired (run `seed-demo`) | 18 Nov 2026 |

The end-to-end run on the real server, in the Bishnupur zone, in dry November weather:
1. With no reports, the score is 0 (LOW), and the report factor says so in words.
2. After a farmer's pest report, the score is 9.5 within one poll of about 250 ms. The "why" text cites
   `RPT-0001 (pest, farmer-reported, unverified, +1)`.
3. After the officer records "concern observed", the score is 19.1.
4. The farmer sees the outcome, without the officers' notes. `includes_sample_data` was false throughout.

**This laptop:** Windows Smart App Control blocks `.venv\Scripts\python.exe` ("An Application Control policy has
blocked this file"). Run Python through the base uv interpreter instead: the README section "Windows and Smart App
Control" gives the command, and it was tested on 18 Nov. Do not switch Smart App Control off.

## What changed on 18 Nov 2026

1. **Permission and integrity (review step 1).**
   - `create_task` checks every report and alert: jurisdiction, one district per inspection, the report still
     open, and nothing already in an open inspection.
   - A wrong assignee no longer leaves an orphan task.
   - Ids are allocated and inserted atomically (`Store.insert_new`).
   - `due_on` must be a date, and GPS fields must be valid coordinates given as a pair.
2. **Non-blocking refresh (step 2).**
   - After 30 minutes, the previous assessment is served while one background thread recomputes it.
   - `invalidate()` starts that recompute at once.
   - A failed refresh keeps the old assessment and retries after 60 s.
3. **Alert identity, expiry, seed and preflight (step 3).**
   - Persisting alerts are keyed by rule, zone and episode start, so acknowledgements and tasks survive overnight.
   - Expired alerts, the DEMO one included, are hidden with a note.
   - `seed-demo` is idempotent and leaves real records alone.
   - `.env.example` now selects `fake`.
   - New command: `python -m satquery.ops preflight`.
4. **Field reports drive the score (step 5, decision A).**
   - The report factor counts the app's own pest and disease reports and inspection outcomes: +1, +2 or −1 by
     evidence, with PLACEHOLDER weights.
   - DEMO records never count.
   - The SAMPLE generator sits behind `SATQUERY_AGRI_REPORTS=sample`. Presentation mode no longer rewords SAMPLE
     pest-report text, and `SampleLabel` shows in every mode.
   - The risk drawer lists each field record with its id, evidence and weight.
5. **NDVI range-aware (step 6a).** A value inside the earlier years' range scores 0, so an earlier harvest does not
   raise a crop-health alert.
6. **Docs:** README (pre-demo routine, Windows note, limitations), `docs/architecture.md`, `docs/decisions.md` (D to
   H), and the stale parts of `Context/agents.md` and `Context/refined_foundation.md`.

## What works today

- **Risk engine:** 7 demo zones, scored from weather, NDVI and the app's own field reports.
- **Alerts:** stable alert ids with expiry.
- **Field workflow:** report → queue → inspection → outcome, which feeds back into the score.
- **Map:** the statewide H3 map, with SAMPLE crop colours (still labelled only in the data-sources note; see
  `HANDOFF.md`).
- **Questions:** English and Manipuri question routing.

## Next

See `HANDOFF.md`: commit the work, run the pre-demo routine, then do a browser rehearsal.
