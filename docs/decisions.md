# Decisions

Newest first. Each entry gives the date, the decision, and why. Older decisions (31 Oct 2026) are in
`Context/progress.md` and `Context/refined_foundation.md` section 10.

## 17 Nov 2026

### A. Simulated pest reports are never shown as a real feed

The risk score's pest-report factor uses synthetic reports from `satquery/agri/reports.py`, with per-zone pressure
set by hand in `satquery/agri/assets/sample_scenario.json`. Presentation mode currently rewords them as
"LouNgak AI report feed" (`web/src/ui/presentation.ts`).

**Decision.** Do one of the following:

1. Replace them with real farmer reports and inspection results from the app's own database (review upgrade 1,
   `docs/REVIEW-2026-11-17.md` section 3; implementation plan step 5).
2. Or label them on screen as "simulated demo data", in every mode, including presentation mode.

They must never be shown as a real feed.

**Why.** The review (problem P0-2) found that this hand-set config largely decides which zone ranks highest. Showing
synthetic reports as a feed is the single biggest credibility risk in front of judges.

### B. Priority before the hackathon: review steps 0 to 3

**Decision.** Before any new feature, do implementation plan steps 0 to 3 from `docs/REVIEW-2026-11-17.md` section 5:

- step 0, baseline tests;
- step 1, permission and integrity fixes;
- step 2, a non-blocking risk refresh;
- step 3, stable alert ids, alert expiry, an idempotent demo seed, and a pre-demo check command.

**Why.** These steps prevent the failures most likely to happen during a live demo: frozen pages, alerts losing their
tasks overnight, an expired DEMO alert, and a missing model on a fresh machine. Together they take about 1.5 days.

### C. The Sentinel-1 rice-season calendar is deferred until after the hackathon

**Decision.** The stand-out idea in `docs/REVIEW-2026-11-17.md` section 4 waits until after the hackathon. That idea
is a per-cell rice calendar built from Sentinel-1 radar time series, validated against district statistics. It is
step 10 in the implementation plan.

**Why.** It takes 3 to 5 days and needs validation before anything can be shown in the app. Steps 0 to 3 and the
honest report feed matter more for the next demo.
