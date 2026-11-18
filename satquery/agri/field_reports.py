"""Field reports for the report-pressure factor: what farmers report in the app and what officers find.

This closes the loop the product describes: farmer reports and inspection outcomes feed back into the
zone's risk score, instead of the SAMPLE generator (`reports.py`, now off by default). It only gathers
facts; the weights are applied by `risk.report_factor` from the risk model (PLACEHOLDER values).

What counts, for one area and the look-back window (Manipur local dates):
- a farmer report located inside the area: `farmer_reported` while it is unconfirmed (submitted, under
  review, inspection pending, inconclusive, follow-up required);
- once inspected: `concern_observed` or `concern_not_observed`, dated by the officer's outcome. A report
  whose inspection found a different issue, and a dismissed report, no longer count;
- an inspection raised from a pest or disease alert alone (no farmer report): its observed or not
  observed outcome, at the alert's point.

DEMO records never count: demonstration data must not move a real score. An empty store gives an
available factor of 0 with that stated, never an estimate. Officer-observed is not laboratory-confirmed.
"""

from datetime import date, datetime, timedelta, timezone

from satquery.agri import areas as geometry
from satquery.agri.models import MonitoredArea, PestReport, Provenance
from satquery.ops.models import FarmerReport, InspectionTask
from satquery.store import Store, now_iso

SOURCE = "LouNgak AI field reports (farmer reports and inspection outcomes)"
NOTE = ("Farmer reports are unverified until a field officer inspects them; an officer's observation is not a "
        "laboratory diagnosis. DEMO records are not counted.")
MANIPUR = timezone(timedelta(hours=5, minutes=30))
UNCONFIRMED = ("INCONCLUSIVE", "FOLLOW_UP_REQUIRED")
OUTCOME_EVIDENCE = {"CONCERN_OBSERVED": "concern_observed", "CONCERN_NOT_OBSERVED": "concern_not_observed"}
ALERT_CATEGORIES = ("pest", "disease")  # an alert id starts with its category, e.g. "disease.rice_blast...."


def local_date(timestamp: str) -> date:
    return datetime.fromisoformat(timestamp).astimezone(MANIPUR).date()


def _record(record_id: str, area: MonitoredArea, latitude: float, longitude: float, observed: date, crop: str,
            category: str, evidence: str) -> PestReport:
    return PestReport(id=record_id, area_id=area.id, latitude=latitude, longitude=longitude,
                      observed_on=observed.isoformat(), crop=crop, pest=category, source="FIELD", synthetic=False,
                      verified=evidence == "concern_observed", label="", evidence=evidence)


class FieldReportSource:
    """The report source behind `Sources.reports` when SATQUERY_AGRI_REPORTS=field (the default)."""

    def __init__(self, store: Store):
        self.store = store

    def for_area(self, area: MonitoredArea, end: date, lookback_days: int) -> tuple[list[PestReport], Provenance]:
        first = end - timedelta(days=lookback_days - 1)
        tasks = {t.id: t for t in self.store.all("task", InspectionTask)}
        found = []
        for report in self.store.all("report", FarmerReport):
            if report.is_demo or report.status == "DISMISSED":
                continue
            if not geometry.contains(area.geometry, report.longitude, report.latitude):
                continue
            task = tasks.get(report.task_id) if report.task_id else None
            outcome = task.outcome if task is not None and task.status == "COMPLETED" else None
            if outcome is None or outcome.result in UNCONFIRMED:
                evidence, observed = "farmer_reported", local_date(report.submitted_at)
            elif outcome.result in OUTCOME_EVIDENCE:
                evidence, observed = OUTCOME_EVIDENCE[outcome.result], local_date(outcome.recorded_at)
            else:  # DIFFERENT_ISSUE: what was found is not the reported concern
                continue
            if first <= observed <= end:
                found.append(_record(report.id, area, report.latitude, report.longitude, observed, report.crop,
                                     report.category, evidence))
        for task in tasks.values():
            if task.report_ids or task.is_demo or task.status != "COMPLETED" or task.outcome is None:
                continue
            categories = sorted({i.split(".", 1)[0] for i in task.alert_ids} & set(ALERT_CATEGORIES))
            evidence = OUTCOME_EVIDENCE.get(task.outcome.result)
            if not categories or evidence is None:
                continue
            if not geometry.contains(area.geometry, task.longitude, task.latitude):
                continue
            observed = local_date(task.outcome.recorded_at)
            if first <= observed <= end:
                found.append(_record(task.id, area, task.latitude, task.longitude, observed, task.outcome.observed_crop,
                                     categories[0], evidence))
        provenance = Provenance(source=SOURCE, state="LIVE", retrieved_at=now_iso(),
                                covers=f"{first.isoformat()} to {end.isoformat()}", note=NOTE)
        return sorted(found, key=lambda r: (r.observed_on, r.id), reverse=True), provenance
