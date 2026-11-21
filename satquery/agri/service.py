"""The dashboard's view of the risk engine: one assessment of every monitored area, reused for a while.

The API never scores anything itself. It asks this service, which runs the unchanged pipeline
(`pipeline.assess_areas`) at most once at a time and keeps the result for `agri_refresh_s`; after that
the previous result keeps being served while one background thread recomputes it (stale-while-
revalidate), so no request ever waits on a refresh. The inputs underneath are cached on disk by their
own clients (weather 3 h, NDVI by window), so a recompute is cheap once warm, and offline mode serves
those caches only, labelled CACHED.

Demo reliability:
- `warm_in_background()` computes the first assessment when the server starts, so the first page
  does not wait for it.
- `save_snapshot()` freezes a known-good assessment to a file. The whole file is served instead of live
  data when `agri_mode` is "snapshot" or when the live assessment fails outright. Otherwise the fallback
  is per input (`fill_from_snapshot`): a weather or NDVI input that is unavailable live (for example the
  venue network blocks Copernicus) is taken from the snapshot and the area is re-scored, while every
  input that is available stays live. The app's own field reports therefore always count, so a farmer's
  report still moves the score when the network is down. Snapshot data is always labelled SNAPSHOT with
  its time and the reason it is shown; it is never presented as live.
"""

import json
import logging
import threading
import time
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path

from satquery.agri import risk
from satquery.agri.areas import demo_areas, load_areas
from satquery.agri.config import PestRulesConfig, RiskModelConfig, load_pest_rules, load_risk_model
from satquery.agri.models import MonitoredArea, RiskAssessment
from satquery.agri.pipeline import Sources, assess_areas, default_sources
from satquery.settings import Settings, load_settings

log = logging.getLogger(__name__)
SNAPSHOT_VERSION = 1
REFRESH_RETRY_S = 60.0  # after a failed background refresh, wait this long before trying again
# Inputs that can come from the frozen snapshot when they are unavailable live. Field reports are never among
# them: they come from the app's own database, which is always reachable, and must always be current.
FILLABLE = ("weather_pest", "ndvi_anomaly")


@dataclass(frozen=True)
class Snapshot:
    areas: dict[str, MonitoredArea]
    assessments: list[RiskAssessment]  # ranked, most urgent first
    rules: PestRulesConfig
    model: RiskModelConfig
    computed_at: str  # ISO UTC
    offline: bool
    mode: str = "live"  # "live", or "snapshot" when the whole frozen snapshot is served
    snapshot_saved_at: str | None = None  # set when the snapshot is served whole or fills some live inputs
    fallback_reason: str | None = None  # why: set in both cases (mode "live" with a reason = some inputs filled)
    notes: list[str] = field(default_factory=list)

    def assessment(self, area_id: str) -> RiskAssessment | None:
        return next((a for a in self.assessments if a.area_id == area_id), None)


class AgriUnavailable(Exception):
    """The assessment could not be produced at all (for example an invalid areas file)."""


def write_snapshot(snapshot: Snapshot, path: Path) -> Path:
    """Freeze an assessment to `path` (atomic replace). Returns the path."""
    record = {"version": SNAPSHOT_VERSION, "saved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "computed_at": snapshot.computed_at, "offline": snapshot.offline,
              "areas": [a.model_dump() for a in snapshot.areas.values()],
              "assessments": [a.model_dump() for a in snapshot.assessments]}
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(".partial")
    partial.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
    partial.replace(path)
    return path


def read_snapshot(path: Path, rules: PestRulesConfig, model: RiskModelConfig, reason: str | None) -> Snapshot:
    """A frozen snapshot, relabelled: every LIVE or CACHED source becomes SNAPSHOT (its original state
    and time are kept in the note), so nothing from the file can be shown as live. SAMPLE stays SAMPLE."""
    record = json.loads(path.read_text(encoding="utf-8"))
    if record.get("version") != SNAPSHOT_VERSION:
        raise ValueError(f"unsupported snapshot version {record.get('version')}")
    saved_at = record["saved_at"]
    areas = {a["id"]: MonitoredArea.model_validate(a) for a in record["areas"]}

    def relabel(provenance: list) -> list:
        out = []
        for p in provenance:
            if p.state in ("LIVE", "CACHED"):
                note = f"Frozen snapshot of {saved_at} (originally {p.state})." + (f" {p.note}" if p.note else "")
                p = p.model_copy(update={"state": "SNAPSHOT", "note": note})
            out.append(p)
        return out

    assessments = []
    for raw in record["assessments"]:
        a = RiskAssessment.model_validate(raw)
        factors = [f.model_copy(update={"provenance": relabel(f.provenance)}) for f in a.factors]
        assessments.append(a.model_copy(update={"factors": factors, "provenance": relabel(a.provenance)}))
    return Snapshot(areas=areas, assessments=assessments, rules=rules, model=model,
                    computed_at=record["computed_at"], offline=bool(record.get("offline")), mode="snapshot",
                    snapshot_saved_at=saved_at, fallback_reason=reason)


