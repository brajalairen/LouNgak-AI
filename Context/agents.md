# Working on LouNgak AI: guide for contributors and AI agents

**Read this first, then [progress.md](progress.md) (where things stand) and
[refined_foundation.md](refined_foundation.md) (what we are building and why).**
[foundation_v1.md](foundation_v1.md) is the original long-form product brief: background, not instructions.

## The project in five lines

LouNgak AI is an agricultural and environmental intelligence platform for Manipur. Satellite imagery
(Sentinel-1/2), weather (Open-Meteo) and crop knowledge drive explainable alerts. Those alerts, and farmers' own
reports, flow into an officer workflow: review, assign, inspect, verify. One FastAPI backend (Python package
`satquery`) serves the API and the built React client on one port. It is a hackathon prototype (Hack for Social
Cause, VBYLD 2027) that must stay honest about what is real, placeholder or demo.

## Repository map

| Path | What lives there |
|---|---|
| `satquery/server.py` | FastAPI app factory `create_app()`; imagery, upload and weather endpoints; mounts all routers and `web/dist` |
| `satquery/agri/` | Risk engine: zones (`assets/demo_areas.geojson`), weather, NDVI, SAMPLE reports, rules, scoring (`risk.py`), service and snapshot, `/api/agri/*` |
| `satquery/watch/` | LouNgak Watch: `alerts.py` derives alerts from the assessment; rules in `assets/alert_rules.json` |
| `satquery/ops/` | Field operations: `models.py` (wire models), `users.py` (demo accounts, permission helpers), `service.py` (workflow rules), `routes.py` (`/api/ops/*`, `/api/watch/*`), `seed.py` + `__main__.py` (DEMO data CLI) |
| `satquery/store.py` | SQLite document store (`data/loungak.sqlite3`, gitignored) |
| `satquery/grid.py` | H3 grid (resolution 8), `/api/grid/zones` |
| `satquery/atlas/` | Crop Atlas data (`assets/crops.json`) and `/api/atlas/crops` |
| `satquery/agent/`, `specialists/`, `providers/` | Imagery question answering, Copernicus retrieval, Open-Meteo forecast, Falcon VLM |
| `web/src/shell/` | `useSession` (demo account, current page), `AppShell` (top bar) |
| `web/src/pages/` | One file per page; `pages.test.ts` smoke-renders them from `fixtures.json` |
| `web/src/ops/` | Shared field-ops UI (`ui.tsx` chips, labels, `useLoad`), `TaskDialog` |
| `web/src/map/`, `agri/`, `sidebar/`, `command/`, `results/` | The map page and its overlays (risk layer, H3, ops pins, drawer, question bar) |
| `web/src/state/` | `api.ts` (typed client, sends `X-Demo-User`), `types.ts` (mirrors the Python wire models) |
| `tests/` | pytest; `test_ops.py` covers alerts, grid, atlas and the field-ops loop; `test_contract.py` checks Python ↔ TS types |
| `docs/` | Architecture, pest data-source assessment, district boundary sources |
| `experiments/adaptation/`, `adapters/` | LoRA training and evaluation for the VLM |
| `Context/` | These planning documents |

## Setup, run, test (Windows PowerShell)

```powershell
uv venv --python 3.12 .venv
uv pip install --python .venv -e ".[server,copernicus,dev]"
cd web; npm ci; npm run build; cd ..
Copy-Item .env.example .env      # then put real Copernicus credentials in .env (never in .env.example)

.venv\Scripts\python -m satquery.ops reset        # clear reports, tasks, acknowledgements, DEMO alerts
.venv\Scripts\python -m satquery.ops seed-demo    # add the DEMO reports and alert
.venv\Scripts\python -m uvicorn satquery.server:app --port 8000   # http://127.0.0.1:8000

.venv\Scripts\python -m pytest                    # backend (no network, GPU or credentials)
cd web; npm test; npm run typecheck; npm run build
```

Before a demo, run `python -m satquery.agri warm --save-snapshot --crop-health` so the dashboard never waits on a
provider. For frontend work, `npm run dev` in `web/` (port 5173, proxies `/api` to 8000).

