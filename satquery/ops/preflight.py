"""Pre-demo check: `python -m satquery.ops preflight`.

Run it on the demo machine before presenting. Each check prints PASS, WARN or FAIL with the fix. A FAIL
is something that breaks the live demo (the app cannot start, the page is blank, the first image question
crashes, records cannot be saved); the command then exits non-zero. A WARN still lets the demo run but
shows less (no NDVI, an old snapshot, no DEMO records). Credential values are never printed.
"""

import importlib
import importlib.util
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from satquery.settings import REPO_ROOT, Settings

SNAPSHOT_MAX_AGE_H = 24
COMPILED = ("numpy", "scipy", "h3", "rasterio", "PIL", "pydantic_core")


@dataclass(frozen=True)
class Check:
    status: str  # "PASS", "WARN" or "FAIL"
    name: str
    detail: str


def _has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def check_packages(importer: Callable[[str], object] = importlib.import_module) -> Check:
    """The compiled dependencies and the app itself import. On Windows, Smart App Control or another
    Application Control policy can block a package's DLL, which stops the server from starting at all."""
    for name in (*COMPILED, "satquery.server"):
        try:
            importer(name)
        except Exception as error:  # noqa: BLE001 - any import failure stops the server
            hint = ""
            if "Application Control" in str(error):
                hint = (" Windows Application Control (Smart App Control) blocked a file; see the README's "
                        "Windows notes before the demo.")
            return Check("FAIL", "Python packages", f"'{name}' does not import: {error}.{hint}")
    return Check("PASS", "Python packages", f"{', '.join(COMPILED)} and the app import.")


def check_web(root: Path = REPO_ROOT) -> Check:
    if (root / "web" / "dist" / "index.html").is_file():
        return Check("PASS", "Web client", "web/dist is built; the server serves the app on one port.")
    return Check("FAIL", "Web client", "web/dist/index.html is missing, so only the API is served. "
                                       "Run `npm ci` and `npm run build` in web/.")


def check_vlm(settings: Settings, has_module: Callable[[str], bool] = _has_module) -> Check:
    backend = settings.vlm_backend.strip().lower()
    if backend == "fake":
        return Check("PASS", "Image-question model", "fake: open-ended image questions get placeholder answers; "
                                                     "everything else is unaffected.")
    if backend != "falcon":
        return Check("FAIL", "Image-question model", f"SATQUERY_VLM_BACKEND='{backend}' is not 'fake' or 'falcon'.")
    missing = [m for m in ("torch", "transformers") if not has_module(m)]
    if missing:
        return Check("FAIL", "Image-question model",
                     f"SATQUERY_VLM_BACKEND=falcon, but {' and '.join(missing)} is not installed, so the first image "
                     "question fails. Set SATQUERY_VLM_BACKEND=fake in .env, or install the `models` extra.")
    try:
        from huggingface_hub import try_to_load_from_cache
        cached = isinstance(try_to_load_from_cache(settings.falcon_model_id, "config.json"), str)
    except Exception:  # noqa: BLE001 - only a hint
        cached = False
    if not cached:
        return Check("WARN", "Image-question model", "falcon is installed, but the model is not in the Hugging Face "
                                                     "cache: the first image question downloads about 3.4 GB. Ask "
                                                     "one image question before the demo.")
    return Check("PASS", "Image-question model", "falcon is installed and the model is cached.")


def check_copernicus(settings: Settings) -> Check:
    placeholder = settings.copernicus_client_id.startswith("your_") or settings.copernicus_client_secret.startswith("your_")
    if settings.copernicus_configured and not placeholder:
        return Check("PASS", "Copernicus credentials", "configured (values not shown).")
    reason = "still the .env.example placeholders" if placeholder else "not set"
    return Check("WARN", "Copernicus credentials", f"{reason}: the NDVI factor and live imagery are unavailable and "
                                                   "labelled so. A saved snapshot can stand in for NDVI.")


def snapshot_path(settings: Settings) -> Path:
    return Path(settings.agri_snapshot) if settings.agri_snapshot else settings.runs_dir / "agri" / "snapshot.json"


