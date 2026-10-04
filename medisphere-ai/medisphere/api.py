"""Day 11 - FastAPI application (production entry point).

Run:  uvicorn medisphere.api:app --host 0.0.0.0 --port 8000       Docs: /docs
All business rules (auth, RBAC, audit, rate limits) live in routes.dispatch, shared with server_lite.
"""
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import routes, services, store
from .config import FRONTEND
from .server_lite import SEC_HEADERS

app = FastAPI(title="MediSphere AI", version="1.0.0", docs_url="/docs" if os.getenv("MEDISPHERE_DOCS", "1") == "1" else None,
              description="Clinical intelligence platform: RAG assistant, triage, document AI, agents, workflow automation, FHIR export.")
origins = [o for o in os.getenv("MEDISPHERE_CORS", "").split(",") if o]
if origins:  # same-origin by default; list explicit origins only if the UI is hosted elsewhere
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type", "X-Site-Id"])


@app.on_event("startup")
def _startup():
    created = store.bootstrap()
    if created:
        print("First run: demo accounts created:", ", ".join(created["users"]), "| initial password:", created["password"])
    services.health()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    for k, v in SEC_HEADERS.items():
        if not (k == "Content-Security-Policy" and request.url.path.startswith("/docs")):
            resp.headers[k] = v
    return resp


def _make(path: str, method: str):
    async def endpoint(request: Request):
        body = {}
        if method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        # path params are re-parsed by dispatch from the concrete URL
        code, out = routes.dispatch(method, request.url.path, dict(request.query_params), body, dict(request.headers), request.client.host if request.client else "")
        return JSONResponse(out, status_code=code)
    return endpoint


_seen = set()
for _m, _rx, _perm, _h, _a in routes.ROUTES:
    _fp = _rx.replace("(?P<pid>[\\w-]+)", "{pid}").replace("(?P<eid>[\\w-]+)", "{eid}")
    if (_m, _fp) not in _seen:
        _seen.add((_m, _fp))
        app.add_api_route(_fp, _make(_fp, _m), methods=[_m], name=f"{_m} {_fp}")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(FRONTEND / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND), name="static")
