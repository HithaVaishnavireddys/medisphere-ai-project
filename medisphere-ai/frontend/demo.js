/* Demo backend for the static build: mirrors the server's sign-in, RBAC, site scoping, queue, patient registry,
 * audit chain and FHIR export in the browser, so the hosted demo behaves like the real application.
 * (The real application enforces all of this on the server; see medisphere/routes.py.) */
(function (root) {
  "use strict";
  root.__demoBackend = function (impl, MS) {
    const L = impl.local, uid = (p) => p + Math.random().toString(16).slice(2, 12);
    const nowIso = () => new Date().toISOString().slice(0, 19) + "+00:00";
    const err = (status, message) => Object.assign(new Error(message), { status });
    const can = (role, perm) => { const p = MS.permissions[role] || []; return p.includes("*") || p.includes(perm); };
    const S = { user: null, siteSel: "HYD", patients: [], enc: [], audit: [], seq: {} };

    /* ---- audit chain (FNV-1a stands in for SHA-256 in the demo) ---- */
    const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0").repeat(8); };
    function log(user, action, resource, outcome = "ok", site) {
      const prev = S.audit.length ? S.audit[S.audit.length - 1].hash : "0".repeat(64);
      const e = { id: S.audit.length + 1, ts: nowIso(), username: user ? user.username : "anonymous", role: user ? user.role : "-", site_id: site || (user && user.site_id) || "-", action, resource, outcome, ip: "browser", prev_hash: prev };
      e.hash = fnv(prev + "|" + [e.ts, e.username, e.role, e.site_id, e.action, e.resource, e.outcome].join("|")); S.audit.push(e);
    }

    /* ---- seed ---- */
    const sites = MS.sites, users = MS.users;
    const SEED = { HYD: [["Ananya Reddy", 34, "female", "fever and cough for three days", { temp: 38.4, pulse: 98 }], ["Mohammed Farooq", 61, "male", "chest pain with sweating, pain going down the left arm", { resp_rate: 22, spo2: 94, sbp: 105, pulse: 112, temp: 37.2 }],
      ["Lakshmi Narayan", 72, "female", "shortness of breath and wheeze", { resp_rate: 26, spo2: 90, sbp: 138, pulse: 108, temp: 37.0 }], ["Rohit Menon", 29, "male", "sore throat and runny nose", null], ["Sana Sheikh", 8, "female", "fever and burning urination", { temp: 38.9, pulse: 118 }],
      ["Venkat Rao", 55, "male", "slurred speech and arm weakness since morning", { sbp: 172, pulse: 88 }], ["Priya Nair", 41, "female", "severe abdominal pain and vomiting", { sbp: 118, pulse: 104, temp: 37.8 }], ["Arjun Das", 47, "male", "fell and hit head, headache", { sbp: 130, pulse: 80 }]],
      DXB: [["Omar Al Mansoori", 52, "male", "chest pain and sweating", { sbp: 100, pulse: 118, spo2: 95 }], ["Fatima Al Zaabi", 38, "female", "headache and dizziness", null], ["Yusuf Rahman", 66, "male", "fever, confused and drowsy", { temp: 39.2, sbp: 96, pulse: 118, resp_rate: 24, spo2: 93 }], ["Elena Petrova", 29, "female", "back pain after lifting", null]],
      LON: [["Oliver Bennett", 44, "male", "palpitations and dizziness", { pulse: 128, sbp: 112 }], ["Amelia Clarke", 71, "female", "fever and cough", { temp: 38.6, spo2: 94, resp_rate: 22 }], ["Jamal Wright", 33, "male", "rash and itching", null]],
      SIN: [["Wei Ling Tan", 58, "female", "burning urination and fever", { temp: 38.3 }], ["Rajesh Pillai", 63, "male", "chest pressure", { sbp: 150, pulse: 96, spo2: 96 }], ["Mei Chen", 26, "female", "sore throat and cough", null]] };
    function addPatient(site, name, age, sex, extra = {}) {
      S.seq[site] = (S.seq[site] || 0) + 1;
      const p = { id: uid("pt_"), mrn: `${site}-${new Date().getFullYear()}-${String(S.seq[site]).padStart(6, "0")}`, name, age, sex, language: extra.language || "en", dob: extra.dob || null, phone: extra.phone || null, site_id: site, created_at: nowIso() };
      S.patients.push(p); return p;
    }
    function addEnc(site, p, complaint, vit, minutesAgo = 0, status = "waiting") {
      const v = vit ? { ...vit, on_oxygen: false, alert: true } : null, t = L["POST /api/triage"]({ complaint, age: p.age, vitals: v });
      const e = { id: uid("en_"), patient_id: p.id, site_id: site, arrived_at: new Date(Date.now() - minutesAgo * 60000).toISOString().slice(0, 19) + "+00:00", complaint, level: t.level, level_name: t.level_name, department: t.department, news2: t.news2, vitals: vit, triage: t, status, started_at: null, closed_at: null };
      S.enc.push(e); return e;
    }
    for (const site in SEED) SEED[site].forEach(([n, a, s, c, v], i) => { const p = addPatient(site, n, a, s); addEnc(site, p, c, v, 8 + i * 11, i === 1 && site === "HYD" ? "in_treatment" : "waiting"); });
    log(null, "system.seed", "demo data", "ok", "HYD");

    /* ---- helpers ---- */
    const site = () => S.user.site_id || S.siteSel;
    const out = (p, full) => ({ id: p.id, mrn: p.mrn, name: p.name, sex: p.sex, age: p.age, language: p.language, site_id: p.site_id, dob: full ? p.dob : null, phone: full ? p.phone : p.phone ? "*".repeat(Math.max(0, p.phone.length - 2)) + p.phone.slice(-2) : null, created_at: p.created_at });
    const queue = () => S.enc.filter((e) => e.site_id === site() && ["waiting", "in_treatment"].includes(e.status)).sort((a, b) => a.level - b.level || a.arrived_at.localeCompare(b.arrived_at))
      .map((e) => { const p = S.patients.find((x) => x.id === e.patient_id); return { id: e.id, patient_id: e.patient_id, arrived_at: e.arrived_at, complaint: e.complaint, level: e.level, level_name: e.level_name, department: e.department, news2: e.news2, status: e.status, started_at: e.started_at, name: p.name, mrn: p.mrn, age: p.age, sex: p.sex, waiting_min: Math.max(0, Math.floor((Date.now() - new Date(e.arrived_at)) / 60000)) }; });
    const VIT = { resp_rate: ["9279-1", "Respiratory rate", "/min", "breaths/min"], spo2: ["59408-5", "Oxygen saturation in Arterial blood by Pulse oximetry", "%", "%"], sbp: ["8480-6", "Systolic blood pressure", "mm[Hg]", "mmHg"], pulse: ["8867-4", "Heart rate", "/min", "beats/min"], temp: ["8310-5", "Body temperature", "Cel", "C"] };
    function fhir(p, encs) {
      const st = { waiting: "triaged", in_treatment: "in-progress", discharged: "finished" }, res = [{ resourceType: "Patient", id: p.id, identifier: [{ system: "urn:medisphere:mrn:" + p.site_id, value: p.mrn }], name: [{ text: p.name }], gender: p.sex === "male" || p.sex === "female" ? p.sex : "unknown", ...(p.dob ? { birthDate: p.dob } : {}) }];
      encs.forEach((e) => {
        res.push({ resourceType: "Encounter", id: e.id, status: st[e.status] || "unknown", class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "EMER", display: "emergency" }, priority: { text: `Triage level ${e.level} - ${e.level_name}` }, subject: { reference: "Patient/" + p.id }, period: { start: e.arrived_at, ...(e.closed_at ? { end: e.closed_at } : {}) }, reasonCode: [{ text: e.complaint }], serviceType: { text: e.department } });
        for (const k in e.vitals || {}) if (VIT[k] && e.vitals[k] !== null) { const [c, d, u, ud] = VIT[k]; res.push({ resourceType: "Observation", id: `${e.id}-${k}`, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: c, display: d }], text: d }, subject: { reference: "Patient/" + p.id }, encounter: { reference: "Encounter/" + e.id }, effectiveDateTime: e.arrived_at, valueQuantity: { value: e.vitals[k], unit: ud, system: "http://unitsofmeasure.org", code: u } }); }
        if (e.news2 !== null && e.news2 !== undefined) res.push({ resourceType: "Observation", id: e.id + "-news2", status: "final", code: { text: "NEWS2 aggregate score" }, subject: { reference: "Patient/" + p.id }, encounter: { reference: "Encounter/" + e.id }, effectiveDateTime: e.arrived_at, valueInteger: e.news2 });
      });
      return { resourceType: "Bundle", type: "collection", entry: res.map((r) => ({ fullUrl: r.resourceType + "/" + r.id, resource: r })) };
    }
    const siteObj = (id) => sites.find((s) => s.id === id);

    /* ---- workflow (persisted in memory) ---- */
    function workflow(b) {
      const steps = [], add = (n, d) => steps.push({ step: n, status: "done", ms: 1 + Math.floor(Math.random() * 6), detail: d });
      if (!b.complaint || (!b.patient_id && !b.name)) return { ok: false, steps: [{ step: "1. Validate record", status: "failed", ms: 0, detail: "missing field: " + (!b.complaint ? "complaint" : "name (or select an existing patient)") }] };
      let p = b.patient_id ? S.patients.find((x) => x.id === b.patient_id && x.site_id === site()) : null;
      if (b.patient_id && !p) throw err(404, "patient not found");
      add("1. Validate record", p ? `Existing patient ${p.mrn} selected` : "New patient record will be created");
      // PII masking uses the same patterns as the server
      let clean = b.complaint, n = 0; for (const k in MS.rules.guard.pii) clean = clean.replace(new RegExp(MS.rules.guard.pii[k], "gi"), () => { n++; return `[${k.toUpperCase()}]`; });
      add("2. Data minimisation (PII masking)", `${n} identifier(s) masked before AI processing`);
      const age = b.age ?? (p && p.age) ?? null, tri = L["POST /api/triage"]({ complaint: clean, age, vitals: b.vitals });
      add("3. AI triage", `Level ${tri.level} (${tri.level_name}); NEWS2 ${tri.news2 ?? "n/a"}; confidence ${tri.confidence}`);
      add("4. Department routing", `Routed to ${tri.department}; disposition: ${tri.disposition}`);
      if (!p) p = addPatient(site(), b.name, age ?? 0, b.sex, { phone: b.phone, dob: b.dob, language: b.language });
      const e = addEnc(site(), p, clean, b.vitals, 0, "waiting"); e.triage = tri;
      add("5. Register patient and encounter", `Patient ${p.mrn} and encounter ${e.id} saved`);
      const when = new Date(Date.now() + ({ 1: 0, 2: 15, 3: 60, 4: 120, 5: 1440 }[tri.level]) * 60000);
      add("6. Slot scheduling", "Slot reserved: " + (tri.level === 1 ? "Immediate" : when.toUTCString().slice(5, 22) + " UTC"));
      const messages = { patient_sms: `MediSphere: your visit is registered (${p.mrn}). Please report to ${tri.department}. Target time: ${tri.target_time}.`, clinician_alert: `[${tri.escalate ? "ESCALATE" : "ROUTINE"}] ${p.mrn} - L${tri.level} ${tri.level_name} - ${tri.reasons.join("; ") || "no red flags"}` };
      add("7. Notifications", "Drafted patient SMS and clinician alert (not sent: staff must review)");
      const note = `S: ${clean}\nO: NEWS2 ${tri.news2 ?? "not recorded"}; symptoms: ${tri.symptoms.map((s) => s.label).join(", ") || "none recognised"}\nA: Triage level ${tri.level} - ${tri.level_name}. ${tri.reasons.join("; ")}\nP: ${tri.recommended_actions.join("; ")}`;
      add("8. EHR note draft", "SOAP-style EHR note drafted for clinician review");
      log(S.user, "workflow.intake", "encounter:" + e.id, "ok", site()); add("9. Audit trail", `Audit entry written (hash-chained) for encounter ${e.id}`);
      return { ok: true, patient_id: p.id, mrn: p.mrn, encounter_id: e.id, triage: tri, slot: when.toISOString().slice(0, 16), messages, ehr_note: note, steps, total_ms: steps.reduce((a, s) => a + s.ms, 0) };
    }

    /* ---- routes ---- */
    const R = [
      ["POST", /^\/api\/auth\/login$/, null, (c) => {
        const u = users.find((x) => x.username === (c.body.username || "").toLowerCase()); if (!u) throw err(401, "invalid username or password");
        S.user = u; S.siteSel = u.site_id || "HYD"; log(u, "auth.login", u.username); return { token: "demo", expires_in: 28800, user: userOut(u), site: siteObj(S.siteSel), sites: u.role === "admin" ? sites : [siteObj(u.site_id)] }; }],
      ["GET", /^\/api\/health$/, null, () => L["GET /api/health"]()],
      ["GET", /^\/api\/auth\/me$/, "", () => ({ user: userOut(S.user), site: siteObj(site()) })],
      ["GET", /^\/api\/system$/, "users.manage", () => ({ ...L["GET /api/health"](), field_encryption: false, ephemeral_secret: false, demo: true })],
      ["GET", /^\/api\/sites$/, "", () => ({ sites: S.user.role === "admin" ? sites : [siteObj(site())] })],
      ["GET", /^\/api\/patients$/, "patients.read", (c) => { const q = (c.query.q || "").toLowerCase(); log(S.user, "patient.search", "", "ok", site()); return { patients: S.patients.filter((p) => p.site_id === site() && (!q || p.name.toLowerCase().includes(q) || p.mrn.toLowerCase().includes(q))).reverse().slice(0, 50).map((p) => out(p, false)) }; }],
      ["POST", /^\/api\/patients$/, "patients.write", (c) => { const b = c.body; if (!b.name || b.name.trim().length < 2) throw err(422, "patient name is required"); if (!b.age && !b.dob) throw err(422, "age or date of birth is required"); const p = addPatient(site(), b.name.trim(), +b.age || 0, b.sex, b); log(S.user, "patient.create", p.id, "ok", site()); return out(p, true); }],
      ["GET", /^\/api\/patients\/(?<pid>[\w-]+)\/fhir$/, "fhir.export", (c) => { const p = S.patients.find((x) => x.id === c.p.pid && x.site_id === site()); if (!p) throw err(404, "patient not found"); log(S.user, "patient.fhir_export", p.id, "ok", site()); return fhir(p, S.enc.filter((e) => e.patient_id === p.id)); }],
      ["GET", /^\/api\/patients\/(?<pid>[\w-]+)$/, "patients.read", (c) => { const p = S.patients.find((x) => x.id === c.p.pid && x.site_id === site()); if (!p) throw err(404, "patient not found"); log(S.user, "patient.read", p.id, "ok", site()); return { patient: out(p, true), encounters: S.enc.filter((e) => e.patient_id === p.id).sort((a, b) => b.arrived_at.localeCompare(a.arrived_at)) }; }],
      ["GET", /^\/api\/queue$/, "queue.view", () => { const q = queue(); return { queue: q, waiting: q.filter((r) => r.status === "waiting").length, in_treatment: q.filter((r) => r.status === "in_treatment").length }; }],
      ["POST", /^\/api\/encounters\/(?<eid>[\w-]+)\/status$/, "encounters.write", (c) => { const e = S.enc.find((x) => x.id === c.p.eid && x.site_id === site()); if (!e) throw err(404, "encounter not found");
        const flow = { waiting: ["in_treatment", "discharged"], in_treatment: ["discharged", "waiting"], discharged: [] }; if (!(flow[e.status] || []).includes(c.body.status)) throw err(422, `cannot move an encounter from ${e.status} to ${c.body.status}`);
        e.status = c.body.status; if (e.status === "in_treatment") e.started_at = nowIso(); if (e.status === "discharged") e.closed_at = nowIso(); log(S.user, "encounter.status", e.id, "ok", site()); return e; }],
      ["POST", /^\/api\/workflow$/, "encounters.write", (c) => workflow(c.body)],
      ["GET", /^\/api\/dashboard$/, "dashboard.view", () => { const d = JSON.parse(JSON.stringify(MS.dashboards[site()])), q = queue(); d.live = { waiting: q.filter((r) => r.status === "waiting").length, in_treatment: q.filter((r) => r.status === "in_treatment").length, critical_waiting: q.filter((r) => r.status === "waiting" && r.level <= 2).length }; return d; }],
      ["GET", /^\/api\/audit$/, "audit.view", (c) => ({ entries: S.audit.slice().reverse().slice(0, +c.query.limit || 60) })],
      ["GET", /^\/api\/audit\/verify$/, "audit.view", () => { let prev = "0".repeat(64); for (const e of S.audit) { if (e.prev_hash !== prev) return { ok: false, entries: S.audit.length, broken_at: e.id }; prev = e.hash; } log(S.user, "audit.verify", "", "ok"); return { ok: true, entries: S.audit.length, broken_at: null, head: prev }; }],
      ["GET", /^\/api\/users$/, "users.manage", () => ({ users: users.map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, site_id: u.site_id, active: 1 })) })],
      ["POST", /^\/api\/users$/, "users.manage", () => { throw err(422, "user creation is disabled in the static demo; use the server edition"); }],
      ["POST", /^\/api\/chat$/, "ai.use", (c) => L["POST /api/chat"]({ ...c.body, emergency: siteObj(site()).emergency_number, session_id: S.user.username + ":" + (c.body.session_id || "default") })],
      ["POST", /^\/api\/reset$/, "ai.use", (c) => L["POST /api/reset"]({ session_id: S.user.username + ":" + (c.body.session_id || "default") })],
      ["POST", /^\/api\/triage$/, "ai.use", (c) => L["POST /api/triage"](c.body)], ["POST", /^\/api\/agent$/, "ai.use", (c) => L["POST /api/agent"](c.body)],
      ["POST", /^\/api\/document$/, "docs.use", (c) => { const r = L["POST /api/document"](c.body); delete r.text; return r; }], ["POST", /^\/api\/playground$/, "ai.use", (c) => L["POST /api/playground"](c.body)],
      ["POST", /^\/api\/search$/, "search.use", (c) => L["POST /api/search"](c.body)], ["GET", /^\/api\/tools$/, "ai.use", () => L["GET /api/tools"]()],
      ["POST", /^\/api\/ingest$/, "kb.manage", (c) => L["POST /api/ingest"](c.body)],
    ];
    const userOut = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, role_label: MS.role_labels[u.role], site_id: u.site_id, permissions: MS.permissions[u.role] });
    return {
      user: () => S.user, logout() { if (S.user) log(S.user, "auth.logout", S.user.username); S.user = null; }, setSite(id) { if (S.user && S.user.role === "admin") S.siteSel = id; },
      dispatch(method, full, body) {
        const [path, qs] = full.split("?"), query = Object.fromEntries(new URLSearchParams(qs || ""));
        for (const [m, rx, perm, h] of R) { const mt = m === method && rx.exec(path); if (!mt) continue;
          if (perm !== null) { if (!S.user) throw err(401, "sign in required"); if (perm && !can(S.user.role, perm)) { log(S.user, path, path, "forbidden"); throw err(403, `your role (${S.user.role}) is not allowed to do this`); } }
          return h({ body: body || {}, query, p: mt.groups || {} }); }
        throw err(404, "not found");
      },
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
