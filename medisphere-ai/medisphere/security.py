"""Authentication, authorisation (RBAC), brute-force protection, rate limiting and field encryption.

* Passwords: PBKDF2-HMAC-SHA256, 310 000 iterations, per-user random salt (stdlib only).
* Tokens   : compact signed tokens (HMAC-SHA256) with expiry and a per-user token version, so
             changing a password or deactivating a user revokes existing tokens immediately.
* RBAC     : explicit role -> permission matrix; every route declares the permission it needs.
* Field encryption: phone / date of birth are encrypted at rest with Fernet when the optional
             `cryptography` package and MEDISPHERE_FIELD_KEY are present.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time

TOKEN_TTL = int(os.getenv("MEDISPHERE_TOKEN_TTL", str(8 * 3600)))
MAX_FAILED = 5
LOCK_SECONDS = 15 * 60
_SECRET = (os.getenv("MEDISPHERE_SECRET") or "").encode()
if not _SECRET:  # ephemeral secret: tokens die on restart. Set MEDISPHERE_SECRET in production.
    _SECRET = secrets.token_bytes(32)
    SECRET_IS_EPHEMERAL = True
else:
    SECRET_IS_EPHEMERAL = False

PERMISSIONS = {
    "admin": {"*"},
    "doctor": {"patients.read", "patients.write", "encounters.read", "encounters.write", "ai.use", "docs.use", "fhir.export", "dashboard.view", "queue.view", "search.use"},
    "nurse": {"patients.read", "patients.write", "encounters.read", "encounters.write", "ai.use", "docs.use", "dashboard.view", "queue.view", "search.use"},
    "receptionist": {"patients.read", "patients.write", "encounters.write", "queue.view"},
    "analyst": {"dashboard.view", "search.use"},
}
ROLE_LABEL = {"admin": "Administrator", "doctor": "Physician", "nurse": "Nurse", "receptionist": "Front desk", "analyst": "Quality analyst"}


def can(role: str, perm: str) -> bool:
    p = PERMISSIONS.get(role, set())
    return "*" in p or perm in p


# ------------------------------------------------------------------ passwords
def hash_password(pw: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 310_000)
    return f"pbkdf2$310000${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, it, salt, dk = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), base64.b64decode(salt), int(it))
        return hmac.compare_digest(calc, base64.b64decode(dk))
    except Exception:
        return False


def check_password_policy(pw: str) -> None:
    if len(pw) < 10 or pw.lower() == pw or pw.upper() == pw or not any(c.isdigit() for c in pw):
        raise ValueError("password must be at least 10 characters and mix upper case, lower case and digits")


# ------------------------------------------------------------------ tokens
def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def issue_token(user: dict) -> str:
    payload = {"uid": user["id"], "role": user["role"], "tv": user["token_version"], "exp": int(time.time()) + TOKEN_TTL}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_token(token: str) -> dict:
    try:
        body, sig = token.split(".")
        good = _b64(hmac.new(_SECRET, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            raise ValueError
        p = json.loads(_unb64(body))
        if p["exp"] < time.time():
            raise ValueError
        return p
    except Exception:
        raise PermissionError("invalid or expired session; sign in again") from None


# ------------------------------------------------------------------ rate limiting (sliding window, in-memory)
class RateLimiter:
    def __init__(self):
        self.hits: dict[str, list[float]] = {}
        self.lock = threading.Lock()

    def allow(self, key: str, limit: int, window: int = 60) -> bool:
        now = time.time()
        with self.lock:
            q = [t for t in self.hits.get(key, []) if now - t < window]
            ok = len(q) < limit
            if ok:
                q.append(now)
            self.hits[key] = q
            if len(self.hits) > 5000:
                self.hits = {k: v for k, v in self.hits.items() if v and now - v[-1] < window}
            return ok

    def reset(self):
        self.hits.clear()


LIMITER = RateLimiter()


# ------------------------------------------------------------------ field encryption (optional)
_fernet = None
try:
    from cryptography.fernet import Fernet
    _k = os.getenv("MEDISPHERE_FIELD_KEY")
    if _k:
        _fernet = Fernet(_k.encode())
except Exception:  # package missing or bad key
    _fernet = None


def encryption_enabled() -> bool:
    return _fernet is not None


def enc(value: str | None) -> str | None:
    if value is None or _fernet is None:
        return value
    return "enc:" + _fernet.encrypt(value.encode()).decode()


def dec(value: str | None) -> str | None:
    if value is None or not str(value).startswith("enc:"):
        return value
    if _fernet is None:
        return "[encrypted]"
    try:
        return _fernet.decrypt(value[4:].encode()).decode()
    except Exception:
        return "[unreadable]"
