"""SQLite storage for alerts, transcripts and chat. One connection, guarded by a lock."""
import json
import sqlite3
import threading
import time
import uuid

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY, created REAL, room TEXT, speaker TEXT, role TEXT, source TEXT,
  pii TEXT, kind TEXT, conf REAL, rule TEXT, matched TEXT, text TEXT, context TEXT,
  clip_file TEXT, clip_sha256 TEXT, clip_start_s REAL, clip_end_s REAL,
  incident_start_s REAL, incident_end_s REAL, detect_latency_s REAL, ready_latency_s REAL,
  status TEXT, review_note TEXT, merged_count INTEGER DEFAULT 0, case_id TEXT, clip_flags TEXT, clip_ok INTEGER);
CREATE TABLE IF NOT EXISTS utterances (
  id TEXT PRIMARY KEY, created REAL, room TEXT, speaker TEXT, role TEXT, source TEXT,
  start_s REAL, end_s REAL, text TEXT, lang TEXT, lang_probs TEXT, findings TEXT,
  max_conf REAL, skipped TEXT, asr_ms REAL, queue_ms REAL, audio_s REAL, case_id TEXT);
CREATE TABLE IF NOT EXISTS chat (
  id TEXT PRIMARY KEY, created REAL, room TEXT, sender TEXT, role TEXT, text TEXT,
  findings TEXT, max_conf REAL, alert_id TEXT, case_id TEXT);
"""


class Store:
    def __init__(self, path=None):
        self.db = sqlite3.connect(str(path or config.DB_PATH), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        with self.lock:
            self.db.executescript(SCHEMA)

    @staticmethod
    def new_id():
        return uuid.uuid4().hex[:10]

    def insert(self, table, **row):
        row.setdefault("id", self.new_id())
        row.setdefault("created", time.time())
        cols = ",".join(row)
        qs = ",".join("?" * len(row))
        with self.lock:
            self.db.execute(f"INSERT INTO {table} ({cols}) VALUES ({qs})", list(row.values()))
            self.db.commit()
        return row["id"]

    def update(self, table, id_, **fields):
        if not fields:
            return
        sets = ",".join(f"{k}=?" for k in fields)
        with self.lock:
            self.db.execute(f"UPDATE {table} SET {sets} WHERE id=?", [*fields.values(), id_])
            self.db.commit()

    def get(self, table, id_):
        with self.lock:
            r = self.db.execute(f"SELECT * FROM {table} WHERE id=?", (id_,)).fetchone()
        return dict(r) if r else None

    def rows(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def reset(self):
        with self.lock:
            for t in ("alerts", "utterances", "chat"):
                self.db.execute(f"DELETE FROM {t}")
            self.db.commit()


def _plain(o):
    # numpy numbers and booleans -> plain Python, so a stray numpy value can never block an alert
    for attr in ("item",):
        if hasattr(o, attr):
            return o.item()
    raise TypeError(f"not JSON serializable: {type(o).__name__}")


def jdump(o):
    return json.dumps(o, ensure_ascii=False, default=_plain)
