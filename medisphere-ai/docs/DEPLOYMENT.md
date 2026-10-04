# Deployment and governance checklist

## What is implemented
- Authentication, role-based authorisation, per-site data scoping, lockout (5 failures / 15 min), rate limiting, hash-chained audit trail, security headers, PII masking before any AI call, patient documents analysed in memory only, shared conversation memory isolated per user.
- FHIR R4 export for interoperability with an EHR / health information exchange.
- Optional field-level encryption (phone, date of birth) via `MEDISPHERE_FIELD_KEY`.

## Required before a real hospital pilot
1. **Clinical safety and validation.** Have clinicians review every knowledge-base entry, the triage rules and the drug-interaction table; validate triage against your own historical cases; keep a human in the loop. Decide with your regulator whether the triage function counts as a medical device (e.g. software as a medical device) in each country.
2. **Identity.** Replace local passwords with SSO (OIDC/SAML) and add multi-factor authentication. Remove the demo accounts.
3. **Transport and secrets.** Run behind an HTTPS reverse proxy; set `MEDISPHERE_SECRET` and `MEDISPHERE_FIELD_KEY` from a secrets manager; disable `/docs`.
4. **Database.** SQLite is for the pilot and demos. Move to PostgreSQL with encryption at rest, backups, point-in-time recovery and per-region deployments (the schema is plain SQL). Run multiple workers only after the in-memory rate limiter and index are moved to shared stores (Redis, a vector DB).
5. **Data residency and privacy.** Keep each country's data in-region. Frameworks to review with counsel: India DPDP Act 2023 and ABDM; UAE PDPL and Federal Law 2/2019 on ICT in health; UK GDPR and NHS DSPT; Singapore PDPA; HIPAA where US patients are served. Complete a data-protection impact assessment and sign processor agreements with any external LLM vendor. Without an external key the system runs fully offline.
6. **Monitoring.** Ship logs and the audit trail to a SIEM; alert on repeated `denied` / `forbidden` entries; run `/api/audit/verify` on a schedule and archive the head hash externally.
7. **Language.** The interface is translated; clinical knowledge-base text is English until clinically reviewed translations are added.
8. **Live LLM mode** (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) is implemented but was not exercised in the capstone environment; test it with your own keys and review prompts for your data policy.
