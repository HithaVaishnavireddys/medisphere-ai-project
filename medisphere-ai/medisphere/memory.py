"""Day 4 - conversation memory: rolling turns + extracted patient profile."""
from __future__ import annotations

import re
from collections import defaultdict, deque

from .config import load_json

CONDITIONS = ["diabetes", "hypertension", "asthma", "copd", "heart failure", "kidney disease", "pregnan", "epilepsy", "thyroid", "cancer"]


def drugs_in(text: str) -> list[str]:
    t = text.lower()
    found = []
    for canonical, aliases in load_json("drug_interactions.json")["drugs"].items():
        if any(re.search(r"\b" + re.escape(a) + r"\b", t) for a in aliases):
            found.append(canonical)
    return found


def extract_profile(text: str) -> dict:
    t = text.lower()
    prof: dict = {}
    m = re.search(r"(\d{1,3})[- ]?(?:year|yr|y)s?[- ]?old|age[d:]?\s*(\d{1,3})|\b(\d{1,3})\s?(?:yo|y/o)\b", t)
    if m:
        age = int([g for g in m.groups() if g][0])
        if 0 < age < 120:
            prof["age"] = age
    mm = re.search(r"(\d{1,2})[- ]?(?:month|mo)s?[- ]?old", t)
    if mm:
        prof["age"] = round(int(mm.group(1)) / 12, 2)
    if re.search(r"\b(male|man|boy|father|husband|son|he|him)\b", t):
        prof["sex"] = "male"
    if re.search(r"\b(female|woman|girl|mother|wife|daughter|she|her|pregnan)", t):
        prof["sex"] = "female"
    al = re.findall(r"allerg(?:ic|y) to ([a-z ]{3,25}?)(?:[.,;]| and |$)", t)
    if al:
        prof["allergies"] = [a.strip() for a in al]
    conds = [c for c in CONDITIONS if c in t]
    if conds:
        prof["conditions"] = conds
    d = drugs_in(t)
    if d:
        prof["medications"] = d
    return prof


class SessionMemory:
    def __init__(self, max_turns: int = 6):
        self.turns = defaultdict(lambda: deque(maxlen=max_turns * 2))
        self.profile: dict[str, dict] = defaultdict(dict)

    def remember(self, sid: str, role: str, text: str):
        self.turns[sid].append({"role": role, "text": text})
        if role == "user":
            for k, v in extract_profile(text).items():
                if isinstance(v, list):
                    merged = list(dict.fromkeys(self.profile[sid].get(k, []) + v))
                    self.profile[sid][k] = merged
                else:
                    self.profile[sid][k] = v

    def history(self, sid: str) -> list[dict]:
        return list(self.turns[sid])

    def context(self, sid: str) -> str:
        p = self.profile.get(sid, {})
        return "; ".join(f"{k}: {', '.join(v) if isinstance(v, list) else v}" for k, v in p.items())

    _FOLLOW = re.compile(r"^(and|also|then|what about|how about|what else|why|how long|is it|are they|does it|can it|is that|what if)\b", re.I)

    def is_followup(self, sid: str, question: str) -> bool:
        return bool([t for t in self.turns[sid] if t["role"] == "user"]) and len(question.split()) <= 6 and bool(self._FOLLOW.match(question.strip()) or len(question.split()) <= 3)

    def contextualise(self, sid: str, question: str) -> str:
        """Follow-ups ('what about children?') inherit the previous user topic."""
        prev = [t["text"] for t in self.turns[sid] if t["role"] == "user"]
        return (prev[-1] + " " + question) if prev else question

    def reset(self, sid: str):
        self.turns.pop(sid, None)
        self.profile.pop(sid, None)
