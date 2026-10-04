"""Day 4 - structured outputs: AI triage with NEWS2 vital-sign scoring.

Input and output are pydantic models, so every response is validated JSON (the same
schema is given to a live LLM as the structured-output contract).
"""
from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field

from .config import rules
from .memory import extract_profile


class Vitals(BaseModel):
    resp_rate: Optional[float] = Field(None, ge=0, le=80)
    spo2: Optional[float] = Field(None, ge=0, le=100)
    on_oxygen: bool = False
    sbp: Optional[float] = Field(None, ge=0, le=300)
    pulse: Optional[float] = Field(None, ge=0, le=300)
    temp: Optional[float] = Field(None, ge=25, le=45)
    alert: bool = True


class TriageRequest(BaseModel):
    complaint: str = Field(..., min_length=3, max_length=2000)
    age: Optional[float] = Field(None, ge=0, le=120)
    sex: Optional[str] = None
    vitals: Optional[Vitals] = None


class SymptomHit(BaseModel):
    id: str
    label: str
    weight: int
    red_flag: bool


class TriageResult(BaseModel):
    level: int = Field(..., ge=1, le=5)
    level_name: str
    color: str
    target_time: str
    disposition: str
    department: str
    escalate: bool
    news2: Optional[int] = None
    news2_breakdown: dict = {}
    symptoms: list[SymptomHit]
    reasons: list[str]
    recommended_actions: list[str]
    confidence: float


def news2_score(v: Vitals) -> tuple[int, dict]:
    bands = rules()["news2"]
    detail, total = {}, 0

    def band(name, val):
        for lo, hi, sc in bands[name]:
            if lo <= val < hi:
                return sc
        return 0

    for key in ("resp_rate", "spo2", "sbp", "pulse", "temp"):
        val = getattr(v, key)
        if val is None:
            continue
        val = round(val, 1) if key == "temp" else val
        sc = band(key, val)
        detail[key] = {"value": val, "score": sc}
        total += sc
    if v.on_oxygen:
        detail["oxygen"] = {"value": "supplemental O2", "score": 2}
        total += 2
    if not v.alert:
        detail["consciousness"] = {"value": "new confusion / V / P / U", "score": 3}
        total += 3
    return total, detail


def detect_symptoms(text: str) -> list[dict]:
    t = text.lower()
    hits = []
    for s in rules()["symptoms"]:
        if any(re.search(p, t) for p in s["patterns"]):
            hits.append(s)
    return hits


ACTIONS = {
    1: ["Activate emergency response team and move to resuscitation bay", "Continuous monitoring, IV access, 12-lead ECG / bedside glucose as indicated", "Senior clinician at bedside immediately"],
    2: ["Fast-track to a monitored emergency bed", "Repeat full vital signs every 15 minutes", "Senior review within 15 minutes; ECG / labs per presenting problem"],
    3: ["Assign urgent assessment slot (within 60 minutes)", "Repeat vitals every 30-60 minutes while waiting", "Escalate immediately if symptoms worsen"],
    4: ["Register for same-day outpatient review", "Provide self-care and return precautions", "Re-triage if new red-flag symptoms appear"],
    5: ["Offer teleconsultation or routine appointment", "Share self-care guidance and warning signs", "Advise to return if symptoms persist beyond 48-72 hours"],
}


def triage(req: TriageRequest) -> TriageResult:
    prof = extract_profile(req.complaint)
    age = req.age if req.age is not None else prof.get("age")
    hits = detect_symptoms(req.complaint)
    ids = {h["id"] for h in hits}
    reasons: list[str] = []
    level = 5

    total_w = sum(h["weight"] for h in hits)
    if total_w >= 6:
        level = min(level, 3)
    elif total_w >= 2:
        level = min(level, 4)
    for h in hits:
        if h["red_flag"]:
            level = min(level, h["level_floor"])
            reasons.append(f"Red flag: {h['label']}")
    for c in rules()["combos"]:
        if all(x in ids for x in c["all"]):
            level = min(level, c["level"])
            reasons.append(c["reason"])

    n2, detail = (None, {})
    if req.vitals is not None and any(v is not None for k, v in req.vitals.model_dump().items() if k not in ("on_oxygen", "alert")):
        n2, detail = news2_score(req.vitals)
        if n2 >= 7:
            level = min(level, 1); reasons.append(f"NEWS2 {n2} (high clinical risk)")
        elif n2 >= 5 or any(d["score"] == 3 for d in detail.values()):
            level = min(level, 2); reasons.append(f"NEWS2 {n2} (urgent clinician review)")
        elif n2 >= 1:
            reasons.append(f"NEWS2 {n2} (low risk)")
        v = req.vitals
        if v.temp and v.temp >= 38.0 and age is not None and age < 0.25:
            level = min(level, 2); reasons.append("Fever in an infant under 3 months")
    if age is not None and age < 0.25 and "fever" in ids:
        level = min(level, 2); reasons.append("Fever in an infant under 3 months")
    if age is not None and age >= 65 and level >= 4 and len(hits) >= 2:
        level = 3; reasons.append("Age 65+ with multiple symptoms: upgraded one level")
    if not hits and n2 is None:
        reasons.append("No recognised symptoms: general advice only")

    lv = rules()["levels"][str(level)]
    top = max(hits, key=lambda h: (h["weight"], h["red_flag"]), default=None)
    dept = top["department"] if top else "General Medicine"
    if level <= 2 and dept not in ("Psychiatry", "Obstetrics & Gynaecology"):
        dept = "Emergency Medicine"
    conf = min(0.95, 0.45 + 0.1 * len(hits) + (0.15 if n2 is not None else 0) + (0.1 if reasons and level <= 2 else 0))
    if not hits and n2 is None:
        conf = 0.3
    return TriageResult(
        level=level, level_name=lv["name"], color=lv["color"], target_time=lv["target"], disposition=lv["disposition"],
        department=dept, escalate=level <= 2, news2=n2, news2_breakdown=detail,
        symptoms=[SymptomHit(id=h["id"], label=h["label"], weight=h["weight"], red_flag=h["red_flag"]) for h in hits],
        reasons=list(dict.fromkeys(reasons)), recommended_actions=ACTIONS[level], confidence=round(conf, 2),
    )
