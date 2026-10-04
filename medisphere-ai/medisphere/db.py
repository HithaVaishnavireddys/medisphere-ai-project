"""Persistence layer (SQLite, WAL). The schema is portable to PostgreSQL; see docs/DEPLOYMENT.md."""
from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from .config import DATA_RW

_path = os.getenv("MEDISPHERE_DB", str(DATA_RW / "medisphere.db"))
_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS sites(id TEXT PRIMARY KEY, name TEXT, country TEXT, city TEXT, timezone TEXT, locale TEXT,
  emergency_number TEXT, regulations TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, name TEXT, role TEXT NOT NULL,
  site_id TEXT, pw_hash TEXT NOT NULL, failed INTEGER DEFAULT 0, locked_until REAL DEFAULT 0, token_version INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS patients(id TEXT PRIMARY KEY, site_id TEXT NOT NULL, mrn TEXT UNIQUE, name TEXT NOT NULL, dob TEXT, age REAL,
  sex TEXT, phone TEXT, language TEXT, created_at TEXT, created_by INTEGER);
CREATE INDEX IF NOT EXISTS ix_pat_site ON patients(site_id, name);
CREATE TABLE IF NOT EXISTS encounters(id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, site_id TEXT NOT NULL, arrived_at TEXT NOT NULL,
  complaint TEXT, level INTEGER, level_name TEXT, department TEXT, news2 INTEGER, vitals_json TEXT, triage_json TEXT, status TEXT DEFAULT 'waiting',
  started_at TEXT, closed_at TEXT, created_by INTEGER);
CREATE INDEX IF NOT EXISTS ix_enc_site ON encounters(site_id, status);
CREATE TABLE IF NOT EXISTS appointments(id TEXT PRIMARY KEY, patient_id TEXT, encounter_id TEXT, site_id TEXT, department TEXT, slot TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, user_id INTEGER, username TEXT, role TEXT, site_id TEXT,
  action TEXT, resource TEXT, outcome TEXT, ip TEXT, prev_hash TEXT, hash TEXT);
"""


def configure(path: str | None = None):
    global _path
    if path:
        _path = path
    Path(_path).parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript(SCHEMA)


@contextmanager
def connect():
    with _lock:
        Path(_path).parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(_path, timeout=15)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA foreign_keys=ON")
        try:
            yield con
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()


def rows(sql: str, args: tuple = ()) -> list[dict]:
    with connect() as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]


def one(sql: str, args: tuple = ()) -> dict | None:
    r = rows(sql, args)
    return r[0] if r else None


def run(sql: str, args: tuple = ()) -> int:
    with connect() as c:
        return c.execute(sql, args).lastrowid
