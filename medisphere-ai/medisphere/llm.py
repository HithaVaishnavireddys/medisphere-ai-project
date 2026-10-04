"""Day 1-3 - LLM provider abstraction (multi-model).

Providers: offline (deterministic, no key needed), anthropic, openai.
Any provider error falls back to offline so the app never breaks during a demo.
Live providers use only the standard library (urllib) - no extra dependency.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request

from . import config


def available_providers() -> list[str]:
    out = ["offline"]
    if os.getenv("ANTHROPIC_API_KEY"):
        out.append("anthropic")
    if os.getenv("OPENAI_API_KEY"):
        out.append("openai")
    return out


def resolve(provider: str | None = None) -> str:
    p = provider or config.LLM_PROVIDER
    av = available_providers()
    if p == "auto":
        return av[-1] if len(av) > 1 else "offline"
    return p if p in av else "offline"


def _post(url: str, headers: dict, body: dict, timeout: int = 40) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - fixed https endpoints
        return json.loads(r.read().decode())


def complete(system: str, user: str, provider: str | None = None, max_tokens: int = 600, offline_fn=None) -> dict:
    """Return {text, provider, latency_ms, fallback}. `offline_fn` supplies the deterministic answer."""
    p = resolve(provider)
    t0 = time.time()
    if p == "anthropic":
        try:
            r = _post("https://api.anthropic.com/v1/messages",
                      {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01"},
                      {"model": config.ANTHROPIC_MODEL, "max_tokens": max_tokens, "system": system,
                       "messages": [{"role": "user", "content": user}]})
            return {"text": "".join(b.get("text", "") for b in r["content"]), "provider": f"anthropic:{config.ANTHROPIC_MODEL}",
                    "latency_ms": int((time.time() - t0) * 1000), "fallback": False}
        except Exception as e:  # network, quota, bad key...
            err = str(e)[:80]
    elif p == "openai":
        try:
            r = _post("https://api.openai.com/v1/chat/completions",
                      {"authorization": "Bearer " + os.environ["OPENAI_API_KEY"]},
                      {"model": config.OPENAI_MODEL, "max_tokens": max_tokens,
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
            return {"text": r["choices"][0]["message"]["content"], "provider": f"openai:{config.OPENAI_MODEL}",
                    "latency_ms": int((time.time() - t0) * 1000), "fallback": False}
        except Exception as e:
            err = str(e)[:80]
    else:
        err = ""
    text = offline_fn() if offline_fn else "(offline mode: no LLM key configured)"
    return {"text": text, "provider": "offline:extractive", "latency_ms": int((time.time() - t0) * 1000),
            "fallback": p != "offline", "error": err}
