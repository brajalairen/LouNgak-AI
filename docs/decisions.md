# Decisions

Newest first. Each entry gives the date, the decision, and why. Older decisions (31 Oct 2026) are in
`Context/progress.md` and `Context/refined_foundation.md` section 10.

## 19 Nov 2026

### I. The snapshot fills missing inputs; it never replaces live field reports

Before, when live data was more than 5% less complete than the saved snapshot (for example NDVI unreachable at the
venue), the whole snapshot was served, so a new farmer report or inspection outcome did not change the score until
the network came back. Now only the inputs that are unavailable live (weather, NDVI) are taken from the snapshot,
labelled SNAPSHOT, and the zone is re-scored. Field reports always come from the app's own database. The whole
snapshot is still served in snapshot mode or when the live assessment fails outright. `save_snapshot` and
`warm --save-snapshot` refuse to freeze an assessment with filled inputs, so old data never rolls forward under a
new date.

**Why.** The live demo moment (a report raises the zone's score) must work exactly when the network is poor, which
is when the snapshot is in use.

### J. The web client refreshes the risk overview after every change

The overview was fetched once when the app started, so after a report the priority panel and the map's zone
colours kept the old score while the drawer showed the new one. The client now re-fetches the overview and the
open drawer 1.5 s and 5 s after any session change (report, outcome, account switch), and every minute while the
page is visible, with no loading state; a failed refresh keeps what is shown.

**Why.** The map and the drawer must never disagree in front of judges.

## 18 Nov 2026

### D. Decision A is implemented as the real feed: field reports drive the score

The report factor now counts the app's own farmer reports and inspection outcomes (`satquery/agri/field_reports.py`).
Evidence sets the weight: a farmer's report +1, a concern an officer observed +2, an inspection that did not observe
it −1, with the total floored at 0 (PLACEHOLDER, in `risk_model.json`). Dismissed reports, categories other than pest
and disease, and DEMO records do not count. The SAMPLE generator stays behind `SATQUERY_AGRI_REPORTS=sample`. When it
is on, its labels show in every mode, because presentation mode no longer rewords SAMPLE pest-report text.

**Why.** It removes the largest synthetic input (review P0-2) and makes "farmers and officers inform the system" true.
DEMO records are excluded so that demonstration data never moves a real score.

### E. DEMO and real records never share an inspection

`create_task` refuses a mix. **Why.** It keeps the promise that demo data is never mixed with real data, and it lets
`seed-demo` restore the demo scenario by deleting DEMO inspections without stranding a real report.

### F. Persisting alerts are identified by episode

Crop-health and pest/disease alerts are keyed by rule, zone and the date the episode started (stored as
`alert_episode`). An episode continues while the alert reappears within 3 days, which also covers a server that was
off for a day. Heavy-rain alerts keep their forecast day in the id. Expired alerts, DEMO included, are hidden.
**Why.** It fixes review P0-3 and P0-4: acknowledgements and inspections no longer lose their alert overnight.

### G. An NDVI value inside the earlier years' range is not a decline

**Why.** In the harvest weeks an earlier harvest easily gives an 8% drop, which raised false crop-health alerts (review
P2-2, step 6a). The cropland mask and per-cell NDVI (step 6b) remain to do.

### H. Smart App Control stays on

On the development laptop, Smart App Control blocks `.venv\Scripts\python.exe`, but not the base uv interpreter. The
README gives the base-interpreter command. **Why.** Windows cannot switch Smart App Control back on without a reinstall.

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
