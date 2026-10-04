# MediSphere AI

Clinical intelligence platform for a multi-site hospital network. Built as the capstone for the 11-day *AI Application Development* programme (Edvergencex x TTIT).

| Capability | What it does |
|---|---|
| **Clinical Assistant** | RAG over clinical guidelines and hospital SOPs. Hybrid search (BM25 + vectors), inline citations, abstains when evidence is weak. Voice input and read-aloud. |
| **AI Triage** | Free-text complaint + vitals -> validated 5-level triage record with NEWS2 scoring and reasons. |
| **Live Queue** | Emergency board sorted by urgency, with overdue-wait highlighting and Start / Discharge actions. |
| **Patient Registry + FHIR** | Site-scoped patient records; HL7 FHIR R4 bundle export (Patient, Encounter, Observation with LOINC codes). |
| **Patient Intake workflow** | 9 automated steps: validate, mask PII, triage, route, save, schedule, draft notifications, draft EHR note, audit. |
| **Document AI** | OCR of lab reports/prescriptions, reference-range flagging, drug-interaction check. Reports are never stored. |
| **Research Agent** | Planner + retrieval + specialist tools + safety review + synthesiser, bounded loop, full trace. |
| **Security** | Role-based access (5 roles), PBKDF2 passwords, signed expiring tokens, lockout, rate limits, hash-chained audit log, security headers, optional field encryption, per-site data isolation. |
| **Multi-site, multilingual** | Hyderabad, Dubai, London, Singapore with local emergency numbers and regulatory notes. UI in English, Hindi, Arabic (RTL), Spanish. |

## Quick start

```bash
pip install -r requirements.txt
python scripts/make_data.py                 # regenerate data files (already committed)
uvicorn medisphere.api:app --port 8000      # production server  (docs at /docs if MEDISPHERE_DOCS=1)
# or, with the standard library only:
python -m medisphere.server_lite --port 8000
```
On first start the demo accounts (`admin`, `dr.rao`, `nurse.iyer`, `front.khan`, `dr.haddad`, `analyst.lee`) are created and a random password is printed once (or set `MEDISPHERE_SEED_PASSWORD`). Open http://localhost:8000.

Docker: `cp .env.example .env && docker compose up --build`.

Static demo (no server, runs the same rules in the browser): `python scripts/build_static.py` -> `dist/medisphere-demo.html`.

## Roles

| Role | Can |
|---|---|
| admin | everything, all sites, user management, audit log, knowledge-base ingestion |
| doctor | patients, encounters, AI tools, documents, FHIR export, dashboard, queue |
| nurse | patients, encounters, AI tools, documents, dashboard, queue (no FHIR export) |
| receptionist | register patients and encounters, queue (no clinical AI) |
| analyst | dashboard and search only (no patient records) |

## Course map

Day 1 `config.py`, `llm.py` | Day 2 `analytics.py` (pandas) | Day 3 `prompts.py`, Prompt Lab | Day 4 `triage.py`, `tools.py`, `memory.py` | Day 5 `ocr.py`, browser voice | Day 6 `workflow.py` | Day 7 `retrieval.py` | Day 8 `rag.py` | Day 9 `guardrails.py`, hybrid search | Day 10 `agents.py` | Day 11 `api.py`, `Dockerfile`, CI.

## Tests

`pip install -r requirements-dev.txt && pytest -q` (36 tests: retrieval, RAG, guardrails, triage, agent, workflow, OCR, auth, RBAC, site isolation, audit tamper detection, FHIR, lockout, rate limit).

## Honest limitations

See `docs/DEPLOYMENT.md`. This is decision support, not a certified medical device. The triage rules, knowledge base and drug table are educational summaries and need clinical review and local validation before any patient-facing use.
