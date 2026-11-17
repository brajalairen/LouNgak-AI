# HANDOFF: what to do next

Read `CLAUDE.md` first. The full detail for every task is in `docs/REVIEW-2026-11-17.md`. Section 2 covers the
problems, and section 5 is the step-by-step plan. Do the tasks in this order, one commit each, with the backend
tests green before and after.

## Tasks in order

### Task 1: baseline (review step 0)

- Run `.venv\Scripts\python -m pytest`.
- In `web/`, run `npm ci`, `npm test`, `npm run typecheck` and `npm run build`.
- Record the counts in `PROGRESS.md`.
- **Acceptance:**
  - The backend shows 852 passed and 3 skipped, or any difference is explained.
  - The frontend tests, typecheck and build pass. They have not been run since 31 Oct.

### Task 2: permission and integrity fixes (review step 1)

- In `satquery/ops/service.py` `create_task`, check every report and alert. Each must be in the officer's
  jurisdiction, open, and not already in another open task.
- Make `satquery/store.py` `next_id` allocate and insert atomically.
- Validate `due_on` as a date, and the outcome GPS fields as coordinates.
- **Acceptance:**
  - A Bishnupur officer bundling a Thoubal report gets 403.
  - Re-tasking an INSPECTED report gets 409.
  - 50 concurrent report submissions produce 50 distinct ids and 50 rows.
  - All existing tests still pass.

### Task 3: non-blocking risk refresh (review step 2)

- In `satquery/agri/service.py` `snapshot()`, return the old snapshot at once when it has expired, and recompute in
  one background thread.
- Block only when no snapshot exists. Add `invalidate()`.
- **Acceptance:**
  - With a source that sleeps 2 s, a call after expiry returns in under 100 ms with the old snapshot.
  - A later call returns the new one.
  - Ten concurrent calls trigger only one recompute.

### Task 4: alert ids, expiry, demo seed and pre-demo check (review step 3)

- In `satquery/watch/alerts.py`, key alerts by rule, zone and episode start, not by today's date.
- Filter out expired alerts, including the DEMO alert, in `satquery/ops/service.py`.
- Make `seed-demo` idempotent (`satquery/ops/seed.py`).
- Set `SATQUERY_VLM_BACKEND=fake` in `.env.example`.
- Add `python -m satquery.ops preflight`. It checks:
  - that `web/dist` exists;
  - the VLM backend against an importable torch;
  - Copernicus credentials;
  - that the snapshot is under 24 h old;
  - that the database is writable;
  - the seed state.
- **Acceptance:**
  - The same firing rule on two consecutive days gives the same alert id.
  - Acknowledgements and linked tasks survive the day change.
  - An expired demo alert is hidden.
  - Running `seed-demo` twice leaves 2 demo reports and 1 demo alert.
  - Preflight exits non-zero with `falcon` and no torch.

### Task 5: honest report feed (decision A; review step 5, upgrade 1)

- Feed real farmer reports and inspection outcomes into the risk score's report factor, and switch the SAMPLE
  generator off by default.
- Or, if there is no time, show "simulated demo data" on screen in every mode, and remove the presentation-mode
  rewording in `web/src/ui/presentation.ts`.
- **Acceptance:**
  - Real path: one new farmer report raises its zone's report points on the next overview and cites the report
    id, and `includes_sample_data` is false.
  - Label path: no screen shows SAMPLE reports without the "simulated demo data" label.

After task 5, continue with review steps 4 and 6 to 9 as time allows. Step 10, the Sentinel-1 rice calendar, waits
until after the hackathon (decision C).

## Demo-risk problems from the review

These are not fixed yet. They could break or discredit a live demo.

1. **The page freezes on refresh.** Every 30 minutes the risk recompute holds a lock, and all risk, alert, queue
   and map requests wait (`satquery/agri/service.py:180-185`). Task 3 fixes this.
2. **The ranking is decided by synthetic data.** Synthetic pest reports with hand-set per-zone pressure largely
   decide the ranking, and presentation mode presents them as a "report feed". Task 5 fixes this.
3. **Alerts change identity daily.** Acknowledgements and linked tasks are orphaned overnight. Task 4 fixes this.
4. **The DEMO alert never expires.** It shows a past "valid until" date if it was seeded weeks ago. Until task 4 is
   done, run `python -m satquery.ops reset` and then `python -m satquery.ops seed-demo` before demoing.
5. **`.env.example` selects the real model.** It sets `SATQUERY_VLM_BACKEND=falcon`, but the default install has
   no torch, so a fresh machine fails on the first image question. Task 4 fixes this. Until then, set `fake` in
   `.env`.
6. **Identity is a header** (`X-Demo-User`), and uploads and imagery fetches are unauthenticated and unlimited.
   Do not expose the server through a public tunnel until review step 9 is done.

## Open questions for the user

1. **Hackathon date.** What is the exact date and slot of the next round? `Context/refined_foundation.md` lists
   the state-level round as 7 Nov to 5 Dec 2026 and national shortlisting as 5 to 15 Dec 2026. Confirm on the
   portal, because that decides how many tasks fit.
2. **Team task split.** Who owns which tasks above? Who records any new video? Which machine runs the demo? That
   machine needs `.env`, a built `web/dist` and a warm-up run.
3. **Report factor path.** For task 5, should it be the real feed, or the on-screen label as a stopgap?
4. **Copernicus credentials.** Should they be rotated before the demo? `Context/refined_foundation.md` section 12
   notes they were once found in `.env.example`, though never committed.
