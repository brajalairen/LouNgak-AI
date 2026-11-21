"""The assessment refresh never blocks a request: after expiry the previous assessment is served at once
and a single background thread recomputes it (stale-while-revalidate). Only the first request waits."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor

from agri_helpers import FakeWeather
from satquery.agri.pipeline import Sources
from satquery.agri.reports import SampleReportSource
from satquery.agri.service import AssessmentService
from satquery.settings import Settings


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class SlowService(AssessmentService):
    """Counts computations; each one after the first takes `delay` seconds, like a slow venue network."""

    def __init__(self, tmp_path, clock, delay=2.0):
        super().__init__(Settings(runs_dir=tmp_path, agri_warmup=False, agri_refresh_s=1800.0),
                         sources=Sources(weather=FakeWeather({}), ndvi=None, reports=SampleReportSource()),
                         clock=clock)
        self.delay, self.runs, self.fail = delay, 0, False
        self.release = threading.Event()

    def _compute(self, settings):
        self.runs += 1
        if self.runs > 1:
            self.release.wait(self.delay)
            if self.fail:
                raise RuntimeError("provider down")
        return super()._compute(settings)


def test_an_expired_assessment_is_served_at_once_while_one_thread_recomputes(tmp_path):
    clock = Clock()
    service = SlowService(tmp_path, clock)
    first = service.snapshot()
    clock.now += 1801  # past the refresh period

    started = time.perf_counter()
    served = service.snapshot()
    assert time.perf_counter() - started < 0.1, "a refresh must not block the request"
    assert served is first

    with ThreadPoolExecutor(max_workers=10) as pool:
        assert all(s is first for s in pool.map(lambda _: service.snapshot(), range(10)))
    assert service.runs == 2, "ten concurrent requests start only one recompute"

    service.release.set()
    service.refresh_thread.join(timeout=5)
    newer = service.snapshot()
    assert newer is not first and newer.computed_at >= first.computed_at
    assert service.runs == 2, "a fresh assessment is not recomputed again"


def test_invalidate_starts_the_recompute_at_once_and_keeps_serving_meanwhile(tmp_path):
    clock = Clock()
    service = SlowService(tmp_path, clock)
    first = service.snapshot()
    assert service.snapshot() is first and service.runs == 1
    service.invalidate()
    assert service.refresh_thread is not None, "the recompute starts without waiting for a request"
    assert service.snapshot() is first, "invalidating never discards what is being shown"
    service.release.set()
    service.refresh_thread.join(timeout=5)
    assert service.snapshot() is not first and service.runs == 2


def test_an_invalidation_during_a_refresh_runs_it_once_more(tmp_path):
    clock = Clock()
    service = SlowService(tmp_path, clock)
    service.snapshot()
    service.invalidate()   # refresh 1 starts and waits
    deadline = time.monotonic() + 5
    while service.runs < 2 and time.monotonic() < deadline:  # until refresh 1 is computing
        time.sleep(0.01)
    service.invalidate()   # arrives during refresh 1: its inputs may be older than this change
    service.release.set()
    service.refresh_thread.join(timeout=5)
    assert service.runs == 3 and not service._stale


def test_a_failed_refresh_keeps_the_previous_assessment(tmp_path):
    clock = Clock()
    service = SlowService(tmp_path, clock, delay=0.0)
    first = service.snapshot()
    service.fail = True
    clock.now += 1801
    assert service.snapshot() is first
    service.refresh_thread.join(timeout=5)
    assert service.snapshot() is first and service.runs == 2, "no retry storm straight after a failure"
    clock.now += 61
    service.fail = False
    service.snapshot()
    service.refresh_thread.join(timeout=5)
    assert service.snapshot() is not first and service.runs == 3


def test_concurrent_first_requests_wait_for_one_computation(tmp_path):
    service = SlowService(tmp_path, Clock(), delay=0.0)
    with ThreadPoolExecutor(max_workers=8) as pool:
        snapshots = list(pool.map(lambda _: service.snapshot(), range(8)))
    assert service.runs == 1 and all(s is snapshots[0] for s in snapshots)
