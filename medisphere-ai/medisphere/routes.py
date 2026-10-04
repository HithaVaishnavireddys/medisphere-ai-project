"""Single request pipeline shared by the FastAPI app and the zero-dependency server:
rate limit -> route match -> authenticate -> authorise (RBAC) -> site scoping -> handler -> audit -> error mapping."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field

from pydantic import ValidationError

from . import analytics, audit, fhir, security, services, store, workflow


class AuthError(Exception): ...
class Forbidden(Exception): ...
class RateLimited(Exception): ...


@dataclass
class Ctx:
    user: dict | None = None
    site_id: str = "HYD"
    body: dict = field(default_factory=dict)
    params: dict = field(default_factory=dict)
    query: dict = field(default_factory=dict)
    ip: str = ""


# ------------------------------------------------------------------ handlers
def h_login(c: Ctx):
    if not security.LIMITER.allow("login:" + c.ip, 10):
        raise RateLimited("too many sign-in attempts; wait a minute")
    try:
        u = store.authenticate(c.body.get("username") or "", c.body.get("password") or "", c.ip)
    except PermissionError as e:
        raise AuthError(str(e))
    site_id = u["site_id"] or "HYD"
    return {"token": security.issue_token(u), "expires_in": security.TOKEN_TTL, "user": store.public_user(u), "site": store.site(site_id), "sites": store.sites() if u["role"] == "admin" else [store.site(site_id)]}


def h_me(c: Ctx):
    return {"user": store.public_user(c.user), "site": store.site(c.site_id)}


def h_patients(c: Ctx):
    return {"patients": store.search_patients(c.site_id, c.query.get("q", ""))}


def h_patient_create(c: Ctx):
    return store.create_patient(c.site_id, c.body, c.user["id"])


def h_patient_get(c: Ctx):
    p = store.get_patient(c.params["pid"], c.site_id)
    return {"patient": p, "encounters": store.patient_encounters(p["id"], c.site_id)}


def h_fhir(c: Ctx):
    p = store.get_patient(c.params["pid"], c.site_id)
    return fhir.bundle(p, store.site(c.site_id), store.patient_encounters(p["id"], c.site_id))


def h_queue(c: Ctx):
    q = store.queue(c.site_id)
    return {"queue": q, "waiting": sum(1 for r in q if r["status"] == "waiting"), "in_treatment": sum(1 for r in q if r["status"] == "in_treatment")}


def h_status(c: Ctx):
    return store.set_status(c.params["eid"], c.site_id, c.body.get("status") or "")


def h_workflow(c: Ctx):
    return workflow.run_intake(c.body, c.site_id, c.user, c.ip)


def h_dashboard(c: Ctx):
    d = services.dashboard(c.site_id)
    q = store.queue(c.site_id)
    d["live"] = {"waiting": sum(1 for r in q if r["status"] == "waiting"), "in_treatment": sum(1 for r in q if r["status"] == "in_treatment"),
                 "critical_waiting": sum(1 for r in q if r["status"] == "waiting" and r["level"] <= 2)}
    return d


def h_audit(c: Ctx):
    return {"entries": audit.recent(int(c.query.get("limit", 60)), c.site_id if c.query.get("scope") == "site" else None)}


def h_users_create(c: Ctx):
    return store.create_user(c.body)


# ------------------------------------------------------------------ route table: (method, path regex, permission, handler, audit action)
def _chat(c): return services.chat(c.body, scope=f"u{c.user['id']}:", emergency=store.site(c.site_id)["emergency_number"])
def _reset(c): return services.reset(c.body, scope=f"u{c.user['id']}:")


ROUTES = [
    ("POST", r"/api/auth/login", None, h_login, None),
    ("GET", r"/api/health", None, lambda c: {"status": "ok", "version": "1.0.0"}, None),
    ("GET", r"/api/auth/me", "", h_me, None),
    ("GET", r"/api/system", "users.manage", lambda c: services.system(), None),
    ("GET", r"/api/sites", "", lambda c: {"sites": store.sites() if c.user["role"] == "admin" else [store.site(c.site_id)]}, None),
    ("GET", r"/api/patients", "patients.read", h_patients, "patient.search"),
    ("POST", r"/api/patients", "patients.write", h_patient_create, "patient.create"),
    ("GET", r"/api/patients/(?P<pid>[\w-]+)/fhir", "fhir.export", h_fhir, "patient.fhir_export"),
    ("GET", r"/api/patients/(?P<pid>[\w-]+)", "patients.read", h_patient_get, "patient.read"),
    ("GET", r"/api/queue", "queue.view", h_queue, None),
    ("POST", r"/api/encounters/(?P<eid>[\w-]+)/status", "encounters.write", h_status, "encounter.status"),
    ("POST", r"/api/workflow", "encounters.write", h_workflow, None),
    ("GET", r"/api/dashboard", "dashboard.view", h_dashboard, None),
    ("GET", r"/api/audit", "audit.view", h_audit, None),
    ("GET", r"/api/audit/verify", "audit.view", lambda c: audit.verify(), "audit.verify"),
    ("GET", r"/api/users", "users.manage", lambda c: {"users": store.list_users()}, "user.list"),
    ("POST", r"/api/users", "users.manage", h_users_create, "user.create"),
    ("POST", r"/api/chat", "ai.use", _chat, "ai.chat"),
    ("POST", r"/api/reset", "ai.use", _reset, None),
    ("POST", r"/api/triage", "ai.use", lambda c: services.do_triage(c.body), "ai.triage"),
    ("POST", r"/api/agent", "ai.use", lambda c: services.do_agent(c.body), "ai.agent"),
    ("POST", r"/api/document", "docs.use", lambda c: services.doc_analyze(c.body), "docs.analyse"),
    ("POST", r"/api/playground", "ai.use", lambda c: services.playground(c.body), None),
    ("POST", r"/api/search", "search.use", lambda c: services.search(c.body), None),
    ("GET", r"/api/tools", "ai.use", lambda c: services.tools_list(), None),
    ("POST", r"/api/ingest", "kb.manage", lambda c: services.ingest(c.body), "kb.ingest"),
]
_COMPILED = [(m, re.compile("^" + p + "$"), perm, h, a) for m, p, perm, h, a in ROUTES]


def _user_from(headers: dict) -> dict:
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise AuthError("sign in required")
    try:
        p = security.read_token(auth[7:].strip())
    except PermissionError as e:
        raise AuthError(str(e))
    u = store.get_user(p["uid"])
    if not u or u["token_version"] != p["tv"]:
        raise AuthError("session is no longer valid; sign in again")
    return u


def dispatch(method: str, path: str, query: dict | None, body: dict | None, headers: dict | None, ip: str = "") -> tuple[int, dict]:
    headers = {k.lower(): v for k, v in (headers or {}).items()}
    rid = uuid.uuid4().hex[:8]
    ctx = Ctx(body=body or {}, query=query or {}, ip=ip)
    try:
        if not security.LIMITER.allow("ip:" + ip, 300):
            raise RateLimited("rate limit exceeded; slow down")
        route = None
        for m, rx, perm, h, act in _COMPILED:
            mt = rx.match(path.rstrip("/") or "/")
            if mt and m == method:
                route, ctx.params = (perm, h, act), mt.groupdict(); break
        if route is None:
            return 404, {"detail": "not found", "request_id": rid}
        perm, handler, act = route
        if perm is not None:
            ctx.user = _user_from(headers)
            if perm and not security.can(ctx.user["role"], perm):
                audit.log(ctx.user, act or path, path, "forbidden", ip=ip)
                raise Forbidden(f"your role ({ctx.user['role']}) is not allowed to do this")
            ctx.site_id = ctx.user["site_id"] or "HYD"
            want = headers.get("x-site-id") or ctx.query.get("site")
            if want and ctx.user["role"] == "admin":
                store.site(want)  # 404 if unknown
                ctx.site_id = want
        out = handler(ctx)
        if act:
            res = ctx.params.get("pid") or ctx.params.get("eid") or (out.get("id") if isinstance(out, dict) and "id" in out else "")
            audit.log(ctx.user, act, str(res), "ok", ctx.site_id, ip)
        return 200, out
    except AuthError as e:
        return 401, {"detail": str(e), "request_id": rid}
    except Forbidden as e:
        return 403, {"detail": str(e), "request_id": rid}
    except RateLimited as e:
        return 429, {"detail": str(e), "request_id": rid}
    except KeyError as e:
        return 404, {"detail": str(e).strip("'\""), "request_id": rid}
    except (ValueError, TypeError, ValidationError) as e:
        return 422, {"detail": str(e), "request_id": rid}
    except RuntimeError as e:
        return 503, {"detail": str(e), "request_id": rid}
    except Exception:  # never leak internals
        import logging
        logging.getLogger("medisphere").exception("unhandled error %s %s", method, path)
        return 500, {"detail": "internal error", "request_id": rid}
