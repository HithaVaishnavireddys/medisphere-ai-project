"""Day 2 - data handling with pandas: synthetic (de-identified) ED visits + hospital KPIs."""
from __future__ import annotations

from functools import lru_cache

import numpy as np
import pandas as pd

from .config import DATA_RW

DEPTS = ["Emergency Medicine", "Cardiology", "General Medicine", "Pulmonology", "Orthopaedics", "Gastroenterology", "Neurology", "Paediatrics", "Obstetrics & Gynaecology"]
DEPT_P = [0.24, 0.11, 0.18, 0.1, 0.1, 0.08, 0.06, 0.08, 0.05]
DX = {"Emergency Medicine": "Trauma / acute illness", "Cardiology": "Cardiovascular", "General Medicine": "Infection / fever", "Pulmonology": "Respiratory",
      "Orthopaedics": "Musculoskeletal", "Gastroenterology": "Gastrointestinal", "Neurology": "Neurological", "Paediatrics": "Paediatric illness", "Obstetrics & Gynaecology": "Obstetric"}


def generate(n: int = 3000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dept = rng.choice(DEPTS, n, p=DEPT_P)
    hour = np.clip(rng.normal(14, 5.2, n), 0, 23.99).astype(int)
    age = np.clip(rng.gamma(4.2, 11, n), 0, 98).round().astype(int)
    base_sev = {"Emergency Medicine": 2.5, "Cardiology": 2.9, "Neurology": 3.0, "Pulmonology": 3.3}
    sev = np.array([np.clip(rng.normal(base_sev.get(d, 3.9), 0.9) - (a > 70) * 0.5, 1, 5) for d, a in zip(dept, age)]).round().astype(int)
    peak = ((hour >= 10) & (hour <= 20)).astype(int)
    wait = np.clip(rng.gamma(2.2, 14, n) * (0.6 + 0.12 * sev) * (1 + 0.35 * peak) * np.where(sev == 1, 0.1, 1), 0, 480).round().astype(int)
    los = np.clip(rng.gamma(2.0, 1.5, n) * (6 - sev) * 0.9 + (age > 65) * 1.2, 0.3, 30).round(1)
    readm_p = 0.04 + 0.02 * (6 - sev) / 2 + (age > 65) * 0.05 + (np.isin(dept, ["Cardiology", "Pulmonology"])) * 0.04
    readm = (rng.random(n) < readm_p).astype(int)
    date = pd.Timestamp("2026-07-01") + pd.to_timedelta(rng.integers(0, 90, n), unit="D")
    return pd.DataFrame({
        "visit_id": [f"V{100000 + i}" for i in range(n)], "date": date.strftime("%Y-%m-%d"), "arrival_hour": hour,
        "age": age, "sex": rng.choice(["F", "M"], n, p=[0.49, 0.51]), "department": dept, "diagnosis_group": [DX[d] for d in dept],
        "triage_level": sev, "wait_minutes": wait, "length_of_stay_hours": los, "readmitted_30d": readm,
    })


_SEEDS = {"HYD": 42, "DXB": 7, "LON": 21, "SIN": 99}


@lru_cache(maxsize=8)
def load(site_id: str = "HYD") -> pd.DataFrame:
    p = DATA_RW / f"visits_{site_id}.csv"
    if p.exists():
        return pd.read_csv(p)
    df = generate(3000, _SEEDS.get(site_id, 42))
    p.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(p, index=False)
    return df


def live_frame(site_id: str) -> pd.DataFrame:
    """Encounters registered in this system, shaped like the historical frame."""
    from datetime import datetime, timezone
    from . import db
    rows = db.rows("SELECT e.id, e.arrived_at, e.level, e.department, e.started_at, p.age, p.sex FROM encounters e JOIN patients p ON p.id=e.patient_id WHERE e.site_id=?", (site_id,))
    if not rows:
        return pd.DataFrame()
    now = datetime.now(timezone.utc)
    out = []
    for r in rows:
        a = datetime.fromisoformat(r["arrived_at"])
        end = datetime.fromisoformat(r["started_at"]) if r["started_at"] else now
        out.append({"visit_id": r["id"], "date": a.strftime("%Y-%m-%d"), "arrival_hour": a.hour, "age": int(r["age"] or 0), "sex": (r["sex"] or "F")[:1].upper(),
                    "department": r["department"] if r["department"] in DX else "General Medicine", "diagnosis_group": DX.get(r["department"], "Infection / fever"),
                    "triage_level": r["level"], "wait_minutes": max(0, int((end - a).total_seconds() // 60)), "length_of_stay_hours": float("nan"), "readmitted_30d": float("nan")})
    return pd.DataFrame(out)


def dashboard(site_id: str = "HYD", live: bool = True) -> dict:
    df = pd.concat([load(site_id), live_frame(site_id)], ignore_index=True) if live else load(site_id).copy()
    df["date"] = pd.to_datetime(df["date"])
    df["age_band"] = pd.cut(df["age"], [-1, 17, 39, 64, 120], labels=["0-17", "18-39", "40-64", "65+"])
    wk = df.groupby(df["date"].dt.to_period("W").dt.start_time).agg(v=("visit_id", "count"), w=("wait_minutes", "mean")).reset_index()
    dept = df.groupby("department").agg(visits=("visit_id", "count"), avg_wait=("wait_minutes", "mean"), readmit=("readmitted_30d", "mean")).sort_values("visits", ascending=False).reset_index()
    hours = df.groupby("arrival_hour").size().reindex(range(24), fill_value=0)
    tri = df.groupby("triage_level").size().reindex(range(1, 6), fill_value=0)
    under60 = ((df["wait_minutes"] <= 60).mean())
    crit = df[df.triage_level <= 2]
    return {
        "kpis": {
            "visits": int(len(df)), "avg_wait": round(float(df.wait_minutes.mean()), 1), "median_wait": round(float(df.wait_minutes.median()), 1),
            "pct_seen_60": round(float(under60) * 100, 1), "avg_los": round(float(df.length_of_stay_hours.mean()), 1),
            "readmit_rate": round(float(df.readmitted_30d.mean()) * 100, 1), "critical_pct": round(len(crit) / len(df) * 100, 1),
            "p90_wait": round(float(df.wait_minutes.quantile(0.9)), 0),
        },
        "weekly": [{"week": d.strftime("%d %b"), "visits": int(v), "avg_wait": round(float(w), 1)} for d, v, w in zip(wk.iloc[:, 0], wk["v"], wk["w"])],
        "hours": [int(x) for x in hours.values],
        "triage": [int(x) for x in tri.values],
        "departments": [{"name": r.department, "visits": int(r.visits), "avg_wait": round(float(r.avg_wait), 1), "readmit": round(float(r.readmit) * 100, 1)} for r in dept.itertuples()],
        "age_bands": {str(k): int(v) for k, v in df.groupby("age_band", observed=True).size().items()},
        "readmit_by_age": {str(k): round(float(v) * 100, 1) for k, v in df.groupby("age_band", observed=True)["readmitted_30d"].mean().items()},
        "note": "Historical visits are synthetic and de-identified. Encounters registered in this system are added live.",
    }
