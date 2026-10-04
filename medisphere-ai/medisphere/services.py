"""Service layer: framework-independent handlers. FastAPI (api.py) and the zero-dependency
server (server_lite.py) both call these, so the logic is tested once."""
from __future__ import annotations

import base64
import uuid

from . import analytics, config, guardrails, llm, ocr, prompts, tools, workflow
from .agents import ResearchAgent
from .rag import Assistant
from .retrieval import HybridRetriever
from .triage import TriageRequest, triage

_state: dict = {}


def _s():
    if not _state:
        r = HybridRetriever()
        _state.update(retriever=r, assistant=Assistant(r), agent=ResearchAgent(r))
    return _state


def health() -> dict:
    st = _s()
    return {"status": "ok", "version": "1.0.0", "hospital": config.HOSPITAL_NAME, "providers": llm.available_providers(),
            "active_provider": llm.resolve(), "ocr": ocr.ocr_available(), "indexed_chunks": len(st["retriever"].chunks),
            "documents": len({c.doc_id for c in st["retriever"].chunks})}


def chat(body: dict, scope: str = "", emergency: str | None = None) -> dict:
    q = (body.get("question") or "").strip()
    if not q:
        raise ValueError("question is required")
    sid = scope + (body.get("session_id") or "default")  # conversations are private to the signed-in user
    return _s()["assistant"].ask(q[:2000], sid, body.get("provider"), body.get("mode", "hybrid"), emergency)


def search(body: dict) -> dict:
    q = (body.get("query") or "").strip()
    if not q:
        raise ValueError("query is required")
    r = _s()["retriever"]
    base, extra = r.expand(q)
    out = {}
    for mode in ("keyword", "semantic", "hybrid"):
        out[mode] = r.search(q, k=int(body.get("k", 5)), mode=mode)
        for x in out[mode]:
            x.pop("text", None)
    return {"query": q, "expansion": extra, "results": out}


def do_triage(body: dict) -> dict:
    return triage(TriageRequest(**body)).model_dump()


def do_agent(body: dict) -> dict:
    q = (body.get("question") or "").strip()
    if not q:
        raise ValueError("question is required")
    return _s()["agent"].run(q[:2500], body.get("provider"))


def doc_analyze(body: dict) -> dict:
    text = body.get("text") or ""
    if body.get("image_b64"):
        raw = base64.b64decode(body["image_b64"].split(",")[-1])
        text = ocr.extract_text(raw)
    if not text.strip():
        raise ValueError("provide text or an image")
    res = ocr.analyse(text, body.get("sex"))
    res.pop("text", None)  # patient documents are analysed in memory and never stored or indexed
    return res


def ingest(body: dict) -> dict:
    text, title = (body.get("text") or "").strip(), body.get("title") or "Uploaded document"
    if len(text) < 40:
        raise ValueError("document text is too short")
    clean, found = guardrails.redact_pii(text)
    n = _s()["retriever"].add_document(f"upload-{uuid.uuid4().hex[:6]}", title, clean)
    return {"title": title, "chunks_added": n, "pii_masked": len(found), "total_chunks": len(_s()["retriever"].chunks)}


def playground(body: dict) -> dict:
    q = (body.get("question") or "").strip()
    if not q:
        raise ValueError("question is required")
    r = _s()["retriever"]
    ctx_docs = r.search(q, k=2)
    ctx = "\n".join(f"- {d['title']}: {d['snippet']}" for d in ctx_docs if d["score"] >= 0.3)
    out = []
    for strat in body.get("strategies") or list(prompts.STRATEGIES):
        prompt = prompts.build_prompt(strat, q, ctx)
        offline = ("\n".join(f"- {d['snippet']}" for d in ctx_docs[:1] if d["score"] >= 0.3) or "No grounded context found.")
        res = llm.complete("You are a careful clinical assistant.", prompt, body.get("provider"), max_tokens=350, offline_fn=lambda o=offline: o)
        out.append({"strategy": strat, "prompt": prompt, "response": res["text"], "provider": res["provider"], "latency_ms": res["latency_ms"],
                    "tokens_est": len(prompt.split()) + len(res["text"].split())})
    return {"question": q, "runs": out, "providers": llm.available_providers()}


def tools_list() -> dict:
    return {"tools": [t["schema"] for t in tools.REGISTRY.values()]}


def dashboard(site_id: str = "HYD") -> dict:
    return analytics.dashboard(site_id)


def reset(body: dict, scope: str = "") -> dict:
    _s()["assistant"].memory.reset(scope + (body.get("session_id") or "default"))
    return {"ok": True}


def system() -> dict:
    from . import security
    h = health()
    h.update(field_encryption=security.encryption_enabled(), ephemeral_secret=security.SECRET_IS_EPHEMERAL)
    return h