def fill_from_snapshot(live: Snapshot, frozen: Snapshot) -> Snapshot:
    """The live assessment, with each weather or NDVI input that is unavailable live taken from the frozen
    snapshot (already labelled SNAPSHOT) and the area re-scored.

    An input that is available live is never replaced, and the report factor is never taken from the
    snapshot, so new farmer reports and inspection outcomes keep moving the score while a provider is down.
    Returns `live` unchanged when nothing was filled. Pest evaluations follow the weather they came from.
    """
    old = {a.area_id: a for a in frozen.assessments}
    assessments, filled = [], {}
    for a in live.assessments:
        before = old.get(a.area_id)
        area = live.areas.get(a.area_id)
        if before is None or area is None:
            assessments.append(a)
            continue
        old_factors = {f.id: f for f in before.factors}
        factors, pests, used = [], a.pests, []
        for factor in a.factors:
            stored = old_factors.get(factor.id)
            if factor.id in FILLABLE and factor.score is None and stored is not None and stored.score is not None:
                note = (f"Taken from the frozen snapshot saved {frozen.snapshot_saved_at}, because it is not available "
                        f"live ({factor.unavailable_reason or 'unavailable'}).")
                factors.append(stored.model_copy(update={"reasons": [note, *stored.reasons]}))
                used.append(factor.id)
                if factor.id == "weather_pest":
                    pests = before.pests
            else:
                factors.append(factor)
        if not used:
            assessments.append(a)
            continue
        assessments.append(risk.combine(area, factors, pests, live.rules, live.model, as_of=a.as_of,
                                        district_context=a.district_context))
        for factor_id in used:
            filled[factor_id] = filled.get(factor_id, 0) + 1
    if not filled:
        return live
    what = "; ".join(f"{risk.FACTOR_NAMES[k].lower()} for {n} area(s)" for k, n in filled.items())
    reason = (f"Some inputs could not be fetched live, so they come from the frozen snapshot saved "
              f"{frozen.snapshot_saved_at} and are labelled SNAPSHOT: {what}. Everything else, including field "
              "reports, is live.")
    return replace(live, assessments=risk.rank(assessments), snapshot_saved_at=frozen.snapshot_saved_at,
                   fallback_reason=reason)


