"""Day 6 - AI workflow automation: intake -> PII masking -> triage -> routing -> registration -> scheduling
-> notification drafts -> EHR note draft -> audit. Registration and appointments are persisted; messages are
drafted for staff review and are never sent automatically."""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from . import audit, store
from .guardrails import redact_pii
from .memory import extract_profile
from .triage import TriageRequest, Vitals, triage

_SLOTS = {1: 0, 2: 15, 3: 60, 4: 120, 5: 24 * 60}


def run_intake(body: dict, site_id: str, user: dict | None = None, ip: str = "") -> dict:
    steps: list[dict] = []
    ctx: dict = {}

    def step(name, fn):
        t0 = time.time()
        try:
            detail = fn()
            steps.append({"step": name, "status": "done", "ms": max(1, int((time.time() - t0) * 1000)), "detail": detail})
        except Exception as e:  # keep the pipeline observable instead of crashing
            steps.append({"step": name, "status": "failed", "ms": 0, "detail": str(e)})
            raise

    def validate():
        if not body.get("complaint"):
            raise ValueError("missing field: complaint")
        if not body.get("patient_id") and not body.get("name"):
            raise ValueError("missing field: name (or select an existing patient)")
        if body.get("patient_id"):
            ctx["patient"] = store.get_patient(body["patient_id"], site_id)
            return f"Existing patient {ctx['patient']['mrn']} selected"
        return "New patient record will be created"

    def minimise():
        clean, found = redact_pii(body["complaint"])
        ctx["complaint_raw"], ctx["complaint"] = body["complaint"], clean
        return f"{len(found)} identifier(s) masked before AI processing"

    def do_triage():
        v = body.get("vitals")
        age = body.get("age") or (ctx.get("patient") or {}).get("age") or extract_profile(ctx["complaint"]).get("age")
        ctx["age"] = age
        ctx["tri"] = triage(TriageRequest(complaint=ctx["complaint"], age=age, vitals=Vitals(**v) if v else None))
        t = ctx["tri"]
        return f"Level {t.level} ({t.level_name}); NEWS2 {t.news2 if t.news2 is not None else 'n/a'}; confidence {t.confidence}"

    def route():
        t = ctx["tri"]
        return f"Routed to {t.department}; disposition: {t.disposition}"

    def register():
        if "patient" not in ctx:
            ctx["patient"] = store.create_patient(site_id, {"name": body["name"], "age": ctx["age"], "sex": body.get("sex"), "phone": body.get("phone"),
                                                           "dob": body.get("dob"), "language": body.get("language")}, (user or {}).get("id"))
        ctx["enc"] = store.create_encounter(site_id, ctx["patient"]["id"], ctx["complaint"], ctx["tri"].model_dump(), body.get("vitals"), (user or {}).get("id"))
        return f"Patient {ctx['patient']['mrn']} and encounter {ctx['enc']['id']} saved"

    def schedule():
        t = ctx["tri"]
        when = datetime.now(timezone.utc) + timedelta(minutes=_SLOTS[t.level])
        ctx["slot"] = when
        store.create_appointment(site_id, ctx["patient"]["id"], ctx["enc"]["id"], t.department, when.isoformat(timespec="minutes"))
        return "Slot reserved: " + ("Immediate" if t.level == 1 else when.strftime("%d %b %Y, %H:%M UTC"))

    def notify():
        t = ctx["tri"]
        ctx["messages"] = {
            "patient_sms": f"MediSphere: your visit is registered ({ctx['patient']['mrn']}). Please report to {t.department}. Target time: {t.target_time}.",
            "clinician_alert": f"[{'ESCALATE' if t.escalate else 'ROUTINE'}] {ctx['patient']['mrn']} - L{t.level} {t.level_name} - {'; '.join(t.reasons) or 'no red flags'}"}
        return "Drafted patient SMS and clinician alert (not sent: staff must review)"

    def note():
        t = ctx["tri"]
        ctx["note"] = (f"S: {ctx['complaint']}\nO: NEWS2 {t.news2 if t.news2 is not None else 'not recorded'}; symptoms: "
                       f"{', '.join(s.label for s in t.symptoms) or 'none recognised'}\nA: Triage level {t.level} - {t.level_name}. {'; '.join(t.reasons)}\nP: {'; '.join(t.recommended_actions)}")
        return "SOAP-style EHR note drafted for clinician review"

    def audit_step():
        audit.log(user, "workflow.intake", f"encounter:{ctx['enc']['id']}", "ok", site_id, ip)
        return f"Audit entry written (hash-chained) for encounter {ctx['enc']['id']}"

    try:
        for n, f in (("1. Validate record", validate), ("2. Data minimisation (PII masking)", minimise), ("3. AI triage", do_triage), ("4. Department routing", route),
                     ("5. Register patient and encounter", register), ("6. Slot scheduling", schedule), ("7. Notifications", notify), ("8. EHR note draft", note),
                     ("9. Audit trail", audit_step)):
            step(n, f)
    except Exception:
        return {"ok": False, "steps": steps}
    return {"ok": True, "patient_id": ctx["patient"]["id"], "mrn": ctx["patient"]["mrn"], "encounter_id": ctx["enc"]["id"], "triage": ctx["tri"].model_dump(),
            "slot": ctx["slot"].isoformat(timespec="minutes"), "messages": ctx["messages"], "ehr_note": ctx["note"], "steps": steps, "total_ms": sum(s["ms"] for s in steps)}