def check_snapshot(settings: Settings, now: datetime | None = None) -> Check:
    now = now or datetime.now(timezone.utc)
    path = snapshot_path(settings)
    fix = "Run `python -m satquery.agri warm --save-snapshot --crop-health`."
    required = settings.agri_mode == "snapshot"
    if not path.is_file():
        return Check("FAIL" if required else "WARN", "Risk snapshot",
                     f"no saved snapshot at {path}" + (" and SATQUERY_AGRI_MODE=snapshot needs one. " if required
                                                       else ": there is no fallback if the venue network fails. ")
                     + fix)
    try:
        saved = datetime.fromisoformat(json.loads(path.read_text(encoding="utf-8"))["saved_at"])
    except (OSError, ValueError, KeyError) as error:
        return Check("FAIL" if required else "WARN", "Risk snapshot", f"{path} is unreadable ({error}). {fix}")
    hours = (now - saved).total_seconds() / 3600
    if hours > SNAPSHOT_MAX_AGE_H:
        return Check("WARN", "Risk snapshot", f"saved {hours:.0f} h ago (over {SNAPSHOT_MAX_AGE_H} h): its alerts may be "
                                              f"past their validity and hidden. {fix}")
    return Check("PASS", "Risk snapshot", f"saved {hours:.1f} h ago.")


def check_database(settings: Settings) -> Check:
    from satquery.ops.models import OfficerNote
    from satquery.store import Store, now_iso

    if settings.db_path == ":memory:":
        return Check("WARN", "Database", "SATQUERY_DB_PATH=:memory: keeps nothing between server restarts.")
    try:
        store = Store(settings.db_path)
        store.put("_preflight", "probe", OfficerNote(at=now_iso(), by="preflight", by_name="preflight", text="probe"))
        store.delete("_preflight", "probe")
    except Exception as error:  # noqa: BLE001
        return Check("FAIL", "Database", f"cannot write {settings.db_path}: {error}")
    return Check("PASS", "Database", f"{settings.db_path} is writable.")


def check_seed(settings: Settings, now: datetime | None = None) -> Check:
    from satquery.ops.models import FarmerReport
    from satquery.store import Store
    from satquery.watch.alerts import Alert, is_expired

    now = now or datetime.now(timezone.utc)
    try:
        store = Store(settings.db_path)
        reports = store.all("report", FarmerReport)
        alerts = store.all("demo_alert", Alert)
    except Exception as error:  # noqa: BLE001
        return Check("WARN", "DEMO records", f"could not read the database: {error}")
    demo_reports = sum(1 for r in reports if r.is_demo)
    real = len(reports) - demo_reports
    summary = f"{demo_reports} DEMO report(s), {len(alerts)} DEMO alert(s), {real} other report(s)."
    if not alerts and not demo_reports:
        return Check("WARN", "DEMO records", f"{summary} Run `python -m satquery.ops seed-demo` if the walkthrough "
                                             "needs the DEMO heavy-rain alert.")
    if any(is_expired(a, now) for a in alerts):
        return Check("WARN", "DEMO records", f"{summary} The DEMO alert is past its validity and hidden: run "
                                             "`python -m satquery.ops seed-demo` to refresh it.")
    return Check("PASS", "DEMO records", summary)


def run(settings: Settings) -> list[Check]:
    return [check_packages(), check_web(), check_vlm(settings), check_copernicus(settings), check_snapshot(settings),
            check_database(settings), check_seed(settings)]


def report(checks: list[Check]) -> tuple[str, int]:
    width = max(len(c.name) for c in checks)
    lines = ["LouNgak AI pre-demo check"] + [f"  {c.status:<4}  {c.name:<{width}}  {c.detail}" for c in checks]
    failed = sum(c.status == "FAIL" for c in checks)
    warned = sum(c.status == "WARN" for c in checks)
    lines.append(f"Result: {failed} failed, {warned} warning(s). "
                 + ("Fix every FAIL before the demo." if failed else "Ready to demo."))
    return "\n".join(lines), 1 if failed else 0
