"""The field-operations workflow and its rules, independent of HTTP.

  farmer report (unverified) -> officer review -> inspection task -> assigned field officer
  -> field outcome (officer-observed) -> the report shows the outcome to the farmer

Alerts from LouNgak Watch enter the same queue. Permissions follow role and jurisdiction: a district
officer sees and assigns only inside their districts, a field officer sees only their own tasks, a
farmer sees only their own reports and never the officers' internal notes.
"""

from datetime import datetime, timezone

from fastapi import HTTPException

from satquery import grid
from satquery.agri.service import AgriUnavailable, AssessmentService
from satquery.ops.models import (DemoUser, FarmerReport, InspectionOutcome, InspectionTask, OfficerNote,
                                 OutcomeCreate, QueueItem, ReportCreate, ReviewAction, StatusChange, TaskAssign,
                                 TaskCreate, ZoneSituation)
from satquery.ops.users import OFFICER_ROLES, USERS, covers
from satquery.store import Store, now_iso
from satquery.watch.alerts import (CATEGORY_LABEL, PRIORITY_ORDER, Alert, AlertState, WatchOverview, derive,
                                   load_rules, sort_alerts)

DISTRICT_NAMES_NOTE = "District as stated by the reporter (district boundaries are not loaded)."
CATEGORY_TO_ALERT = {"pest": "pest", "disease": "disease", "crop_damage": "crop_health", "waterlogging": "weather",
                     "weather_damage": "weather", "other": None}
OPEN_REPORT = ("SUBMITTED", "UNDER_REVIEW", "INSPECTION_ASSIGNED", "FOLLOW_UP")
OPEN_TASK = ("NEW", "ASSIGNED", "IN_PROGRESS")


def _change(user: DemoUser, status: str, note: str | None = None) -> StatusChange:
    return StatusChange(status=status, at=now_iso(), by=user.id, by_name=user.name, note=note)


def _not_found(what: str, record_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"No {what} has the id '{record_id}'.")


def _forbidden(message: str) -> HTTPException:
    return HTTPException(status_code=403, detail=message)


def for_reporter(report: FarmerReport) -> FarmerReport:
    """A report as its reporter sees it: without the officers' internal notes."""
    return report.model_copy(update={"officer_notes": []})


