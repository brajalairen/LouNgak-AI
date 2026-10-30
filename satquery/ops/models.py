"""Data contracts of field operations. Mirrored by hand in web/src/state/types.ts (tests/test_contract.py)."""

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["farmer", "field_officer", "district_officer", "state_officer"]
Priority = Literal["low", "moderate", "high", "urgent"]
ReportCategory = Literal["pest", "disease", "crop_damage", "waterlogging", "weather_damage", "other"]
Crop = Literal["rice", "chakhao", "maize", "other", "unknown"]
ReportStatus = Literal["SUBMITTED", "UNDER_REVIEW", "INSPECTION_ASSIGNED", "INSPECTED", "FOLLOW_UP", "DISMISSED"]
TaskStatus = Literal["NEW", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
OutcomeResult = Literal["CONCERN_OBSERVED", "CONCERN_NOT_OBSERVED", "INCONCLUSIVE", "DIFFERENT_ISSUE",
                        "FOLLOW_UP_REQUIRED"]

DEMO_LABEL = "DEMO RECORD — demonstration data, not a real report or inspection"
DEMO_ACCOUNTS_NOTE = ("Demo accounts for the prototype: anyone can switch between them. This is not production "
                      "authentication; the server still applies each role's permissions and jurisdiction.")


class DemoUser(BaseModel):
    id: str
    name: str
    role: Role
    title: str                 # a configurable job title, not an official designation
    districts: list[str]       # jurisdiction; empty means every district (state level)
    is_demo: bool = True


class StatusChange(BaseModel):
    status: str
    at: str          # ISO UTC
    by: str          # user id
    by_name: str
    note: str | None = None  # shown to the reporter too: never internal remarks


class OfficerNote(BaseModel):
    at: str
    by: str
    by_name: str
    text: str


class ReportCreate(BaseModel):
    category: ReportCategory
    crop: Crop
    growth_stage: str | None = Field(default=None, max_length=80)
    description: str = Field(min_length=3, max_length=2000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_source: Literal["map_pin", "device_gps"]
    district: str
    consent: bool  # the reporter agreed to the location and description being used for follow-up


class FarmerReport(BaseModel):
    id: str
    category: ReportCategory
    crop: Crop
    growth_stage: str | None
    description: str
    latitude: float
    longitude: float
    location_source: Literal["map_pin", "device_gps"]
    district: str       # as stated by the reporter
    h3_cell: str
    zone_id: str | None  # the monitored zone containing the point, when there is one
    reporter_id: str
    reporter_name: str
    submitted_at: str
    status: ReportStatus = "SUBMITTED"
    evidence_status: Literal["farmer_reported_unverified"] = "farmer_reported_unverified"
    task_id: str | None = None
    public_outcome: str | None = None  # what the reporter is told once an inspection is recorded
    history: list[StatusChange] = Field(default_factory=list)
    officer_notes: list[OfficerNote] = Field(default_factory=list)  # internal: removed for farmers
    is_demo: bool = False


class ReviewAction(BaseModel):
    action: Literal["under_review", "dismiss", "note"]
    note: str | None = Field(default=None, max_length=1000)         # internal
    public_note: str | None = Field(default=None, max_length=500)   # shown to the reporter (dismiss reason)


class OutcomeCreate(BaseModel):
    result: OutcomeResult
    observed_crop: Crop
    growth_stage: str | None = Field(default=None, max_length=80)
    crop_condition: Literal["normal", "stressed", "damaged", "not_visible"]
    symptoms: str | None = Field(default=None, max_length=1000)
    suspected_issue: str | None = Field(default=None, max_length=200)  # a suspicion, not a diagnosis
    water_condition: Literal["none", "waterlogged", "flooded", "dry"] | None = None
    action_taken: str | None = Field(default=None, max_length=500)
    follow_up: str | None = Field(default=None, max_length=500)
    public_summary: str = Field(min_length=3, max_length=500)  # what the reporter is told
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    gps_accuracy_m: float | None = None


class InspectionOutcome(OutcomeCreate):
    recorded_by: str
    recorded_by_name: str
    recorded_at: str
    evidence_status: Literal["field_observed_officer"] = "field_observed_officer"


class TaskCreate(BaseModel):
    report_ids: list[str] = Field(default_factory=list)
    alert_ids: list[str] = Field(default_factory=list)
    reason: str = Field(min_length=3, max_length=500)
    priority: Priority
    priority_rationale: list[str] = Field(default_factory=list)
    assigned_to: str | None = None
    due_on: str | None = None  # ISO date


class TaskAssign(BaseModel):
    assigned_to: str
    due_on: str | None = None


class InspectionTask(BaseModel):
    id: str
    report_ids: list[str]
    alert_ids: list[str]
    latitude: float
    longitude: float
    h3_cell: str
    district: str
    zone_id: str | None
    crop: str
    reason: str
    priority: Priority
    priority_rationale: list[str]
    created_by: str
    created_at: str
    assigned_to: str | None = None
    assigned_to_name: str | None = None
    due_on: str | None = None
    status: TaskStatus = "NEW"
    history: list[StatusChange] = Field(default_factory=list)
    outcome: InspectionOutcome | None = None
    is_demo: bool = False


class QueueItem(BaseModel):
    """One entry in an officer's review queue: a farmer report or a Watch alert awaiting a decision."""

    kind: Literal["report", "alert"]
    id: str
    title: str
    district: str | None
    zone_id: str | None
    priority: Priority
    evidence_status: str
    reasons: list[str]  # why it sits where it does in the queue, in words
    created_at: str
    latitude: float
    longitude: float
    is_demo: bool


class ZoneSituation(BaseModel):
    """A combined view over separate records for one monitored zone; not a risk score of its own."""

    zone_id: str
    zone_name: str
    district: str | None
    alerts_by_category: dict[str, int]
    reports_open: int
    tasks_open: int
    tasks_completed: int
    outcomes: dict[str, int]


class OpsPeople(BaseModel):
    users: list[DemoUser]
    note: str
