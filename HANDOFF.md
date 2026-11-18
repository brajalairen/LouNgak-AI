# HANDOFF: what to do next

Read `CLAUDE.md` first, then `PROGRESS.md`. The detail behind every task is in `docs/REVIEW-2026-11-17.md`: section 2
covers the problems, and section 5 is the step-by-step plan. The demo is on **22 Nov 2026**.

## Done on 18 Nov 2026 (committed 19 Nov as one commit on `feat/stage2-hardening`)

Review steps 0, 1, 2, 3, 5 and 6a are done, with the backend at 883 passed and the frontend at 127 passed. See
`PROGRESS.md` for what each step changed. The branch is not pushed.

## Before the demo (22 Nov), on the presenting machine

1. `python -m satquery.agri warm --save-snapshot --crop-health`: today's data, plus the offline fallback. This uses
   Copernicus quota.
2. `python -m satquery.ops seed-demo`: the DEMO alert is valid for 3 days from this run, so run it on 20 Nov or later.
3. `python -m satquery.ops preflight`: fix every FAIL.
4. Start the server and click through the demo once in a browser. This has not been done since 31 Oct.

On this laptop, run each command through the base interpreter (README, "Windows and Smart App Control").

**Live demo moment (new).** As the Bishnupur farmer, report a *pest* inside the Nambol zone. Then open the zone's
"Why is this area at risk?" panel. Its score rises, and the report factor names the report by id. After the field
officer records "Concern observed", it rises again. Expect the level to stay LOW in dry November weather: that is
the honest result, so say so. Waterlogging reports do not count towards pest pressure.

## Still open, in order of value

1. **Browser rehearsal** of the whole script (`Context/refined_foundation.md` section 9). Add the field-report moment
   above to the narration: the script predates it.
2. **Crop-type SAMPLE wording.** Presentation mode still hides "Crop types and shares are SAMPLE" in the cell panel,
   though the data-sources note keeps it (D15, the professor's advice). Decision A covers only pest reports. Consider
   whether the same credibility argument applies before judges ask.
3. **Review step 4:** derive a report's district from the pin, using the shipped OpenStreetMap outlines.
4. **Review step 7:** a printable situation report.
5. **Review step 8:** a confidence label that varies, and pest-watch tuning: currently every zone is "low"
   confidence while thresholds are PLACEHOLDER.
6. **Review step 9:** do this before any public tunnel, because identity is still only the `X-Demo-User` header.
7. **Review step 6b:** a cropland-masked, per-cell NDVI. Measure its Copernicus cost first.
8. **Step 10:** the Sentinel-1 rice calendar, after the hackathon (decision C).

## Open questions for the user

1. **Push:** push `feat/stage2-hardening` to GitHub, and fast-forward `main`? Run the push checklist in
   `Context/progress.md` first.
2. **Team task split:** who rehearses, which machine presents, and who updates the video narration?
3. **Copernicus credentials:** rotate them before the demo? `Context/refined_foundation.md` section 12 has the
   history.
