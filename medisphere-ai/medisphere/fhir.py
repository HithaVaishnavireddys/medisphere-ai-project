"""HL7 FHIR R4 export (Patient, Encounter, Observation) so records can move to the hospital EHR / HIE.
Vital-sign LOINC codes follow the FHIR vital-signs profile. Output is a `collection` Bundle."""
from __future__ import annotations

VITALS = {  # key: (LOINC, display, UCUM unit, unit display)
    "resp_rate": ("9279-1", "Respiratory rate", "/min", "breaths/min"),
    "spo2": ("59408-5", "Oxygen saturation in Arterial blood by Pulse oximetry", "%", "%"),
    "sbp": ("8480-6", "Systolic blood pressure", "mm[Hg]", "mmHg"),
    "pulse": ("8867-4", "Heart rate", "/min", "beats/min"),
    "temp": ("8310-5", "Body temperature", "Cel", "C"),
}
ENC_STATUS = {"waiting": "triaged", "in_treatment": "in-progress", "discharged": "finished"}


def patient_resource(p: dict, site: dict) -> dict:
    r = {"resourceType": "Patient", "id": p["id"], "identifier": [{"system": f"urn:medisphere:mrn:{site['id']}", "value": p["mrn"]}],
         "name": [{"text": p["name"]}], "gender": {"male": "male", "female": "female"}.get((p.get("sex") or "").lower(), "unknown")}
    if p.get("dob"):
        r["birthDate"] = p["dob"]
    if p.get("phone"):
        r["telecom"] = [{"system": "phone", "value": p["phone"]}]
    if p.get("language"):
        r["communication"] = [{"language": {"coding": [{"system": "urn:ietf:bcp:47", "code": p["language"]}]}}]
    return r


def encounter_resource(e: dict) -> dict:
    return {"resourceType": "Encounter", "id": e["id"], "status": ENC_STATUS.get(e["status"], "unknown"),
            "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "EMER", "display": "emergency"},
            "priority": {"text": f"Triage level {e['level']} - {e['level_name']}"}, "subject": {"reference": f"Patient/{e['patient_id']}"},
            "period": {k: v for k, v in (("start", e["arrived_at"]), ("end", e.get("closed_at"))) if v},
            "reasonCode": [{"text": e["complaint"]}], "serviceType": {"text": e["department"]}}


def observations(e: dict) -> list[dict]:
    out = []
    for key, val in (e.get("vitals") or {}).items():
        if key not in VITALS or val in (None, ""):
            continue
        code, disp, ucum, ud = VITALS[key]
        out.append({"resourceType": "Observation", "id": f"{e['id']}-{key}", "status": "final",
                    "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"}]}],
                    "code": {"coding": [{"system": "http://loinc.org", "code": code, "display": disp}], "text": disp},
                    "subject": {"reference": f"Patient/{e['patient_id']}"}, "encounter": {"reference": f"Encounter/{e['id']}"},
                    "effectiveDateTime": e["arrived_at"], "valueQuantity": {"value": val, "unit": ud, "system": "http://unitsofmeasure.org", "code": ucum}})
    if e.get("news2") is not None:
        out.append({"resourceType": "Observation", "id": f"{e['id']}-news2", "status": "final", "code": {"text": "NEWS2 aggregate score"},
                    "subject": {"reference": f"Patient/{e['patient_id']}"}, "encounter": {"reference": f"Encounter/{e['id']}"},
                    "effectiveDateTime": e["arrived_at"], "valueInteger": e["news2"]})
    return out


def bundle(p: dict, site: dict, encounters: list[dict]) -> dict:
    res = [patient_resource(p, site)]
    for e in encounters:
        res.append(encounter_resource(e))
        res += observations(e)
    return {"resourceType": "Bundle", "type": "collection", "entry": [{"fullUrl": f"{r['resourceType']}/{r['id']}", "resource": r} for r in res]}
