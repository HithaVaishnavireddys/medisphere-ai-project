"""Day 9 - guardrails: PII redaction, prompt-injection defence, emergency/self-harm routing,
dose-personalisation limits, grounding check and mandatory disclaimers."""
from __future__ import annotations

import re

from .config import DISCLAIMER, GROUNDING_THRESHOLD, rules

SELF_HARM_MESSAGE = (
    "I'm really sorry you're going through this. You deserve support right now. Please contact someone who can help "
    "immediately: in India call Tele-MANAS 14416 or emergency services on 112; in the US call or text 988. "
    "If you are in immediate danger, call your local emergency number or go to the nearest emergency department, "
    "and try not to be alone."
)


def redact_pii(text: str) -> tuple[str, list[dict]]:
    """Mask identifiers before any text reaches an LLM, a log or an index."""
    findings = []
    out = text
    for kind, pat in rules()["guard"]["pii"].items():
        def _sub(m, kind=kind):
            findings.append({"type": kind, "preview": m.group(0)[:2] + "***"})
            return f"[{kind.upper()}]"
        out = re.sub(pat, _sub, out, flags=re.I)
    return out, findings


def detect_injection(text: str) -> bool:
    return any(re.search(p, text, re.I) for p in rules()["guard"]["injection"])


def check_input(text: str) -> dict:
    """Run all input checks; returns a report the API surfaces to the UI."""
    g = rules()["guard"]
    clean, pii = redact_pii(text)
    lowered = text.lower()
    flags = {
        "injection": detect_injection(text),
        "self_harm": any(re.search(p, lowered) for s in rules()["symptoms"] if s["id"] == "suicidal" for p in s["patterns"]),
        "dose_request": bool(re.search(g["dosing"], lowered)) and bool(re.search(g["personal"], lowered)),
        "pii": bool(pii),
    }
    return {"clean_text": clean, "pii": pii, "flags": flags}


def apply_output(answer: str, report: dict, grounded: bool, urgent: bool = False, emergency: str | None = None) -> dict:
    """Wrap an answer with the safety messaging required for the situation."""
    notes = []
    flags = report["flags"]
    banners = []
    if flags["self_harm"]:
        banners.append({"kind": "crisis", "text": SELF_HARM_MESSAGE})
        notes.append("Self-harm language detected: crisis resources prepended.")
    if urgent:
        banners.append({"kind": "emergency", "text": "Possible emergency. Call " + (emergency or rules()["guard"]["emergency_numbers"]) + " now. Do not wait for an online answer."})
        notes.append("Emergency pattern detected: escalation banner added.")
    if flags["injection"]:
        notes.append("Prompt-injection attempt neutralised; instructions in the user text were ignored.")
    if flags["dose_request"]:
        notes.append("Patient-specific dosing is not provided; general information only. Confirm with a pharmacist or prescriber.")
    if flags["pii"]:
        notes.append(f"{len(report['pii'])} personal identifier(s) were masked before processing.")
    if not grounded:
        notes.append("No sufficiently relevant source found; the assistant abstained instead of guessing.")
    return {"answer": answer, "banners": banners, "guardrail_notes": notes, "disclaimer": DISCLAIMER}


def is_grounded(results: list[dict]) -> bool:
    return bool(results) and results[0]["score"] >= GROUNDING_THRESHOLD