class OpsService:
    def __init__(self, store: Store, agri: AssessmentService, rules: dict | None = None):
        self.store = store
        self.agri = agri
        self.rules = rules or load_rules()

    # ------------------------------------------------------------------ alerts (LouNgak Watch)

    def alerts(self) -> tuple[list[Alert], WatchOverview]:
        notes, mode, computed = [], "live", now_iso()
        try:
            snapshot = self.agri.snapshot()
            derived = derive(snapshot.areas, snapshot.assessments, self.rules)
            mode, computed = snapshot.mode, snapshot.computed_at
            if snapshot.mode == "snapshot":
                notes.append(f"Derived from a frozen snapshot saved {snapshot.snapshot_saved_at}, not live data.")
        except AgriUnavailable as error:
            derived = []
            notes.append(f"The risk assessment is unavailable, so no alerts could be derived: {error}")
        demo = self.store.all("demo_alert", Alert)
        if demo:
            notes.append(f"{len(demo)} DEMO alert(s) are shown for demonstration and labelled as such.")
        states = {s.id: s for s in self.store.all("alert_state", AlertState)}
        alerts = []
        for alert in derived + demo:
            state = states.get(alert.id)
            if state:
                alert = alert.model_copy(update={"status": "acknowledged", "acknowledged_by": state.acknowledged_by_name,
                                                 "acknowledged_at": state.acknowledged_at})
            alerts.append(alert)
        alerts = sort_alerts(alerts)
        notes.append("Alerts are derived from the monitored zones' weather and satellite evidence. Rules marked "
                     "PLACEHOLDER or UNVALIDATED give qualified watches, not validated warnings. Official IMD/CWC/NDMA "
                     "warnings are not integrated yet: always follow official warnings.")
        overview = WatchOverview(computed_at=computed, assessment_mode=mode, categories=CATEGORY_LABEL,
                                 counts={c: sum(1 for a in alerts if a.category == c and a.status == "active")
                                         for c in CATEGORY_LABEL},
                                 alerts=alerts, notes=notes)
        return alerts, overview

    def alert(self, alert_id: str) -> Alert:
        found = next((a for a in self.alerts()[0] if a.id == alert_id), None)
        if found is None:
            raise _not_found("active alert", alert_id)
        return found

    def acknowledge(self, user: DemoUser, alert_id: str) -> Alert:
        alert = self.alert(alert_id)
        if user.role not in OFFICER_ROLES or not covers(user, alert.district):
            raise _forbidden("Only an officer responsible for this district can acknowledge the alert.")
        self.store.put("alert_state", alert_id, AlertState(id=alert_id, acknowledged_by=user.id,
                                                             acknowledged_by_name=user.name, acknowledged_at=now_iso()))
        return self.alert(alert_id)

    # ------------------------------------------------------------------ farmer reports

    def create_report(self, user: DemoUser, body: ReportCreate) -> FarmerReport:
        if user.role != "farmer":
            raise _forbidden("Only a farmer account submits farmer reports.")
        if not body.consent:
            raise HTTPException(status_code=422, detail="The report needs consent to use its location and description.")
        zone = grid.zone_for(body.latitude, body.longitude, self.agri.areas())
        report = FarmerReport(
            id=self.store.next_id("report", "RPT"), category=body.category, crop=body.crop,
            growth_stage=body.growth_stage, description=body.description.strip(), latitude=body.latitude,
            longitude=body.longitude, location_source=body.location_source, district=body.district,
            h3_cell=grid.cell_for(body.latitude, body.longitude), zone_id=zone.id if zone else None,
            reporter_id=user.id, reporter_name=user.name, submitted_at=now_iso(),
            history=[_change(user, "SUBMITTED", "Report received. It is unverified until an officer reviews it.")])
        self.store.put("report", report.id, report)
        return report

    def _report(self, report_id: str) -> FarmerReport:
        report = self.store.get("report", report_id, FarmerReport)
        if report is None:
            raise _not_found("report", report_id)
        return report

    def reports_for(self, user: DemoUser) -> list[FarmerReport]:
        reports = self.store.all("report", FarmerReport)
        if user.role == "farmer":
            return [for_reporter(r) for r in reports if r.reporter_id == user.id][::-1]
        if user.role in OFFICER_ROLES:
            return [r for r in reports if covers(user, r.district)][::-1]
        raise _forbidden("A field officer sees reports through assigned inspection tasks.")

    def review(self, user: DemoUser, report_id: str, action: ReviewAction) -> FarmerReport:
        report = self._report(report_id)
        if user.role not in OFFICER_ROLES or not covers(user, report.district):
            raise _forbidden("Only an officer responsible for this district can review the report.")
        update: dict = {}
        if action.note:
            update["officer_notes"] = report.officer_notes + [OfficerNote(at=now_iso(), by=user.id, by_name=user.name,
                                                                          text=action.note)]
        if action.action == "under_review" and report.status == "SUBMITTED":
            update["status"] = "UNDER_REVIEW"
            update["history"] = report.history + [_change(user, "UNDER_REVIEW", "An officer is reviewing the report.")]
        elif action.action == "dismiss":
            if report.status not in ("SUBMITTED", "UNDER_REVIEW"):
                raise HTTPException(status_code=409, detail=f"A report that is {report.status} cannot be dismissed.")
            if not action.public_note:
                raise HTTPException(status_code=422, detail="Dismissing a report needs a reason the farmer can read.")
            update["status"] = "DISMISSED"
            update["history"] = report.history + [_change(user, "DISMISSED", action.public_note)]
        report = report.model_copy(update=update)
        self.store.put("report", report.id, report)
        return report

    # ------------------------------------------------------------------ review queue

    def queue(self, user: DemoUser) -> list[QueueItem]:
        if user.role not in OFFICER_ROLES:
            raise _forbidden("The review queue is for district and state-level officers.")
        alerts = [a for a in self.alerts()[0] if a.status == "active" and covers(user, a.district)]
        tasks = self.store.all("task", InspectionTask)
        tasked_alerts = {i for t in tasks if t.status != "CANCELLED" for i in t.alert_ids}
        items = []
        for r in self.store.all("report", FarmerReport):
            if r.status not in ("SUBMITTED", "UNDER_REVIEW") or not covers(user, r.district):
                continue
            related = [a for a in alerts if a.zone_id and a.zone_id == r.zone_id
                       and a.category == CATEGORY_TO_ALERT.get(r.category)]
            reasons = ["Farmer report: unverified until inspected."]
            priority = "moderate"
            if related:
                priority = "high"
                reasons.append(f"Raised to high: an active {related[0].category.replace('_', ' ')} alert covers the "
                               f"same zone ({related[0].title}).")
            hours = (datetime.now(timezone.utc) - datetime.fromisoformat(r.submitted_at)).total_seconds() / 3600
            reasons.append(f"Waiting {hours:.0f} h since submission." if hours >= 1 else "Submitted within the last hour.")
            items.append(QueueItem(kind="report", id=r.id, title=f"{r.category.replace('_', ' ').capitalize()} "
                                   f"reported on {r.crop}", district=r.district, zone_id=r.zone_id, priority=priority,
                                   evidence_status=r.evidence_status, reasons=reasons, created_at=r.submitted_at,
                                   latitude=r.latitude, longitude=r.longitude, is_demo=r.is_demo))
        for a in alerts:
            if a.id in tasked_alerts:
                continue
            reasons = [f"{CATEGORY_LABEL[a.category]} alert, {a.evidence_status.replace('_', ' ')}; rule "
                       f"{a.rule_status}.", f"Valid until {a.valid_until[:10]}."]
            if a.gate == "qualified_watch":
                reasons.append("Qualified watch: published with stated limitations.")
            items.append(QueueItem(kind="alert", id=a.id, title=a.title, district=a.district, zone_id=a.zone_id,
                                   priority=a.priority, evidence_status=a.evidence_status, reasons=reasons,
                                   created_at=a.issued_at, latitude=a.label_point[1], longitude=a.label_point[0],
                                   is_demo=a.is_demo))
        # Most urgent first; within a priority, farmer reports before alerts, then the longest waiting.
        return sorted(items, key=lambda i: (PRIORITY_ORDER[i.priority], i.kind != "report", i.created_at))

    # ------------------------------------------------------------------ inspection tasks

    def _task(self, task_id: str) -> InspectionTask:
        task = self.store.get("task", task_id, InspectionTask)
        if task is None:
            raise _not_found("inspection task", task_id)
        return task

    def _check_assignee(self, user: DemoUser, assignee_id: str, district: str) -> DemoUser:
        assignee = USERS.get(assignee_id)
        if assignee is None or assignee.role != "field_officer":
            raise HTTPException(status_code=422, detail=f"'{assignee_id}' is not a field officer account.")
        if not covers(assignee, district):
            raise HTTPException(status_code=422, detail=f"{assignee.name} does not cover {district}.")
        return assignee

    def create_task(self, user: DemoUser, body: TaskCreate) -> InspectionTask:
        if user.role not in OFFICER_ROLES:
            raise _forbidden("Only district and state-level officers create inspection tasks.")
        if not body.report_ids and not body.alert_ids:
            raise HTTPException(status_code=422, detail="An inspection task needs at least one report or alert.")
        reports = [self._report(i) for i in body.report_ids]
        alerts = [self.alert(i) for i in body.alert_ids]
        if reports:
            anchor = reports[0]
            latitude, longitude, district, zone_id, crop = (anchor.latitude, anchor.longitude, anchor.district,
                                                            anchor.zone_id, anchor.crop)
        else:
            anchor = alerts[0]
            if anchor.district is None:
                raise HTTPException(status_code=422, detail="The alert has no district to route the task to.")
            longitude, latitude = anchor.label_point
            district, zone_id, crop = anchor.district, anchor.zone_id, "unknown"
        if not covers(user, district):
            raise _forbidden(f"{district} is outside your jurisdiction.")
        task = InspectionTask(
            id=self.store.next_id("task", "INS"), report_ids=body.report_ids, alert_ids=body.alert_ids,
            latitude=latitude, longitude=longitude, h3_cell=grid.cell_for(latitude, longitude), district=district,
            zone_id=zone_id, crop=crop, reason=body.reason.strip(), priority=body.priority,
            priority_rationale=body.priority_rationale, created_by=user.id, created_at=now_iso(),
            history=[_change(user, "NEW", "Inspection approved.")],
            is_demo=any(r.is_demo for r in reports) or any(a.is_demo for a in alerts))
        self.store.put("task", task.id, task)
        for report in reports:
            report = report.model_copy(update={
                "status": "UNDER_REVIEW", "task_id": task.id,
                "history": report.history + [_change(user, "UNDER_REVIEW", "An inspection has been approved.")]})
            self.store.put("report", report.id, report)
        if body.assigned_to:
            task = self.assign(user, task.id, TaskAssign(assigned_to=body.assigned_to, due_on=body.due_on))
        return task

    def assign(self, user: DemoUser, task_id: str, body: TaskAssign) -> InspectionTask:
        task = self._task(task_id)
        if user.role not in OFFICER_ROLES or not covers(user, task.district):
            raise _forbidden("Only an officer responsible for this district can assign the task.")
        if task.status not in ("NEW", "ASSIGNED"):
            raise HTTPException(status_code=409, detail=f"A task that is {task.status} cannot be reassigned.")
        assignee = self._check_assignee(user, body.assigned_to, task.district)
        task = task.model_copy(update={
            "assigned_to": assignee.id, "assigned_to_name": assignee.name, "due_on": body.due_on, "status": "ASSIGNED",
            "history": task.history + [_change(user, "ASSIGNED", f"Assigned to {assignee.name}"
                                             + (f", due {body.due_on}." if body.due_on else "."))]})
        self.store.put("task", task.id, task)
        for report_id in task.report_ids:
            report = self._report(report_id)
            report = report.model_copy(update={
                "status": "INSPECTION_ASSIGNED",
                "history": report.history + [_change(user, "INSPECTION_ASSIGNED", "A field inspection is scheduled.")]})
            self.store.put("report", report.id, report)
        return task

    def tasks_for(self, user: DemoUser) -> list[InspectionTask]:
        tasks = self.store.all("task", InspectionTask)
        if user.role == "field_officer":
            return [t for t in tasks if t.assigned_to == user.id][::-1]
        if user.role in OFFICER_ROLES:
            return [t for t in tasks if covers(user, t.district)][::-1]
        raise _forbidden("Farmers follow inspections through their own reports.")

    def start(self, user: DemoUser, task_id: str) -> InspectionTask:
        task = self._task(task_id)
        if task.assigned_to != user.id:
            raise _forbidden("Only the assigned field officer can start this inspection.")
        if task.status != "ASSIGNED":
            raise HTTPException(status_code=409, detail=f"A task that is {task.status} cannot be started.")
        task = task.model_copy(update={"status": "IN_PROGRESS",
                                       "history": task.history + [_change(user, "IN_PROGRESS", "Field visit started.")]})
        self.store.put("task", task.id, task)
        return task

    def record_outcome(self, user: DemoUser, task_id: str, body: OutcomeCreate) -> InspectionTask:
        task = self._task(task_id)
        if task.assigned_to != user.id:
            raise _forbidden("Only the assigned field officer records the outcome.")
        if task.status not in ("ASSIGNED", "IN_PROGRESS"):
            raise HTTPException(status_code=409, detail=f"A task that is {task.status} cannot take an outcome.")
        outcome = InspectionOutcome(**body.model_dump(), recorded_by=user.id, recorded_by_name=user.name,
                                    recorded_at=now_iso())
        label = body.result.replace("_", " ").lower()
        task = task.model_copy(update={"status": "COMPLETED", "outcome": outcome,
                                       "history": task.history + [_change(user, "COMPLETED", f"Outcome: {label}.")]})
        self.store.put("task", task.id, task)
        follow_up = body.result == "FOLLOW_UP_REQUIRED"
        for report_id in task.report_ids:
            report = self._report(report_id)
            status = "FOLLOW_UP" if follow_up else "INSPECTED"
            report = report.model_copy(update={
                "status": status, "public_outcome": body.public_summary,
                "history": report.history + [_change(user, status, f"Inspected by a field officer: {label}. "
                                                    "This is an officer's field observation, not a laboratory "
                                                    "diagnosis.")]})
            self.store.put("report", report.id, report)
        return task

    # ------------------------------------------------------------------ combined situation

    def situation(self, user: DemoUser | None) -> list[ZoneSituation]:
        alerts = [a for a in self.alerts()[0] if a.status == "active"]
        private = user is not None and user.role in OFFICER_ROLES
        reports = self.store.all("report", FarmerReport) if private else []
        tasks = self.store.all("task", InspectionTask) if private else []
        out = []
        for area in self.agri.areas():
            if private and not covers(user, area.district):
                continue
            zone_tasks = [t for t in tasks if t.zone_id == area.id]
            outcomes: dict[str, int] = {}
            for t in zone_tasks:
                if t.outcome:
                    outcomes[t.outcome.result] = outcomes.get(t.outcome.result, 0) + 1
            out.append(ZoneSituation(
                zone_id=area.id, zone_name=area.name, district=area.district,
                alerts_by_category={c: sum(1 for a in alerts if a.zone_id == area.id and a.category == c)
                                    for c in CATEGORY_LABEL},
                reports_open=sum(1 for r in reports if r.zone_id == area.id and r.status in OPEN_REPORT),
                tasks_open=sum(1 for t in zone_tasks if t.status in OPEN_TASK),
                tasks_completed=sum(1 for t in zone_tasks if t.status == "COMPLETED"), outcomes=outcomes))
        return out
