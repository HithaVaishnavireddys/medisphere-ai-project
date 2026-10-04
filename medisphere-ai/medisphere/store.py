"""Domain data access: sites, users, patients, encounters, appointments. All queries are site-scoped."""
from __future__ import annotations

import json
import os
import secrets
import time
import uuid
from datetime import datetime, timezone

from . import audit, db, security

SITES = [
    ("HYD", "MediSphere General Hospital Hyderabad", "India", "Hyderabad", "Asia/Kolkata", "en-IN", "112 / 108", "DPDP Act 2023; ABDM health data guidelines"),
    ("DXB", "MediSphere Medical Centre Dubai", "United Arab Emirates", "Dubai", "Asia/Dubai", "ar-AE", "998 / 999", "UAE PDPL; Federal Law 2/2019 (ICT in health)"),
    ("LON", "MediSphere Clinic London", "United Kingdom", "London", "Europe/London", "en-GB", "999 / 112", "UK GDPR; NHS DSPT"),
    ("SIN", "MediSphere Hospital Singapore", "Singapore", "Singapore", "Asia/Singapore", "en-SG", "995", "PDPA"),
]
DEMO_USERS = [("admin", "System Administrator", "admin", None), ("dr.rao", "Dr. Meera Rao", "doctor", "HYD"), ("nurse.iyer", "Nurse Kavya Iyer", "nurse", "HYD"),
              ("front.khan", "Imran Khan", "receptionist", "HYD"), ("dr.haddad", "Dr. Layla Haddad", "doctor", "DXB"), ("analyst.lee", "Grace Lee", "analyst", "LON")]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------ bootstrap
def bootstrap() -> dict | None:
    """Create tables, sites and (first run only) demo users. Returns generated credentials once, else None."""
    db.configure()
    created = None
    with db.connect() as c:
        for s in SITES:
            c.execute("INSERT OR IGNORE INTO sites VALUES(?,?,?,?,?,?,?,?)", s)
        if not c.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            pw = os.getenv("MEDISPHERE_SEED_PASSWORD") or ("Medisphere#" + secrets.token_urlsafe(9))
            security.check_password_policy(pw)
            for u, n, r, s in DEMO_USERS:
                c.execute("INSERT INTO users(username,name,role,site_id,pw_hash,created_at) VALUES(?,?,?,?,?,?)", (u, n, r, s, security.hash_password(pw), now()))
            created = {"password": pw, "users": [u[0] for u in DEMO_USERS]}
    return created


def sites() -> list[dict]:
    return db.rows("SELECT * FROM sites ORDER BY id")


def site(site_id: str) -> dict:
    s = db.one("SELECT * FROM sites WHERE id=?", (site_id,))
    if not s:
        raise KeyError("site not found")
    return s


# ------------------------------------------------------------------ users
def public_user(u: dict) -> dict:
    return {"id": u["id"], "username": u["username"], "name": u["name"], "role": u["role"], "role_label": security.ROLE_LABEL.get(u["role"], u["role"]),
            "site_id": u["site_id"], "permissions": sorted(security.PERMISSIONS[u["role"]])}


def authenticate(username: str, password: str, ip: str = "") -> dict:
    u = db.one("SELECT * FROM users WHERE username=?", (username.strip().lower(),))
    if not u or not u["active"]:
        security.hash_password("dummy-timing-equaliser")  # keep timing similar for unknown users
        audit.log(None, "auth.login", username[:40], "denied", ip=ip)
        raise PermissionError("invalid username or password")
    if u["locked_until"] and u["locked_until"] > time.time():
        audit.log(u, "auth.login", u["username"], "locked", ip=ip)
        raise PermissionError("account temporarily locked after repeated failures; try again later")
    if not security.verify_password(password, u["pw_hash"]):
        failed = u["failed"] + 1
        lock = time.time() + security.LOCK_SECONDS if failed >= security.MAX_FAILED else 0
        db.run("UPDATE users SET failed=?, locked_until=? WHERE id=?", (0 if lock else failed, lock, u["id"]))
        audit.log(u, "auth.login", u["username"], "denied", ip=ip)
        raise PermissionError("invalid username or password")
    db.run("UPDATE users SET failed=0, locked_until=0 WHERE id=?", (u["id"],))
    audit.log(u, "auth.login", u["username"], "ok", ip=ip)
    return u


def get_user(uid: int) -> dict | None:
    return db.one("SELECT * FROM users WHERE id=? AND active=1", (uid,))


def list_users() -> list[dict]:
    return [{k: v for k, v in u.items() if k not in ("pw_hash",)} for u in db.rows("SELECT * FROM users ORDER BY id")]


def create_user(body: dict) -> dict:
    username, role = (body.get("username") or "").strip().lower(), body.get("role")
    if not username or role not in security.PERMISSIONS:
        raise ValueError("username and a valid role are required")
    security.check_password_policy(body.get("password") or "")
    if role != "admin" and not body.get("site_id"):
        raise ValueError("site_id is required for non-admin roles")
    if db.one("SELECT 1 FROM users WHERE username=?", (username,)):
        raise ValueError("username already exists")
    uid = db.run("INSERT INTO users(username,name,role,site_id,pw_hash,created_at) VALUES(?,?,?,?,?,?)",
                 (username, body.get("name") or username, role, body.get("site_id"), security.hash_password(body["password"]), now()))
    return public_user(get_user(uid))


