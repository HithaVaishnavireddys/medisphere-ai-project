"""Shared tokenisation helpers (Day 2/7): lowercase, stop-word removal, light stemming."""
import re
from .config import rules

_WORD = re.compile(r"[a-z0-9][a-z0-9\-\+\.]*[a-z0-9]|[a-z0-9]")


def stem(w: str) -> str:
    # Normalise British/American spellings so "anaemia"/"anemia" and "haemoglobin"/"hemoglobin" match.
    w = w.replace("ae", "e").replace("oe", "e")
    for suf in ("ations", "ation", "ings", "ing", "edly", "ed", "ies", "es", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def tokens(text: str, keep_stop: bool = False) -> list[str]:
    stop = set(rules()["stopwords"])
    out = []
    for m in _WORD.findall(text.lower()):
        m = m.strip(".-")
        if not m:
            continue
        if not keep_stop and m in stop:
            continue
        out.append(stem(m))
    return out


def sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text.strip())
    return [p.strip() for p in parts if p.strip()]