## Ground rules (product honesty)

1. **Rules decide, AI explains.** No LLM output may create or change a threshold, score, alert, priority or
   official warning.
2. **Never invent** agronomic numbers, crop calendars, pest prevalence, field observations, beneficiaries or
   impact figures. If a source is missing, write *source needed*.
3. **Label everything** that is not real and verified: `SAMPLE` (synthetic pest reports in the risk score),
   `PLACEHOLDER` (unverified thresholds), `UNVALIDATED` (rules built on placeholders), `DEMO` (seeded workflow
   records), `DRAFT` (Crop Atlas).
4. **Keep the dimensions separate:** category, priority, evidence status, rule status and record status are
   different fields. Do not merge them into one score or colour.
5. Missing ≠ zero; stale ≠ current; an anomaly ≠ a diagnosis; farmer-reported ≠ verified; officer-observed ≠
   laboratory-confirmed.
6. **Privacy:** farmers never see officers' internal notes or other farmers' reports; the public sees no reports
   or tasks. Enforce this on the server (see `satquery/ops/service.py`), not only in the UI.
7. **Secrets:** credentials go in `.env` only (gitignored). Never commit `.env`, never put real values in
   `.env.example`, and never commit the Survey of India district file (`data/` is gitignored for this reason).

## Engineering conventions

- **Wire contract:** every pydantic model sent to the browser has a TypeScript mirror in
  `web/src/state/types.ts` and an entry in `MIRRORED` in `tests/test_contract.py`. Change both sides together.
- **Thresholds are data,** with a `status` field (`SOURCED`, `PLACEHOLDER`, `UNVALIDATED`, `VERIFIED`), in JSON
  under `assets/`. Code reads them; it does not hard-code them.
- **Settings** come from environment variables with the `SATQUERY_` prefix (`satquery/settings.py`).
- **Permissions** live in `OpsService` using `covers(user, district)` and roles; routes only resolve the demo user.
- **Map layers** must re-add their sources when `styleReady` turns true (a basemap switch drops runtime sources).
  Follow `web/src/agri/RiskLayer.tsx` or `web/src/map/H3Layer.tsx`.
- **`useLoad(fn)`** needs a stable function (`api.*` or `useCallback`), or it reloads on every render.
- **Style:** match the surrounding code. Module docstrings explain *why*; comments are sparse and specific. TS is
  strict with `noUncheckedIndexedAccess` (index results may be `undefined`). Tailwind tokens: `surface`, `sunken`,
  `line`, `ink`, `muted`, `faint`, `accent`, `warn`, `danger`, `ok`.
- **Tests:** backend tests never touch the network (`tests/agri_helpers.py` has fakes); `tests/conftest.py` sets
  `SATQUERY_DB_PATH=:memory:`. Live tests are marked `live` and deselected by default.

## Gotchas

- Windows: clone to a short path or `git config --global core.longpaths true` (long test-split filenames).
- `uv sync` removes packages outside the lock, such as torch. Install the model extras with `uv pip install`.
- The Falcon model needs `transformers==4.49.0`. Use `SATQUERY_VLM_BACKEND=fake` without the model extras.
- `web/dist` must be built for the single-port server; without it only the API is served.
- Several agri tests hard-code the 7 demo zone ids; changing `demo_areas.geojson` means updating them.
- The first `/api/agri/overview` or `/api/watch/alerts` after a start runs the full assessment (seconds to a
  minute with live NDVI).
- Git on Windows warns "LF will be replaced by CRLF": harmless.

## Workflow

- **Branches:** work on a feature branch (current: `feat/mvp-slice`) and keep `main` fast-forward-only. Never
  rewrite `main` history or delete the `archive/*` and `backup/*` tags.
- **Commits:** small and reviewable, conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`). Run the tests
  before committing.
- **Pushing** publishes to the public GitHub repo, so push only when the team lead asks.
- **At the end of every work session:** update [progress.md](progress.md) (done / next / blockers, plus a line
  in the session log) and record any decision in the decisions table, here or in refined_foundation.md §10.
- **When unsure** whether something is real data or a placeholder, treat it as a placeholder and label it.