# ------------------------------------------------------------------ patients
def _patient_out(p: dict, full: bool = True) -> dict:
    phone = security.dec(p["phone"])
    return {"id": p["id"], "mrn": p["mrn"], "name": p["name"], "sex": p["sex"], "age": p["age"], "language": p["language"], "site_id": p["site_id"],
            "dob": security.dec(p["dob"]) if full else None, "phone": phone if full else ("*" * max(0, len(phone or "") - 2) + (phone or "")[-2:]) if phone else None,
            "created_at": p["created_at"]}


def create_patient(site_id: str, body: dict, by: int | None) -> dict:
    name = (body.get("name") or "").strip()
    if len(name) < 2:
        raise ValueError("patient name is required")
    age, dob = body.get("age"), body.get("dob")
    if age in ("", None) and not dob:
        raise ValueError("age or date of birth is required")
    pid = "pt_" + uuid.uuid4().hex[:10]
    with db.connect() as c:
        n = c.execute("SELECT COUNT(*) FROM patients WHERE site_id=?", (site_id,)).fetchone()[0] + 1
        mrn = f"{site_id}-{datetime.now().year}-{n:06d}"
        c.execute("INSERT INTO patients VALUES(?,?,?,?,?,?,?,?,?,?,?)", (pid, site_id, mrn, name, security.enc(dob), float(age) if age not in ("", None) else None,
                  body.get("sex"), security.enc(body.get("phone")), body.get("language") or "en", now(), by))
    return get_patient(pid, site_id)


def get_patient(pid: str, site_id: str | None, full: bool = True) -> dict:
    p = db.one("SELECT * FROM patients WHERE id=?" + (" AND site_id=?" if site_id else ""), (pid,) + ((site_id,) if site_id else ()))
    if not p:
        raise KeyError("patient not found")
    return _patient_out(p, full)


def search_patients(site_id: str, q: str = "", limit: int = 50) -> list[dict]:
    q = q.strip()
    if q:
        like = f"%{q}%"
        r = db.rows("SELECT * FROM patients WHERE site_id=? AND (name LIKE ? OR mrn LIKE ?) ORDER BY created_at DESC LIMIT ?", (site_id, like, like, limit))
    else:
        r = db.rows("SELECT * FROM patients WHERE site_id=? ORDER BY created_at DESC LIMIT ?", (site_id, limit))
    return [_patient_out(p, full=False) for p in r]


# ------------------------------------------------------------------ encounters
def create_encounter(site_id: str, patient_id: str, complaint: str, triage: dict, vitals: dict | None, by: int | None) -> dict:
    eid = "en_" + uuid.uuid4().hex[:10]
    db.run("INSERT INTO encounters(id,patient_id,site_id,arrived_at,complaint,level,level_name,department,news2,vitals_json,triage_json,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
           (eid, patient_id, site_id, now(), complaint, triage["level"], triage["level_name"], triage["department"], triage.get("news2"),
            json.dumps(vitals) if vitals else None, json.dumps(triage), "waiting", by))
    return get_encounter(eid, site_id)


def get_encounter(eid: str, site_id: str | None) -> dict:
    e = db.one("SELECT * FROM encounters WHERE id=?" + (" AND site_id=?" if site_id else ""), (eid,) + ((site_id,) if site_id else ()))
    if not e:
        raise KeyError("encounter not found")
    e["vitals"] = json.loads(e.pop("vitals_json") or "null")
    e["triage"] = json.loads(e.pop("triage_json") or "null")
    return e


def patient_encounters(pid: str, site_id: str) -> list[dict]:
    return [get_encounter(r["id"], site_id) for r in db.rows("SELECT id FROM encounters WHERE patient_id=? AND site_id=? ORDER BY arrived_at DESC", (pid, site_id))]


def queue(site_id: str) -> list[dict]:
    rows = db.rows("""SELECT e.id, e.patient_id, e.arrived_at, e.complaint, e.level, e.level_name, e.department, e.news2, e.status, e.started_at, p.name, p.mrn, p.age, p.sex
                      FROM encounters e JOIN patients p ON p.id=e.patient_id WHERE e.site_id=? AND e.status IN ('waiting','in_treatment')
                      ORDER BY e.level ASC, e.arrived_at ASC""", (site_id,))
    t = datetime.now(timezone.utc)
    for r in rows:
        r["waiting_min"] = int((t - datetime.fromisoformat(r["arrived_at"])).total_seconds() // 60)
    return rows


STATUS_FLOW = {"waiting": {"in_treatment", "discharged"}, "in_treatment": {"discharged", "waiting"}, "discharged": set()}


def set_status(eid: str, site_id: str, status: str) -> dict:
    e = get_encounter(eid, site_id)
    if status not in STATUS_FLOW.get(e["status"], set()):
        raise ValueError(f"cannot move an encounter from {e['status']} to {status}")
    sets = {"in_treatment": "started_at=?", "discharged": "closed_at=?"}.get(status)
    if sets:
        db.run(f"UPDATE encounters SET status=?, {sets} WHERE id=?", (status, now(), eid))
    else:
        db.run("UPDATE encounters SET status=? WHERE id=?", (status, eid))
    return get_encounter(eid, site_id)


def create_appointment(site_id: str, patient_id: str, encounter_id: str, department: str, slot: str) -> str:
    aid = "ap_" + uuid.uuid4().hex[:10]
    db.run("INSERT INTO appointments VALUES(?,?,?,?,?,?,?)", (aid, patient_id, encounter_id, site_id, department, slot, "booked"))
    return aid
