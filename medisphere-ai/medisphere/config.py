"""Day 1 - environment & configuration. Everything is overridable via env vars."""
import json
import os
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DATA_RW = Path(os.getenv("MEDISPHERE_DATA_DIR", str(DATA)))  # writable location (db, cached synthetic history)
FRONTEND = ROOT.parent / "frontend"

HOSPITAL_NAME = os.getenv("HOSPITAL_NAME", "MediSphere General Hospital")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto")  # auto | offline | anthropic | openai
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GROUNDING_THRESHOLD = float(os.getenv("GROUNDING_THRESHOLD", "0.40"))
MAX_AGENT_STEPS = int(os.getenv("MAX_AGENT_STEPS", "8"))

DISCLAIMER = ("Educational decision-support demo. Not a medical device and not a substitute for "
              "professional judgement. In an emergency call 112 (India) / 911 (US).")


@lru_cache(maxsize=None)
def load_json(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def rules() -> dict:
    return load_json("rules.json")
