# LouNgak AI

**From geospatial observation to early warning and informed action: agricultural and environmental
intelligence for Manipur.**

LouNgak AI combines satellite imagery, weather data, geospatial analysis and regional crop knowledge to show
agricultural officers **where attention may be needed and why**. It then connects each warning, and each problem
a farmer reports, to a human **field inspection and verification**:

**Monitor → Detect → Explain → Prioritise → Report → Assign → Inspect → Verify**

It is a working **prototype** built for *Hack for Social Cause* (VBYLD 2027), with Manipur as the pilot.
Synthetic, placeholder and demonstration data are labelled as such wherever they appear (see
[Limitations](#limitations)).

![LouNgak AI workflow](docs/diagrams/overview.png)

## Who it is for

- **Farmers and rural communities** can see local alerts and crop knowledge, report a suspected problem in their
  field without registering a farm, and follow what happens to the report.
- **Agricultural officers** get a map-first view of monitored farmland, alerts with their evidence, a review queue
  that explains its order, inspection assignment and field verification.

LouNgak AI is decision support. It points to where the evidence suggests a closer look. It never claims that a
pest or disease is present, never issues official warnings and never prescribes treatments.

## What it does

| Module | What you can do |
|---|---|
| **Situation Monitor** | A map of seven monitored farmland zones in the Manipur valley, coloured by the explainable risk engine, with an H3 hexagonal grid (resolution 8, ~0.74 km² cells), farmer reports and inspections, district drill-down, and a "Why is this area at risk?" panel with the score breakdown and data provenance. |
| **LouNgak Watch** | Alerts by category (weather, pest, disease, crop health; water and environment are reserved), each showing its **priority**, **evidence status** (forecast / rule-triggered / satellite-observed …), **rule status** (sourced / placeholder / unvalidated / demo), validity, evidence, limitations and sources. |
| **Report an issue** | Farmers report a suspected pest, disease, damage or waterlogging with a map pin or device location. Reports are stored as *unverified* and routed to the officer responsible for the district. |
| **Field Operations** | Officers work a review queue of farmer reports and alerts, where every item states why it sits where it does. They approve inspections, assign field officers who cover the district, and see a per-zone summary. |
| **My inspections** | Field officers record one of five outcomes (concern observed, not observed, inconclusive, different issue, follow-up required) with crop condition, symptoms and optional GPS. The farmer sees the outcome, never the internal notes. |
| **Crop Atlas** | DRAFT profiles for rice, Chak-hao (GI-registered black rice of Manipur) and maize. Each section is marked *sourced*, *to verify* or *source needed*, and the profiles say what LouNgak can and cannot monitor. |
| **Ask a question** | English or Manipuri (Latin script or Meitei Mayek), e.g. *Which areas are high risk?*, *Why is Bishnupur flagged?*, *How healthy is the crop here?* A deterministic router sends each question to the risk engine, the weather forecast or satellite analysis. |
| **Satellite analysis** | For a drawn area or an uploaded GeoTIFF: crop health (NDVI), water (NDWI, with Sentinel-1 radar when cloudy), change over time, and an optional remote-sensing vision-language model. |

### How alerts are decided

Rules decide and AI explains. Thresholds live in data files, each with a status:

- **Weather (heavy rain):** the forecast daily rain at each zone's weather point is compared with the IMD
  24-hour rainfall categories (heavy ≥ 64.5 mm, very heavy ≥ 115.6 mm, extremely heavy ≥ 204.5 mm). Evidence
  status: *forecast*.
- **Crop health:** NDVI over the last 30 days against the same dates in up to three earlier years
  (Sentinel-2). Evidence status: *satellite-observed*. Published as a *qualified watch*, because NDVI shows
  vegetation vigour, not disease, and harvest also lowers it.
- **Pest and disease watch:** weather conducive to rice blast or brown planthopper under PLACEHOLDER rules.
  Evidence status: *rule-triggered*, low priority, *qualified watch*: conducive weather is not evidence that a
  pest is present.

The rules are in [satquery/watch/assets/alert_rules.json](satquery/watch/assets/alert_rules.json) and
[satquery/agri/assets/](satquery/agri/assets/).

## Demo walkthrough

Start the server (below), open **http://127.0.0.1:8000** and switch demo accounts from the top bar. They are
labelled DEMO and are not authentication, but the server enforces each account's role and jurisdiction.

1. **Public visitor → Alerts and Crop Atlas.** Local alerts with their evidence and limitations; the rice,
   Chak-hao and maize profiles.
2. **Demo farmer (Bishnupur) → Report an issue.** Drop a pin, choose the crop and the problem, and send. The
   report is stored as *farmer-reported, unverified*.
3. **Demo district officer (Bishnupur) → Field Operations.** The review queue lists the report with its reasons:
   a farmer report that matches an active alert in the same zone is raised to high priority. Approve an
   inspection and assign it to the Bishnupur field officer.
4. **Demo field officer (Bishnupur) → My inspections.** Start the inspection and record the outcome.
5. **Back to the farmer → My reports.** The progress bar shows *Inspected*, with the officer's summary.
6. **Demo state-level officer → Situation Monitor.** The zones, H3 cells, reports and inspections on the map; ask
   *Which areas are high risk?*

`python -m satquery.ops seed-demo` adds two DEMO farmer reports and one DEMO heavy-rain alert, so the workflow
can be shown when the real evidence is quiet; `python -m satquery.ops reset` removes all field-operations records.

## Architecture

| Layer | Technologies |
|---|---|
| Web client (`web/`) | React 18, TypeScript, Vite, Tailwind CSS, MapLibre GL, Terra Draw, Zustand |
| Backend (`satquery/`) | Python, FastAPI, Uvicorn, Pydantic, httpx; serves the API and the built web client on one port |
| Field operations (`satquery/ops/`, `satquery/store.py`) | Demo accounts with role and jurisdiction checks; reports, review queue, inspections, outcomes; SQLite |
| Alerts (`satquery/watch/`) | Category-specific alerts derived from the risk engine's evidence, with a publishing gate and deduplication |
| Geography (`satquery/grid.py`) | H3 hexagonal grid (resolution 8) over the monitored zones |
| Crop Atlas (`satquery/atlas/`) | Source-tagged crop profiles as data |
| Risk engine (`satquery/agri/`) | Rule-based scoring; weights, rules and zones are data files in `satquery/agri/assets/` |
| Language (`satquery/agent/`) | Rule-based intent routing, Latin Manipuri lexicon, Meitei Mayek transliteration |
| Imagery (`satquery/agent/`, `satquery/specialists/`, `satquery/providers/`) | Rasterio, NumPy, SciPy; PyTorch, Transformers and PEFT for the optional vision-language model |

The Python package is named `satquery` after the satellite-query engine at its core, and its settings use the
`SATQUERY_` prefix. See [docs/architecture.md](docs/architecture.md) for where each stage lives in the code.
Product direction, decisions and progress are in [Context/](Context/).

## Prerequisites

- **Python 3.12** (3.10 to 3.12 are supported; 3.13 and newer are not), ideally with [uv](https://docs.astral.sh/uv/).
- **Node.js 20 or newer** with npm.
- **Internet access** for weather, satellite imagery, place search and basemaps (see
  [External services](#external-services)).
- Optional, for satellite imagery: a free **Copernicus Data Space Ecosystem** account.
- Optional, for the vision-language model: about 3.5 GB of disk for the model download, plus 1–3 GB for PyTorch.
  An NVIDIA GPU makes a model call take under a second (about 2 GB of VRAM); on CPU it takes roughly 15–20 seconds.

## Installation

The commands are for Windows PowerShell. On Linux or macOS, use `.venv/bin/python` instead of
`.venv\Scripts\python` and `cp` instead of `Copy-Item`.

On Windows, clone into a short path such as `D:\LouNgak-AI`: the evaluation test split has file paths up to 100
characters long, which exceeds Windows' 260-character limit inside a deep folder. Alternatively, run
`git config --global core.longpaths true` before cloning.

```powershell
git clone https://github.com/brajalairen/LouNgak-AI.git
cd LouNgak-AI

# 1. Python environment
uv venv --python 3.12 .venv
uv pip install --python .venv -e ".[server,copernicus,dev]"

# 2. Web client
cd web
npm ci
npm run build
cd ..

# 3. Configuration
Copy-Item .env.example .env
```

This installs everything except the vision-language model. To add it (needed only for open-ended image questions
such as scene description), install the model extras as well:

```powershell
# Optional, NVIDIA GPU only: install the CUDA build of PyTorch first
uv pip install --python .venv torch==2.8.0 --index-url https://download.pytorch.org/whl/cu128
uv pip install --python .venv -e ".[server,copernicus,dev,models,adaptation]"
```

The `adaptation` extra pins PEFT 0.17.1 and Accelerate 1.10.1 next to Transformers 4.49.0 (the Falcon model's
code does not work with Transformers 4.50 or newer). Install them through this extra; a separate `pip install peft`
can upgrade Transformers and break the model.

## Configuration

Settings are read from environment variables, or from a `.env` file in the repository root. `.env` is gitignored;
never commit real credentials, and never put them in `.env.example`. Start from `.env.example`, which lists every
setting with its default.

| Variable | Default | Purpose |
|---|---|---|
| `SATQUERY_VLM_BACKEND` | `fake` | `falcon` runs the vision-language model (needs the model extras); `fake` gives placeholder text for open-ended image questions. `.env.example` sets `falcon`: change it to `fake` if you did not install the model. |
| `COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET` | empty | Copernicus Data Space OAuth client, for live Sentinel-1/2 imagery and the NDVI factor |
| `SATQUERY_DB_PATH` | `data/loungak.sqlite3` | SQLite file for reports, inspections and alert acknowledgements (gitignored) |
| `SATQUERY_DEVICE` | `auto` | `auto`, `cuda` or `cpu` for the model |
| `SATQUERY_FALCON_ADAPTER` | `adapters/falcon-bigearthnet-vqa-lora` | The included LoRA adapter; set it empty to run the base model |
| `SATQUERY_AGRI_DISTRICTS` | empty | Path to a district-boundary GeoJSON, drawn as map context only (none is included; see [docs/geo/](docs/geo/district-boundaries-sources.md)) |
| `SATQUERY_AGRI_PEST_RULES`, `SATQUERY_AGRI_RISK_MODEL` | the files in `satquery/agri/assets/` | Reviewed replacements for the placeholder pest rules and risk weights |
| `SATQUERY_AGRI_MODE` | `live` | `live` (falls back to a saved snapshot when live data is incomplete) or `snapshot` |
| `SATQUERY_AGRI_OFFLINE` | off | `1` serves cached agricultural data only, with no network calls |
| `SATQUERY_WEATHER` | `open-meteo` | `off` disables weather questions |

**Copernicus credentials:** create a free account at [dataspace.copernicus.eu](https://dataspace.copernicus.eu),
open the Sentinel Hub dashboard, go to **User settings → OAuth clients**, create a client, and copy its ID and
secret into your `.env` (the secret is shown only once). Without credentials the app still runs: the risk engine
scores zones from weather and pest reports with lower data completeness, crop-health alerts are not produced, and
imagery questions about a drawn area explain that retrieval is not configured.

## Running

```powershell
.venv\Scripts\python -m satquery.ops seed-demo   # optional: DEMO reports and alert for the walkthrough
.venv\Scripts\python -m uvicorn satquery.server:app --port 8000
```

Open **http://127.0.0.1:8000**. FastAPI serves the API and the built web client on this one port. The first risk
assessment is computed in the background at start-up, so the dashboard and alerts fill in after a few seconds.

**Frontend development:** run the backend as above, then `npm run dev` in `web/` and open
**http://localhost:5173**. Vite reloads on changes and forwards `/api` to port 8000.

**Risk engine from the command line:**

```powershell
.venv\Scripts\python -m satquery.agri assess        # rank the demo zones with live data
.venv\Scripts\python -m satquery.agri thresholds    # show whether thresholds are PLACEHOLDER or VERIFIED
.venv\Scripts\python -m satquery.agri warm --save-snapshot --crop-health
```

`warm` fetches today's data, saves it as the fallback snapshot (`runs/agri/snapshot.json`) used when live data is
incomplete, and warms the crop-health imagery cache. Run it before a presentation so the dashboard never waits on
a slow provider.

## Tests and production build

The tests use synthetic data: no GPU, network or credentials.

```powershell
.venv\Scripts\python -m pytest     # backend
cd web
npm test                           # frontend unit and page smoke tests (Vitest)
npm run typecheck                  # TypeScript
npm run build                      # production build into web/dist
cd ..
```

`tests/test_contract.py` checks that every wire model in Python matches its TypeScript mirror in
`web/src/state/types.ts` field for field. Tests that call real services are deselected by default: `pytest -m live`
runs them (Copernicus and Open-Meteo, which use quota), and `pytest -m gpu` the model tests.

## External services

LouNgak AI is not an offline application. It calls:

| Service | Used for | Account |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Hourly weather for the risk engine and alerts; forecasts | None (free API) |
| [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu) | Sentinel-2 NDVI for the risk engine and crop-health alerts; Sentinel-1/2 imagery for drawn areas | Free account (OAuth client) |
| OpenStreetMap Nominatim | Place search; district context for zones | None |
| OpenFreeMap / OpenStreetMap and Esri World Imagery | Basemaps in the browser | None |
| Hugging Face | One-time download of the vision-language model (optional) | None |

Each source fails independently: an unreachable source makes its part of an answer unavailable, and says so,
without stopping the rest.

## Limitations

- **Prototype, not a validated prediction.** Risk scores and alerts point to where an inspection may help; they
  are not probabilities and have not been calibrated against field outcomes.
- **Demo accounts, not authentication.** Anyone can switch accounts. The server enforces each account's role and
  jurisdiction, but identity is not verified. Records created by `seed-demo` are labelled DEMO.
- **Placeholder thresholds.** The pest rules, risk weights and the crop-health alert threshold are PLACEHOLDERS
  until an agronomist verifies them, so their alerts are qualified watches. The heavy-rain categories follow IMD's
  terminology but are applied to model forecasts at one point per zone; they are not IMD warnings.
- **No official warnings yet.** IMD, CWC and NDMA warnings are not integrated: always follow official warnings.
- **Synthetic pest reports in the risk score.** No public, machine-readable pest or disease observation dataset for
  Manipur was found ([docs/pest-data-sources.md](docs/pest-data-sources.md)), so the risk engine's report factor
  uses generated reports labelled "SAMPLE DATA — Prototype Simulation". Farmer reports from the app are not yet fed
  into the score.
- **Demonstration zones and grid.** The seven monitored zones are hand-drawn rectangles, not administrative
  boundaries. H3 cells index locations; they carry no per-cell measurement yet, and no cropland mask is applied.
  A report's district is the one the reporter chose.
- **NDVI measures vegetation vigour**, not disease, over all clear land in a zone. Weather is model data for one
  point per zone. Cloud often hides the valley in the monsoon, and then the NDVI factor is unavailable.
- **Crop Atlas is DRAFT.** Not reviewed by an agronomist, KVK or the Department of Agriculture; regional details
  are marked *to verify* or *source needed*.
- **Manipuri.** The answer templates were reviewed by a fluent speaker; the routing lexicon is still a draft.
  Weather answers and the new pages are in English only.
- **Imagery.** Heuristic components (spectral and radar thresholds, change maps, optical/radar agreement) are
  labelled as heuristics, and confidence values are not calibrated. Live retrieval is limited to drawn areas up to
  400 km², and radar change over time is not supported.
- **Vision-language model.** The LoRA adapter improves yes/no questions about Sentinel-2 patches only; see
  [experiments/adaptation/README.md](experiments/adaptation/README.md) for its evaluation.
- **No conversation mode.** Each question is answered on its own; the microphone button only dictates text. A
  design note for conversation is kept on the `future/conversation-voice-stub` branch.

## Data and licences

- Code: Apache License 2.0 ([LICENSE](LICENSE)).
- Weather: Open-Meteo.com, CC BY 4.0 (attributed in every weather answer).
- Satellite imagery: Copernicus Sentinel data via the Copernicus Data Space Ecosystem. LouNgak AI is not affiliated
  with or endorsed by Copernicus or the European Commission.
- Rainfall categories: India Meteorological Department terminology (referenced, not IMD warnings).
- Hexagonal grid: [H3](https://h3geo.org) (Apache 2.0).
- Place and district names: OpenStreetMap contributors (ODbL); district names follow India's Local Government
  Directory.
- District boundaries (optional, not included): Survey of India. See
  [docs/geo/district-boundaries-sources.md](docs/geo/district-boundaries-sources.md).
- Demo imagery in `demo/examples/` and the test split in `experiments/adaptation/test_split/`: BigEarthNet v2.0 /
  BigEarthNet.txt (CDLA-Permissive-1.0) and modified Copernicus Sentinel data; see the READMEs there.
- Model: `mehmetbayik/Falcon-Single-Instruction-Large` on Hugging Face, downloaded at run time under its own
  licence. The LoRA adapter in `adapters/` was trained for this project
  ([experiments/adaptation/](experiments/adaptation/README.md)).
- Basemaps: OpenFreeMap / OpenStreetMap contributors, and Esri World Imagery.
