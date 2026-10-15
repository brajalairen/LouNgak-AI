# Product / Model Overview — flowchart notes

Diagram of the LouNgak AI (AG-04) workflow for the SIH final presentation.
Built from the code at commit `7924fba` on `feature/ag04-integration`. Every box is traceable to a
source file; nothing in it is aspirational.

## Files

| File | Use |
|---|---|
| `product-model-overview-flowchart.svg` | Insert into PowerPoint (vector, scales cleanly) |
| `product-model-overview-flowchart.png` | Raster fallback, 6720 × 2240 |
| `product-model-overview-flowchart.mmd` | Editable Mermaid source |

Canvas is 1680 × 560 (3:1), sized to sit in the empty area under the three highlight bullets.

## The workflow in one paragraph

A government user asks a question in plain English or Manipuri, or simply picks a monitored zone on
the map. A deterministic, rule-based layer reads the question's language and intent and routes it to
the crop & pest risk engine, the weather specialist, or satellite imagery analysis; a question that
mixes two of those, or matches nothing confidently, is handed back to be rephrased rather than
guessed at. For a risk question the system gathers three independent pieces of evidence — hourly
weather from Open-Meteo, a Sentinel-2 NDVI anomaly against a three-year baseline for the same
calendar window, and pest reports — and combines them into a single weighted score. Any input that
could not be fetched is excluded from the score rather than estimated, so missing data can never
make an area look safer or more urgent than the evidence supports. The dashboard then colours each
zone by risk level, ranks districts as administrative context, and shows the score's breakdown,
reasons and data provenance, so the officer can see which zone to inspect first and why.

## Where each box comes from

| Stage | Code |
|---|---|
| 1 Ask or select | `web/src/command/AICommandBar.tsx`; `satquery/agent/language.py`, `meitei_mayek.py`; zones in `satquery/agri/assets/demo_areas.geojson` (7) |
| 2 Interpret & route | `/api/route` in `satquery/server.py`; `satquery/agri/query.py` (`decide`); routes `agri` / `weather` / `imagery` / `mixed` |
| 3 Gather evidence | `satquery/agri/pipeline.py` (`default_sources`, `assess_area`); `weather.py` (Open-Meteo), `ndvi.py` (Copernicus Sentinel-2), `reports.py` (SAMPLE) |
| 4 Assess the risk | `satquery/agri/risk.py` (`weather_factor`, `ndvi_factor`, `report_factor`, `combine`); weights in `assets/risk_model.json` |
| 5 Show & explain | `satquery/agri/routes.py`; `web/src/agri/` (`RiskLayer`, `PriorityPanel`, `AreaRiskDrawer`, `StatusStrip`) |

Verified numbers: weights `weather_pest 0.5`, `ndvi_anomaly 0.3`, `report_pressure 0.2`; NDVI window
30 days against 3 baseline years; weather roughly 14 days of history plus a 7-day forecast; report
look-back 14 days; levels at 0.8 / 0.6 / 0.35.

## Deliberately left out — not implemented

- **Trained pest or disease detection model.** None exists. Pest risk is inferred from weather rules,
  NDVI change and reports. The diagram says so explicitly.
- **Real pest/disease surveillance data.** No public machine-readable observation dataset for Manipur
  was found, so reports are SAMPLE (synthetic, labelled). The intake path exists but is unused.
- **Field inspection workflow / verification lifecycle.** Schema only, on another branch; no store,
  no write API.
- **Assessment history, escalation, and the extra read-only endpoints** (`/areas/{id}/history`,
  `/priorities`, `/vocabulary`). On the pest/disease branch, not integrated.
- **Conversation / voice chat.** Removed before the demo (audio feedback-loop bug).
- **Official district boundaries as a shipped asset.** The outlines load from a local file only;
  Survey of India licensing is unresolved, so the derived GeoJSON is not redistributed.
- **Weather answers in Manipuri.** Manipuri risk answers are translated; weather answers stay English.
- **Verified agronomic thresholds.** The pest rules are PLACEHOLDER until an agronomist signs them off.

## Honesty wording kept in the diagram

The bottom strip is deliberately small but present: prototype, synthetic pest reports, unvalidated
thresholds, decision support rather than a validated prediction, NDVI as vegetation vigour rather
than a diagnosis, and no claimed pest-detection model. If a judge asks what is real, the answer is:
the weather data, the satellite NDVI, the routing and the scoring method are real; the pest reports
and the thresholds are not yet.

## Detailed technical version (appendix / Q&A)

| File | Use |
|---|---|
| `detailed-technical-flowchart.svg` | Vector, insert into PowerPoint as an appendix/backup slide |
| `detailed-technical-flowchart.png` | Raster, 2784 × 5512 (portrait — tall, not meant for the main slide) |
| `detailed-technical-flowchart.mmd` | Editable Mermaid source |

This is the branch-by-branch version, for technical Q&A, not the main slide. It shows the exact
routing regex (`INSPECT`/`RANK`/`EXPLAIN`/`AGRI_CONTEXT`+`HERE`), the Manipuri concept-match fallback,
area resolution (named / "here" / ambiguous / no match), each evidence source's real failure modes,
and the precise level/confidence rules from `risk.py`:

- Level bands: score ≥ 0.80 and (≥2 factors ≥ 0.60 AND completeness ≥ 90%) → **CRITICAL**; ≥ 0.80
  without that corroboration → **HIGH**; ≥ 0.60 → **HIGH**; ≥ 0.35 → **MODERATE**; else **LOW**.
  completeness < 50% or no score → **INSUFFICIENT_DATA**.
- Confidence: high/medium/low from completeness (≥90% / ≥60% / below), capped at medium when SAMPLE
  data was used, forced to low while thresholds are PLACEHOLDER.

Because it is this detailed, it renders tall (portrait) rather than fitting a single 16:9 slide —
use it as a linked appendix slide or a leave-behind, not the main visual.
