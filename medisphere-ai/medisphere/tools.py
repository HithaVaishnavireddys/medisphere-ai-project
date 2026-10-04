"""Days 4 & 10 - function calling: a typed tool registry + an offline intent router.

Each tool has a JSON-schema (so it can be handed to any LLM's tool-use API) and a Python callable.
`route()` mimics the model's tool choice offline so the whole system works without an API key.
"""
from __future__ import annotations

import re
from typing import Callable

from .config import load_json
from .memory import drugs_in
from .triage import TriageRequest, Vitals, news2_score, triage


# ------------------------------------------------------------------ individual tools
def check_drug_interactions(drugs: list[str]) -> dict:
    drugs = [d.lower() for d in drugs]
    pairs = load_json("drug_interactions.json")["pairs"]
    found = []
    for p in pairs:
        if p["a"] in drugs and p["b"] in drugs:
            found.append(p)
        elif p["b"] in drugs and p["a"] in drugs:
            found.append(p)
    order = {"Contraindicated": 0, "Major": 1, "Moderate": 2, "Minor": 3}
    found.sort(key=lambda p: order[p["severity"]])
    return {"drugs": drugs, "interactions": found, "count": len(found),
            "worst": found[0]["severity"] if found else None}


def calculate_news2(resp_rate=None, spo2=None, sbp=None, pulse=None, temp=None, on_oxygen=False, alert=True) -> dict:
    total, detail = news2_score(Vitals(resp_rate=resp_rate, spo2=spo2, sbp=sbp, pulse=pulse, temp=temp, on_oxygen=on_oxygen, alert=alert))
    band = "high" if total >= 7 else "medium" if total >= 5 or any(d["score"] == 3 for d in detail.values()) else "low"
    return {"score": total, "risk": band, "breakdown": detail}


def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    bmi = weight_kg / ((height_cm / 100) ** 2)
    cat = "Underweight" if bmi < 18.5 else "Normal" if bmi < 25 else "Overweight" if bmi < 30 else "Obese"
    return {"bmi": round(bmi, 1), "category": cat, "note": "WHO adult categories; Asian cut-offs are lower (overweight from 23)."}


def triage_patient(complaint: str, age: float | None = None, vitals: dict | None = None) -> dict:
    v = Vitals(**vitals) if vitals else None
    return triage(TriageRequest(complaint=complaint, age=age, vitals=v)).model_dump()


REGISTRY: dict[str, dict] = {}


def register(name: str, fn: Callable, description: str, params: dict):
    REGISTRY[name] = {"fn": fn, "description": description,
                      "schema": {"name": name, "description": description,
                                 "input_schema": {"type": "object", "properties": params, "required": list(params)[:1]}}}


register("check_drug_interactions", check_drug_interactions, "Check interactions between a list of drugs.", {"drugs": {"type": "array", "items": {"type": "string"}}})
register("calculate_news2", calculate_news2, "Compute the NEWS2 early-warning score from vital signs.", {"resp_rate": {"type": "number"}, "spo2": {"type": "number"}, "sbp": {"type": "number"}, "pulse": {"type": "number"}, "temp": {"type": "number"}})
register("calculate_bmi", calculate_bmi, "Compute BMI from weight (kg) and height (cm).", {"weight_kg": {"type": "number"}, "height_cm": {"type": "number"}})
register("triage_patient", triage_patient, "Assign a 5-level triage category from a free-text complaint.", {"complaint": {"type": "string"}, "age": {"type": "number"}})


def call(name: str, args: dict) -> dict:
    if name not in REGISTRY:
        raise KeyError(f"unknown tool: {name}")
    return REGISTRY[name]["fn"](**args)


# ------------------------------------------------------------------ offline intent router
def _num(pat: str, t: str):
    m = re.search(pat, t)
    return float(m.group(1)) if m else None


def parse_vitals(text: str) -> dict:
    t = text.lower()
    v = {}
    m = re.search(r"(?:bp|blood pressure)[^\d]{0,6}(\d{2,3})\s*/\s*(\d{2,3})", t) or re.search(r"\b(\d{2,3})\s*/\s*(\d{2,3})\s*mmhg", t)
    if m:
        v["sbp"] = float(m.group(1))
    for key, pat in (("spo2", r"(?:spo2|sp02|o2 sat\w*|oxygen sat\w*|saturation)[^\d]{0,8}(\d{2,3})"),
                     ("pulse", r"(?:pulse|hr|heart rate)[^\d]{0,8}(\d{2,3})"),
                     ("resp_rate", r"(?:rr|resp\w* rate|respiratory rate)[^\d]{0,8}(\d{1,2})"),
                     ("temp", r"(?:temp\w*)[^\d]{0,8}(\d{2}(?:\.\d)?)")):
        val = _num(pat, t)
        if val is not None:
            v[key] = val
    if "temp" not in v:
        m = re.search(r"(\d{2}(?:\.\d)?)\s*(?:°\s*c|c\b|celsius)", t)
        if m:
            v["temp"] = float(m.group(1))
    return v


def route(text: str) -> list[dict]:
    """Choose tools for a request: [{tool, args, why}]"""
    t = text.lower()
    plan = []
    drugs = drugs_in(t)
    if len(drugs) >= 2:
        plan.append({"tool": "check_drug_interactions", "args": {"drugs": drugs}, "why": f"{len(drugs)} medicines mentioned"})
    vit = parse_vitals(t)
    if len(vit) >= 2:
        plan.append({"tool": "calculate_news2", "args": vit, "why": "vital signs supplied"})
    m = re.search(r"(\d{2,3})\s*kg", t)
    h = re.search(r"(\d{3})\s*cm", t)
    if m and h:
        plan.append({"tool": "calculate_bmi", "args": {"weight_kg": float(m.group(1)), "height_cm": float(h.group(1))}, "why": "weight and height supplied"})
    from .triage import detect_symptoms
    if detect_symptoms(t):
        age = None
        am = re.search(r"(\d{1,3})[- ]?(?:year|yr|y)s?[- ]?old", t)
        if am:
            age = float(am.group(1))
        args = {"complaint": text, "age": age}
        if len(vit) >= 2:
            args["vitals"] = vit
        plan.append({"tool": "triage_patient", "args": args, "why": "symptoms described"})
    return plan
