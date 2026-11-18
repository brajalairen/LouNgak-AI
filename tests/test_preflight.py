"""The pre-demo check fails on what would break a live demo and warns on what would weaken it."""

import json
from datetime import datetime, timedelta, timezone

from satquery.ops import preflight, seed
from satquery.settings import Settings
from satquery.store import Store

NOW = datetime(2026, 11, 20, 9, 0, tzinfo=timezone.utc)


def test_falcon_without_torch_fails_and_the_command_exits_non_zero():
    check = preflight.check_vlm(Settings(vlm_backend="falcon"), has_module=lambda name: name != "torch")
    assert check.status == "FAIL" and "SATQUERY_VLM_BACKEND=fake" in check.detail
    text, code = preflight.report([check, preflight.Check("PASS", "Other", "ok")])
    assert code == 1 and "FAIL" in text
    assert preflight.check_vlm(Settings(vlm_backend="fake")).status == "PASS"


def test_a_blocked_package_dll_fails_with_the_windows_hint():
    def importer(name):
        if name == "h3":
            raise ImportError("DLL load failed while importing vertex: An Application Control policy has blocked "
                              "this file.")

    check = preflight.check_packages(importer)
    assert check.status == "FAIL" and "'h3'" in check.detail and "Smart App Control" in check.detail
    assert preflight.check_packages(lambda name: None).status == "PASS"


def test_a_missing_web_build_fails(tmp_path):
    assert preflight.check_web(tmp_path).status == "FAIL"
    (tmp_path / "web" / "dist").mkdir(parents=True)
    (tmp_path / "web" / "dist" / "index.html").write_text("<!doctype html>", encoding="utf-8")
    assert preflight.check_web(tmp_path).status == "PASS"


def test_the_snapshot_must_be_recent(tmp_path):
    settings = Settings(runs_dir=tmp_path)
    assert preflight.check_snapshot(settings, NOW).status == "WARN"
    assert preflight.check_snapshot(Settings(runs_dir=tmp_path, agri_mode="snapshot"), NOW).status == "FAIL"
    path = tmp_path / "agri" / "snapshot.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"saved_at": (NOW - timedelta(hours=30)).isoformat()}), encoding="utf-8")
    assert preflight.check_snapshot(settings, NOW).status == "WARN"
    path.write_text(json.dumps({"saved_at": (NOW - timedelta(hours=2)).isoformat()}), encoding="utf-8")
    assert preflight.check_snapshot(settings, NOW).status == "PASS"


def test_credentials_are_checked_without_printing_them():
    secret = "s3cr3t-value"
    check = preflight.check_copernicus(Settings(copernicus_client_id="client-abc", copernicus_client_secret=secret))
    assert check.status == "PASS" and secret not in check.detail and "client-abc" not in check.detail
    placeholder = preflight.check_copernicus(Settings(copernicus_client_id="your_client_id_here",
                                                      copernicus_client_secret="your_client_secret_here"))
    assert placeholder.status == "WARN" and "placeholder" in placeholder.detail


def test_the_database_and_the_demo_seed_state(tmp_path):
    settings = Settings(db_path=str(tmp_path / "ops.sqlite3"))
    assert preflight.check_database(settings).status == "PASS"
    assert preflight.check_seed(settings).status == "WARN", "nothing seeded yet"
    seed.seed(Store(settings.db_path))
    assert preflight.check_seed(settings).status == "PASS"
    assert preflight.check_seed(settings, datetime.now(timezone.utc) + timedelta(days=5)).status == "WARN"
