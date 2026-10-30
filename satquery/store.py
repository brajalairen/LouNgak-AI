"""Persistent records for field operations: a small SQLite document store.

One table, `records(kind, id, doc, updated_at)`. Each record is a pydantic model stored as JSON under
its kind ("report", "task", "alert_state", "demo_alert"). A prototype holds tens to thousands of
records, so filtering happens in Python; there is no ORM and no migration step. The file lives at
SATQUERY_DB_PATH (default data/loungak.sqlite3, gitignored); tests use ":memory:".
"""

import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

M = TypeVar("M", bound=BaseModel)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: str | Path = ":memory:"):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        self._db = sqlite3.connect(self.path, check_same_thread=False)
        self._lock = threading.Lock()  # one writer at a time; FastAPI runs sync handlers in a thread pool
        with self._lock, self._db:
            self._db.execute("CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, "
                             "doc TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))")

    def put(self, kind: str, record_id: str, record: BaseModel) -> None:
        with self._lock, self._db:
            self._db.execute("INSERT OR REPLACE INTO records (kind, id, doc, updated_at) VALUES (?, ?, ?, ?)",
                             (kind, record_id, record.model_dump_json(), now_iso()))

    def get(self, kind: str, record_id: str, model: type[M]) -> M | None:
        with self._lock:
            row = self._db.execute("SELECT doc FROM records WHERE kind = ? AND id = ?", (kind, record_id)).fetchone()
        return model.model_validate_json(row[0]) if row else None

    def all(self, kind: str, model: type[M]) -> list[M]:
        with self._lock:
            rows = self._db.execute("SELECT doc FROM records WHERE kind = ? ORDER BY id", (kind,)).fetchall()
        return [model.model_validate_json(row[0]) for row in rows]

    def count(self, kind: str) -> int:
        with self._lock:
            return self._db.execute("SELECT COUNT(*) FROM records WHERE kind = ?", (kind,)).fetchone()[0]

    def next_id(self, kind: str, prefix: str) -> str:
        """A readable sequential id, e.g. "RPT-0007". Ids are never reused within a database."""
        with self._lock:
            rows = self._db.execute("SELECT id FROM records WHERE kind = ?", (kind,)).fetchall()
        numbers = [int(r[0].rsplit("-", 1)[-1]) for r in rows if r[0].rsplit("-", 1)[-1].isdigit()]
        return f"{prefix}-{max(numbers, default=0) + 1:04d}"

    def delete_kind(self, kind: str) -> None:
        with self._lock, self._db:
            self._db.execute("DELETE FROM records WHERE kind = ?", (kind,))