class AssessmentService:
    def __init__(self, settings: Settings | None = None, *, sources: Sources | None = None,
                 areas: list[MonitoredArea] | None = None, clock=time.monotonic, store=None):
        self._settings = settings
        self._sources = sources
        self._store = store  # the field-operations store the report factor reads (default: SATQUERY_DB_PATH)
        self._areas = areas
        self._clock = clock
        self._lock = threading.Lock()          # guards the fields below; never held during a computation
        self._compute_lock = threading.Lock()  # one computation at a time
        self._snapshot: Snapshot | None = None
        self._computed = 0.0
        self._stale = False                    # set by invalidate(): recompute soon, keep serving meanwhile
        self._refreshing = False
        self.refresh_thread: threading.Thread | None = None  # the latest background refresh (tests join it)

    def _settings_now(self) -> Settings:
        return self._settings or load_settings()

    def snapshot_path(self) -> Path:
        settings = self._settings_now()
        return Path(settings.agri_snapshot) if settings.agri_snapshot else settings.runs_dir / "agri" / "snapshot.json"

    def areas(self) -> list[MonitoredArea]:
        """The monitored areas, without assessing them (for routing a question by its wording)."""
        if self._snapshot:
            return list(self._snapshot.areas.values())
        if self._areas:
            return self._areas
        settings = self._settings_now()
        try:
            return demo_areas() if settings.agri_areas == "demo" else load_areas(settings.agri_areas)
        except (OSError, ValueError):
            return []

    def _load_config(self, settings: Settings):
        try:
            areas = self._areas or (demo_areas() if settings.agri_areas == "demo" else load_areas(settings.agri_areas))
            return areas, load_pest_rules(), load_risk_model()
        except (OSError, ValueError) as error:
            raise AgriUnavailable(f"The monitored areas or thresholds could not be loaded: {error}") from error

    def _frozen(self, rules, model, reason: str) -> Snapshot | None:
        path = self.snapshot_path()
        if not path.is_file():
            return None
        try:
            return read_snapshot(path, rules, model, reason)
        except (OSError, ValueError, KeyError) as error:
            log.warning("agri snapshot %s unusable: %s", path, error)
            return None

    def _compute(self, settings: Settings) -> Snapshot:
        areas, rules, model = self._load_config(settings)
        if settings.agri_mode == "snapshot":
            frozen = self._frozen(rules, model, "Snapshot mode is switched on (SATQUERY_AGRI_MODE=snapshot).")
            if frozen is None:
                raise AgriUnavailable(f"Snapshot mode is on, but no usable snapshot exists at {self.snapshot_path()}.")
            return frozen
        sources = self._sources or default_sources(settings, offline=settings.agri_offline, store=self._store)
        try:
            assessments = assess_areas(areas, sources, rules=rules, model=model)
        except Exception as error:  # never leave the dashboard empty when a frozen snapshot exists
            frozen = self._frozen(rules, model, f"The live assessment failed ({type(error).__name__}).")
            if frozen is None:
                raise
            return frozen
        live = Snapshot(areas={a.id: a for a in areas}, assessments=assessments, rules=rules, model=model,
                        offline=settings.agri_offline,
                        computed_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
        # Prefer live data; take from the snapshot only the inputs that are unavailable live.
        frozen = self._frozen(rules, model, "")
        if frozen is None:
            return live
        return fill_from_snapshot(live, frozen)

    def snapshot(self) -> Snapshot:
        """The current assessment.

        Only the very first request waits for a computation. After that the assessment is served at once:
        when it is older than the refresh period (or was invalidated), the old one is returned and a single
        background thread recomputes it, so a scheduled refresh never freezes the map, alerts or queue in
        the middle of a demo. The served assessment always carries its own `computed_at`.
        """
        settings = self._settings_now()
        with self._lock:
            if self._snapshot is not None:
                if self._stale or self._clock() - self._computed >= settings.agri_refresh_s:
                    self._start_refresh_locked(settings)
                return self._snapshot
        with self._compute_lock:  # concurrent first requests wait for one computation instead of starting several
            with self._lock:
                if self._snapshot is not None:
                    return self._snapshot
            snapshot = self._compute(settings)
            with self._lock:
                self._snapshot, self._computed, self._stale = snapshot, self._clock(), False
            return snapshot

    def invalidate(self) -> None:
        """Mark the assessment out of date (a new field report or inspection outcome) without discarding it,
        and start recomputing it in the background straight away: the inputs are cached, so the new score
        is usually ready by the time someone opens the map. Requests meanwhile get the current assessment."""
        settings = self._settings_now()
        with self._lock:
            self._stale = True
            if self._snapshot is not None:
                self._start_refresh_locked(settings)

    def _start_refresh_locked(self, settings: Settings) -> None:
        if self._refreshing:
            return  # the running refresh sees `_stale` and runs once more
        self._refreshing = True
        self.refresh_thread = threading.Thread(target=self._refresh, args=(settings,), name="agri-refresh",
                                               daemon=True)
        self.refresh_thread.start()

    def _refresh(self, settings: Settings) -> None:
        while True:
            with self._lock:
                self._stale = False  # an invalidation that arrives during this run marks it stale again
            try:
                with self._compute_lock:
                    snapshot = self._compute(settings)
            except Exception as error:  # keep serving the previous assessment; retry after a short pause
                log.warning("agri background refresh failed, keeping the previous assessment: %s", error)
                with self._lock:
                    self._computed = self._clock() - max(0.0, settings.agri_refresh_s - REFRESH_RETRY_S)
                    self._refreshing = False
                return
            with self._lock:
                self._snapshot, self._computed = snapshot, self._clock()
                if not self._stale:
                    self._refreshing = False
                    log.info("agri assessment refreshed in the background")
                    return

    def save_snapshot(self, path: Path | None = None) -> Path:
        """Freeze the current assessment (live) to the snapshot file. Refuses to re-freeze a snapshot, or a live
        assessment with inputs filled in from one: old data must not roll forward under a new date."""
        current = self._snapshot or self.snapshot()  # freeze what was just computed, not a fresh run
        if current.mode == "snapshot":
            raise AgriUnavailable("The current assessment is itself a snapshot; refusing to re-freeze it.")
        if current.fallback_reason:
            raise AgriUnavailable(f"Some inputs are not live, so the snapshot was not replaced: {current.fallback_reason}")
        return write_snapshot(current, path or self.snapshot_path())

    def warm_in_background(self) -> threading.Thread:
        """Compute the first assessment off the request path (server start). Errors are logged, not raised."""
        def run():
            try:
                self.snapshot()
                log.info("agri assessment warmed")
            except Exception as error:
                log.warning("agri warm-up failed: %s", error)

        thread = threading.Thread(target=run, name="agri-warm-up", daemon=True)
        thread.start()
        return thread
