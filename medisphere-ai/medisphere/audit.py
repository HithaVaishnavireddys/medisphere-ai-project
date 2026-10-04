"""Tamper-evident audit trail: each entry stores SHA-256(prev_hash + entry), forming a hash chain.
Entries record WHO did WHAT to WHICH record, never clinical content or personal identifiers."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from . import db

GENESIS = "0" * 64


def _digest(prev: str, e: dict) -> str:
    raw = "|".join(str(e.get(k, "")) for k in ("ts", "user_id", "username", "role", "site_id", "action", "resource", "outcome", "ip"))
    return hashlib.sha256((prev + "|" + raw).encode()).hexdigest()


def log(user: dict | None, action: str, resource: str = "", outcome: str = "ok", site_id: str | None = None, ip: str = "") -> None:
    with db.connect() as c:
        last = c.execute("SELECT hash FROM audit ORDER BY id DESC LIMIT 1").fetchone()
        prev = last["hash"] if last else GENESIS
        e = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "user_id": (user or {}).get("id"), "username": (user or {}).get("username", "anonymous"),
             "role": (user or {}).get("role", "-"), "site_id": site_id or (user or {}).get("site_id") or "-", "action": action, "resource": resource, "outcome": outcome, "ip": ip}
        c.execute("INSERT INTO audit(ts,user_id,username,role,site_id,action,resource,outcome,ip,prev_hash,hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                  (e["ts"], e["user_id"], e["username"], e["role"], e["site_id"], action, resource, outcome, ip, prev, _digest(prev, e)))


def recent(limit: int = 100, site_id: str | None = None) -> list[dict]:
    q, a = "SELECT id,ts,username,role,site_id,action,resource,outcome,ip,hash FROM audit", ()
    if site_id:
        q += " WHERE site_id=?"; a = (site_id,)
    return db.rows(q + " ORDER BY id DESC LIMIT ?", a + (limit,))


def verify() -> dict:
    prev, n = GENESIS, 0
    for r in db.rows("SELECT * FROM audit ORDER BY id"):
        n += 1
        if r["prev_hash"] != prev or r["hash"] != _digest(prev, r):
            return {"ok": False, "entries": n, "broken_at": r["id"]}
        prev = r["hash"]
    return {"ok": True, "entries": n, "broken_at": None, "head": prev}
