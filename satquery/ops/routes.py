"""HTTP endpoints for LouNgak Watch and field operations. The rules live in `OpsService`.

  GET  /api/ops/users                    the demo accounts (public: the role switcher lists them)
  GET  /api/ops/situation                combined view per monitored zone (private counts for officers only)
  POST /api/ops/reports                  farmer: submit a suspected issue (stored as unverified)
  GET  /api/ops/reports                  farmer: own reports; officer: reports in jurisdiction
  POST /api/ops/reports/{id}/review      officer: mark under review, add an internal note, or dismiss
  GET  /api/ops/queue                    officer: reports and alerts awaiting a decision, with reasons
  POST /api/ops/tasks                    officer: create an inspection task from reports and/or alerts
  GET  /api/ops/tasks                    field officer: own tasks; officer: tasks in jurisdiction
  POST /api/ops/tasks/{id}/assign        officer: assign to a field officer covering the district
  POST /api/ops/tasks/{id}/start         assigned field officer
  POST /api/ops/tasks/{id}/outcome       assigned field officer: record the verification outcome
  GET  /api/watch/alerts                 public: active alerts by category, with evidence and limitations
  POST /api/watch/alerts/{id}/ack        officer: acknowledge an alert
"""

from fastapi import APIRouter, Depends

from satquery.ops.models import (DEMO_ACCOUNTS_NOTE, DemoUser, FarmerReport, InspectionTask, OpsPeople,
                                 OutcomeCreate, QueueItem, ReportCreate, ReviewAction, TaskAssign, TaskCreate,
                                 ZoneSituation)
from satquery.ops.service import OpsService
from satquery.ops.users import DEMO_USERS, OFFICER_ROLES, optional_user, require
from satquery.watch.alerts import Alert, WatchOverview


def ops_router(ops: OpsService) -> APIRouter:
    router = APIRouter(tags=["field operations"])

    @router.get("/api/ops/users", response_model=OpsPeople)
    def users():
        return OpsPeople(users=DEMO_USERS, note=DEMO_ACCOUNTS_NOTE)

    @router.get("/api/ops/situation", response_model=list[ZoneSituation])
    def situation(user: DemoUser | None = Depends(optional_user)):
        return ops.situation(user)

    @router.post("/api/ops/reports", response_model=FarmerReport)
    def create_report(body: ReportCreate, user: DemoUser | None = Depends(optional_user)):
        return ops.create_report(require(user, "farmer"), body)

    @router.get("/api/ops/reports", response_model=list[FarmerReport])
    def reports(user: DemoUser | None = Depends(optional_user)):
        return ops.reports_for(require(user))

    @router.post("/api/ops/reports/{report_id}/review", response_model=FarmerReport)
    def review(report_id: str, body: ReviewAction, user: DemoUser | None = Depends(optional_user)):
        return ops.review(require(user, *OFFICER_ROLES), report_id, body)

    @router.get("/api/ops/queue", response_model=list[QueueItem])
    def queue(user: DemoUser | None = Depends(optional_user)):
        return ops.queue(require(user, *OFFICER_ROLES))

    @router.post("/api/ops/tasks", response_model=InspectionTask)
    def create_task(body: TaskCreate, user: DemoUser | None = Depends(optional_user)):
        return ops.create_task(require(user, *OFFICER_ROLES), body)

    @router.get("/api/ops/tasks", response_model=list[InspectionTask])
    def tasks(user: DemoUser | None = Depends(optional_user)):
        return ops.tasks_for(require(user))

    @router.post("/api/ops/tasks/{task_id}/assign", response_model=InspectionTask)
    def assign(task_id: str, body: TaskAssign, user: DemoUser | None = Depends(optional_user)):
        return ops.assign(require(user, *OFFICER_ROLES), task_id, body)

    @router.post("/api/ops/tasks/{task_id}/start", response_model=InspectionTask)
    def start(task_id: str, user: DemoUser | None = Depends(optional_user)):
        return ops.start(require(user, "field_officer"), task_id)

    @router.post("/api/ops/tasks/{task_id}/outcome", response_model=InspectionTask)
    def outcome(task_id: str, body: OutcomeCreate, user: DemoUser | None = Depends(optional_user)):
        return ops.record_outcome(require(user, "field_officer"), task_id, body)

    @router.get("/api/watch/alerts", response_model=WatchOverview)
    def alerts():
        return ops.alerts()[1]

    @router.post("/api/watch/alerts/{alert_id}/ack", response_model=Alert)
    def acknowledge(alert_id: str, user: DemoUser | None = Depends(optional_user)):
        return ops.acknowledge(require(user, *OFFICER_ROLES), alert_id)

    return router
