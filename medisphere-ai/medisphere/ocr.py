"""Day 5 - multimodal: OCR of lab reports / prescriptions + structured parsing + flagging."""
from __future__ import annotations

import io
import re

from .config import load_json, rules
from .memory import drugs_in


def ocr_available() -> bool:
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
        import shutil
        return shutil.which("tesseract") is not None
    except Exception:
        return False


def extract_text(image_bytes: bytes) -> str:
    if not ocr_available():
        raise RuntimeError("OCR engine (tesseract) is not installed on this server; paste the report text instead.")
    import pytesseract
    from PIL import Image, ImageOps
    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    if img.width < 1400:  # upscale small scans for accuracy
        f = 1400 / img.width
        img = img.resize((int(img.width * f), int(img.height * f)))
    img = ImageOps.autocontrast(img)
    return pytesseract.image_to_string(img, config="--psm 6")


def parse_labs(text: str, sex: str | None = None) -> list[dict]:
    rows = []
    for lab in rules()["labs"]:
        names = sorted(lab["aliases"], key=len, reverse=True)
        pat = r"(?<![a-z])(?:" + "|".join(re.escape(a) for a in names) + r")(?![a-z])[^0-9\n]{0,25}?(\d+(?:\.\d+)?)"
        m = re.search(pat, text, re.I)
        if not m:
            continue
        val = float(m.group(1))
        lo, hi = lab["low"], lab["high"]
        if sex == "male" and "low_m" in lab:
            lo, hi = lab["low_m"], lab["high_m"]
        flag = "Low" if val < lo else "High" if val > hi else "Normal"
        rows.append({"test": lab["name"], "value": val, "unit": lab["unit"], "range": f"{lo:g} - {hi:g}" if hi < 900 else f">= {lo:g}",
                     "flag": flag, "kb": lab["kb"]})
    return rows


def analyse(text: str, sex: str | None = None) -> dict:
    sx = sex
    if not sx:
        if re.search(r"\b(sex|gender)\W{0,3}(m|male)\b", text, re.I):
            sx = "male"
        elif re.search(r"\b(sex|gender)\W{0,3}(f|female)\b", text, re.I):
            sx = "female"
    labs = parse_labs(text, sx)
    meds = drugs_in(text)
    from .tools import check_drug_interactions
    inter = check_drug_interactions(meds) if len(meds) >= 2 else {"interactions": [], "count": 0, "worst": None}
    kbmap = {d["id"]: d["title"] for d in load_json("knowledge_base.json")}
    abn = [r for r in labs if r["flag"] != "Normal"]
    insights = []
    for r in abn:
        insights.append(f"{r['test']} is {r['flag'].lower()} ({r['value']:g} {r['unit']}, reference {r['range']}). See: {kbmap[r['kb']]}.")
    return {"text": text, "sex_used": sx, "labs": labs, "abnormal_count": len(abn), "medications": meds,
            "interactions": inter["interactions"], "insights": insights,
            "summary": (f"{len(labs)} lab value(s) extracted, {len(abn)} outside the reference range; {len(meds)} medicine(s) recognised, "
                        f"{inter['count']} interaction(s)."), "needs_review": True}


def make_sample_report(path: str):
    """Render a synthetic lab report image (used for tests and demos)."""
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (1200, 900), "white")
    d = ImageDraw.Draw(img)
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
        fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 38)
    except Exception:
        f = fb = ImageFont.load_default()
    d.text((60, 40), "MediSphere Diagnostics - Pathology Report", font=fb, fill="black")
    d.text((60, 110), "Patient: SAMPLE PATIENT   Age: 52   Sex: Male", font=f, fill="black")
    rows = ["Haemoglobin 11.2 g/dL", "WBC 12.4 x10^9/L", "Platelets 138 x10^9/L", "Fasting Blood Sugar 142 mg/dL",
            "HbA1c 7.1 %", "Creatinine 1.0 mg/dL", "LDL 131 mg/dL", "Potassium 4.2 mmol/L", "TSH 2.1 mIU/L"]
    y = 190
    for r in rows:
        d.text((80, y), r, font=f, fill="black"); y += 56
    d.text((60, y + 20), "Rx: Metformin, Atorvastatin, Aspirin", font=f, fill="black")
    img.save(path)
