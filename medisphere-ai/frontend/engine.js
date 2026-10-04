/* MediSphere AI - client engine.
 * Mode "api"  : talks to the FastAPI / server_lite backend (/api/*).
 * Mode "local": runs the same rules + knowledge base in the browser (used by the static demo).
 * Data (knowledge base, rules, drug table, dashboard numbers) is produced by the Python project
 * and injected as window.__MS by scripts/build_static.py.
 */
(function (root) {
  "use strict";
  const DISCLAIMER = "Educational decision-support demo. Not a medical device and not a substitute for professional judgement. In an emergency call 112 (India) / 911 (US).";
  const SELF_HARM = "I'm really sorry you're going through this. You deserve support right now. Please contact someone who can help immediately: in India call Tele-MANAS 14416 or emergency services on 112; in the US call or text 988. If you are in immediate danger, call your local emergency number or go to the nearest emergency department, and try not to be alone.";
  const ABSTAIN = "I could not find reliable information about that in the hospital knowledge base, so I will not guess. Try rephrasing, or ask a clinician / pharmacist.";
  const THRESH = 0.36; // calibrated for the browser engine (TF-IDF vectors only; Python adds LSA embeddings, threshold 0.40)

  function create(MS) {
    const R = MS.rules, STOP = new Set(R.stopwords);
    /* ---------- text utils ---------- */
    const stem = (w) => {
      w = w.replace(/ae/g, "e").replace(/oe/g, "e");
      for (const suf of ["ations", "ation", "ings", "ing", "edly", "ed", "ies", "es", "s"]) {
        if (w.length > suf.length + 3 && w.endsWith(suf)) return w.slice(0, -suf.length) + (suf === "ies" ? "y" : "");
      }
      return w;
    };
    const tokens = (text) => {
      const out = [];
      for (let m of (text.toLowerCase().match(/[a-z0-9][a-z0-9\-+.]*[a-z0-9]|[a-z0-9]/g) || [])) {
        m = m.replace(/^[.\-]+|[.\-]+$/g, "");
        if (!m || STOP.has(m)) continue;
        out.push(stem(m));
      }
      return out;
    };
    const sentences = (t) => t.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    /* ---------- retriever (BM25 + TF-IDF vectors) ---------- */
    class Retriever {
      constructor(docs) { this.chunks = []; docs.forEach((d) => this.chunks.push({ ...d, doc_id: d.id })); this.fit(); }
      add(id, title, text, category = "Uploaded document", source = "Uploaded") {
        const sents = sentences(text.replace(/\s+/g, " ")), out = []; let cur = [], n = 0;
        for (const s of sents.length ? sents : [text]) {
          const w = s.split(/\s+/).length;
          if (cur.length && n + w > 90) { out.push(cur.join(" ")); cur = []; n = 0; }
          cur.push(s); n += w;
        }
        if (cur.length) out.push(cur.join(" "));
        out.forEach((c, i) => this.chunks.push({ id: `${id}#${i + 1}`, doc_id: id, title, category, source, text: c }));
        this.fit(); return out.length;
      }
      fit() {
        const C = this.chunks; this.N = C.length;
        C.forEach((c) => { c.toks = tokens(`${c.title}. ${c.title}. ${c.text}`); });
        this.avgdl = C.reduce((a, c) => a + c.toks.length, 0) / Math.max(this.N, 1);
        const df = {}; C.forEach((c) => new Set(c.toks).forEach((t) => (df[t] = (df[t] || 0) + 1)));
        this.idf = {}; for (const t in df) this.idf[t] = Math.log(1 + (this.N - df[t] + 0.5) / (df[t] + 0.5));
        this.tf = C.map((c) => { const m = {}; c.toks.forEach((t) => (m[t] = (m[t] || 0) + 1)); return m; });
        const grams = (toks) => { const g = toks.slice(); for (let i = 0; i < toks.length - 1; i++) g.push(toks[i] + " " + toks[i + 1]); return g; };
        this.grams = grams;
        const gdf = {}; const gc = C.map((c) => { const m = {}; grams(c.toks).forEach((t) => (m[t] = (m[t] || 0) + 1)); return m; });
        gc.forEach((m) => Object.keys(m).forEach((t) => (gdf[t] = (gdf[t] || 0) + 1)));
        this.gidf = {}; for (const t in gdf) this.gidf[t] = Math.log((1 + this.N) / (1 + gdf[t])) + 1;
        this.vecs = gc.map((m) => this.vectorise(m));
      }
      vectorise(counts) {
        const v = {}; let n = 0;
        for (const t in counts) { const idf = this.gidf[t]; if (idf === undefined) continue; const w = (1 + Math.log(counts[t])) * idf; v[t] = w; n += w * w; }
        n = Math.sqrt(n) || 1; for (const t in v) v[t] /= n; return v;
      }
      expand(q) {
        const ql = q.toLowerCase(), base = tokens(q); let extra = [];
        for (const key in R.synonyms) if (new RegExp("\\b" + esc(key) + "\\b").test(ql)) R.synonyms[key].forEach((v) => (extra = extra.concat(tokens(v))));
        extra = [...new Set(extra)].filter((t) => !base.includes(t));
        return [base, extra];
      }
      search(query, k = 5, mode = "hybrid") {
        const [base, extra] = this.expand(query);
        if (!base.length && !extra.length) return [];
        const w = {}; base.forEach((t) => (w[t] = 1)); extra.forEach((t) => { if (!(t in w)) w[t] = 0.5; });
        const k1 = 1.5, b = 0.75, N = this.N;
        const bm = this.chunks.map((c, i) => { let s = 0; for (const t in w) { const f = this.tf[i][t] || 0; if (f) s += w[t] * (this.idf[t] || 0) * f * (k1 + 1) / (f + k1 * (1 - b + b * c.toks.length / this.avgdl)); } return s; });
        const sat = bm.map((x) => 1 - Math.exp(-x / 8));
        const qc = {}; this.grams(tokens(query + " " + extra.join(" "))).forEach((t) => (qc[t] = (qc[t] || 0) + 1));
        const qv = this.vectorise(qc);
        const dense = this.vecs.map((v) => { let s = 0; for (const t in qv) if (v[t]) s += qv[t] * v[t]; return Math.min(1, s * 1.4); });
        const unk = Math.log(1 + (N + 0.5) / 0.5), bs = [...new Set(base)];
        const denom = Math.max(bs.reduce((a, t) => a + (this.idf[t] ?? unk), 0), 1e-9);
        const cover = this.chunks.map((c, i) => bs.reduce((a, t) => a + (this.tf[i][t] ? (this.idf[t] ?? unk) : 0), 0) / denom);
        const final = this.chunks.map((c, i) => {
          if (mode === "keyword") return sat[i];
          if (mode === "semantic") return dense[i];
          const tt = new Set(tokens(c.title));
          return 0.5 * sat[i] + 0.3 * dense[i] + 0.2 * cover[i] + (base.some((t) => tt.has(t)) ? 0.05 : 0);
        });
        const qset = new Set([...base, ...extra]);
        return final.map((s, i) => [s, i]).sort((a, b2) => b2[0] - a[0]).slice(0, k).filter(([s]) => s > 0).map(([s, i]) => {
          const c = this.chunks[i];
          return { id: c.id, doc_id: c.doc_id, title: c.title, category: c.category, source: c.source, score: +Math.min(s, 1).toFixed(3),
            bm25: +sat[i].toFixed(3), semantic: +dense[i].toFixed(3), coverage: +cover[i].toFixed(3), text: c.text, snippet: snippet(c.text, qset) };
        });
      }
    }
    function snippet(text, qset, n = 2) {
      const ss = sentences(text).map((s, i) => [tokens(s).filter((t) => qset.has(t)).length, -i, s]);
      ss.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
      return ss.slice(0, n).sort((a, b) => b[1] - a[1]).map((x) => x[2]).join(" ");
    }

    /* ---------- guardrails & memory ---------- */
    const G = R.guard;
    const redact = (text) => {
      const found = []; let out = text;
      for (const kind in G.pii) out = out.replace(new RegExp(G.pii[kind], "gi"), (m) => { found.push({ type: kind, preview: m.slice(0, 2) + "***" }); return `[${kind.toUpperCase()}]`; });
      return [out, found];
    };
    const suicidal = R.symptoms.find((s) => s.id === "suicidal");
    function checkInput(text) {
      const [clean, pii] = redact(text), low = text.toLowerCase();
      return { clean_text: clean, pii, flags: {
        injection: G.injection.some((p) => new RegExp(p, "i").test(text)),
        self_harm: suicidal.patterns.some((p) => new RegExp(p).test(low)),
        dose_request: new RegExp(G.dosing).test(low) && new RegExp(G.personal).test(low),
        pii: pii.length > 0 } };
    }
    const drugsIn = (text) => { const t = text.toLowerCase(), out = []; for (const c in MS.drugs.drugs) if (MS.drugs.drugs[c].some((a) => new RegExp("\\b" + esc(a) + "\\b").test(t))) out.push(c); return out; };
    const COND = ["diabetes", "hypertension", "asthma", "copd", "heart failure", "kidney disease", "pregnan", "epilepsy", "thyroid", "cancer"];
    function profileOf(text) {
      const t = text.toLowerCase(), p = {};
      const m = t.match(/(\d{1,3})[- ]?(?:year|yr|y)s?[- ]?old|age[d:]?\s*(\d{1,3})/);
      if (m) { const a = +(m[1] || m[2]); if (a > 0 && a < 120) p.age = a; }
      if (/\b(male|man|boy|father|husband|son)\b/.test(t)) p.sex = "male";
      if (/\b(female|woman|girl|mother|wife|daughter)\b|pregnan/.test(t)) p.sex = "female";
      const c = COND.filter((x) => t.includes(x)); if (c.length) p.conditions = c;
      const d = drugsIn(t); if (d.length) p.medications = d;
      return p;
    }
    const memory = { turns: {}, profile: {} };
    function remember(sid, role, text) {
      (memory.turns[sid] = memory.turns[sid] || []).push({ role, text }); memory.turns[sid] = memory.turns[sid].slice(-12);
      if (role === "user") { const cur = (memory.profile[sid] = memory.profile[sid] || {}); const p = profileOf(text);
        for (const k in p) cur[k] = Array.isArray(p[k]) ? [...new Set([...(cur[k] || []), ...p[k]])] : p[k]; }
    }
    const ctxString = (sid) => Object.entries(memory.profile[sid] || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ");

    /* ---------- tools ---------- */
    function interactions(drugs) {
      drugs = drugs.map((d) => d.toLowerCase());
      const order = { Contraindicated: 0, Major: 1, Moderate: 2, Minor: 3 };
      const found = MS.drugs.pairs.filter((p) => drugs.includes(p.a) && drugs.includes(p.b)).sort((a, b) => order[a.severity] - order[b.severity]);
      return { drugs, interactions: found, count: found.length, worst: found.length ? found[0].severity : null };
    }
    function news2(v) {
      const detail = {}; let total = 0;
      for (const key of ["resp_rate", "spo2", "sbp", "pulse", "temp"]) {
        let val = v[key]; if (val === null || val === undefined || val === "" || isNaN(val)) continue; val = +val;
        if (key === "temp") val = Math.round(val * 10) / 10;
        let sc = 0; for (const [lo, hi, s] of R.news2[key]) if (lo <= val && val < hi) { sc = s; break; }
        detail[key] = { value: val, score: sc }; total += sc;
      }
      if (v.on_oxygen) { detail.oxygen = { value: "supplemental O2", score: 2 }; total += 2; }
      if (v.alert === false) { detail.consciousness = { value: "new confusion / V / P / U", score: 3 }; total += 3; }
      return [total, detail];
    }
    function parseVitals(text) {
      const t = text.toLowerCase(), v = {};
      let m = t.match(/(?:bp|blood pressure)[^\d]{0,6}(\d{2,3})\s*\/\s*(\d{2,3})/) || t.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\s*mmhg/);
      if (m) v.sbp = +m[1];
      const pats = { spo2: /(?:spo2|sp02|o2 sat\w*|oxygen sat\w*|saturation)[^\d]{0,8}(\d{2,3})/, pulse: /(?:pulse|hr|heart rate)[^\d]{0,8}(\d{2,3})/,
        resp_rate: /(?:rr|resp\w* rate|respiratory rate)[^\d]{0,8}(\d{1,2})/, temp: /(?:temp\w*)[^\d]{0,8}(\d{2}(?:\.\d)?)/ };
      for (const k in pats) { const mm = t.match(pats[k]); if (mm) v[k] = +mm[1]; }
      if (!("temp" in v)) { const mm = t.match(/(\d{2}(?:\.\d)?)\s*(?:°\s*c|c\b|celsius)/); if (mm) v.temp = +mm[1]; }
      return v;
    }

    /* ---------- triage ---------- */
    function triage(req) {
      const text = req.complaint || "", t = text.toLowerCase();
      if (text.trim().length < 3) throw new Error("complaint is required (min 3 characters)");
      const age = req.age !== null && req.age !== undefined && req.age !== "" ? +req.age : profileOf(text).age ?? null;
      const hits = R.symptoms.filter((s) => s.patterns.some((p) => new RegExp(p).test(t)));
      const ids = new Set(hits.map((h) => h.id)), reasons = []; let level = 5;
      const tw = hits.reduce((a, h) => a + h.weight, 0);
      if (tw >= 6) level = Math.min(level, 3); else if (tw >= 2) level = Math.min(level, 4);
      hits.forEach((h) => { if (h.red_flag) { level = Math.min(level, h.level_floor); reasons.push("Red flag: " + h.label); } });
      R.combos.forEach((c) => { if (c.all.every((x) => ids.has(x))) { level = Math.min(level, c.level); reasons.push(c.reason); } });
      let n2 = null, detail = {};
      const v = req.vitals;
      if (v && ["resp_rate", "spo2", "sbp", "pulse", "temp"].some((k) => v[k] !== null && v[k] !== undefined && v[k] !== "")) {
        [n2, detail] = news2(v);
        if (n2 >= 7) { level = 1; reasons.push(`NEWS2 ${n2} (high clinical risk)`); }
        else if (n2 >= 5 || Object.values(detail).some((d) => d.score === 3)) { level = Math.min(level, 2); reasons.push(`NEWS2 ${n2} (urgent clinician review)`); }
        else if (n2 >= 1) reasons.push(`NEWS2 ${n2} (low risk)`);
        if (v.temp >= 38 && age !== null && age < 0.25) { level = Math.min(level, 2); reasons.push("Fever in an infant under 3 months"); }
      }
      if (age !== null && age < 0.25 && ids.has("fever")) { level = Math.min(level, 2); reasons.push("Fever in an infant under 3 months"); }
      if (age !== null && age >= 65 && level >= 4 && hits.length >= 2) { level = 3; reasons.push("Age 65+ with multiple symptoms: upgraded one level"); }
      if (!hits.length && n2 === null) reasons.push("No recognised symptoms: general advice only");
      const lv = R.levels[String(level)];
      let top = null; hits.forEach((h) => { if (!top || h.weight > top.weight || (h.weight === top.weight && h.red_flag && !top.red_flag)) top = h; });
      let dept = top ? top.department : "General Medicine";
      if (level <= 2 && !["Psychiatry", "Obstetrics & Gynaecology"].includes(dept)) dept = "Emergency Medicine";
      let conf = Math.min(0.95, 0.45 + 0.1 * hits.length + (n2 !== null ? 0.15 : 0) + (reasons.length && level <= 2 ? 0.1 : 0));
      if (!hits.length && n2 === null) conf = 0.3;
      return { level, level_name: lv.name, color: lv.color, target_time: lv.target, disposition: lv.disposition, department: dept, escalate: level <= 2,
        news2: n2, news2_breakdown: detail, symptoms: hits.map((h) => ({ id: h.id, label: h.label, weight: h.weight, red_flag: h.red_flag })),
        reasons: [...new Set(reasons)], recommended_actions: ACTIONS[level], confidence: +conf.toFixed(2) };
    }
    const ACTIONS = {
      1: ["Activate emergency response team and move to resuscitation bay", "Continuous monitoring, IV access, 12-lead ECG / bedside glucose as indicated", "Senior clinician at bedside immediately"],
      2: ["Fast-track to a monitored emergency bed", "Repeat full vital signs every 15 minutes", "Senior review within 15 minutes; ECG / labs per presenting problem"],
      3: ["Assign urgent assessment slot (within 60 minutes)", "Repeat vitals every 30-60 minutes while waiting", "Escalate immediately if symptoms worsen"],
      4: ["Register for same-day outpatient review", "Provide self-care and return precautions", "Re-triage if new red-flag symptoms appear"],
      5: ["Offer teleconsultation or routine appointment", "Share self-care guidance and warning signs", "Advise to return if symptoms persist beyond 48-72 hours"] };

    /* ---------- RAG ---------- */
    const retriever = new Retriever(MS.kb);
    function extractive(q, results) {
      const [base, extra] = retriever.expand(q), qs = new Set([...base, ...extra]);
      return results.slice(0, 3).map((r, n) => {
        const ss = sentences(r.text).map((s, i) => [tokens(s).filter((t) => qs.has(t)).length, -i, s]);
        ss.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
        let keep = ss.slice(0, 2).sort((a, b) => b[1] - a[1]).filter((x) => x[0] > 0).map((x) => x[2]);
        if (!keep.length) keep = [sentences(r.text)[0]];
        return `- ${keep.join(" ")} [${n + 1}]`;
      }).join("\n");
    }
    function ask(body) {
      const t0 = performance.now(), sid = body.session_id || "default", question = (body.question || "").trim();
      if (!question) throw new Error("question is required");
      const rep = checkInput(question), f = rep.flags;
      let q = rep.clean_text;
      if (f.injection) q = q.replace(new RegExp(G.injection.join("|"), "gi"), " ");
      const prev = (memory.turns[sid] || []).filter((x) => x.role === "user").map((x) => x.text);
      const words = q.split(/\s+/).length;
      if (prev.length && words <= 6 && (/^(and|also|then|what about|how about|what else|why|how long|is it|are they|does it|can it|is that|what if)\b/i.test(q.trim()) || words <= 3)) q = prev[prev.length - 1] + " " + q;
      remember(sid, "user", rep.pii.length ? rep.clean_text : question);
      const urgent = R.symptoms.some((s) => s.red_flag && s.level_floor <= 2 && s.patterns.some((p) => new RegExp(p).test(rep.clean_text.toLowerCase()))) && !f.self_harm;
      let results = retriever.search(q, 4, body.mode || "hybrid"), grounded = results.length > 0 && results[0].score >= THRESH;
      if (f.self_harm) { results = retriever.search("suicidal thoughts mental health crisis", 2); grounded = true; }
      const sources = grounded && results.length ? results.filter((r) => r.score >= Math.max(0.30, results[0].score * 0.6)) : [];
      let text = grounded ? (f.self_harm ? sources[0].text : extractive(q, sources)) : ABSTAIN;
      const alerts = []; const ds = drugsIn(rep.clean_text);
      if (ds.length >= 2) interactions(ds).interactions.forEach((p) => alerts.push(`Interaction (${p.severity}): ${p.a} + ${p.b} - ${p.effect} ${p.advice}`));
      const banners = [], notes = [];
      if (f.self_harm) { banners.push({ kind: "crisis", text: SELF_HARM }); notes.push("Self-harm language detected: crisis resources prepended."); }
      if (urgent) { banners.push({ kind: "emergency", text: "Possible emergency. Call " + (body.emergency || G.emergency_numbers) + " now. Do not wait for an online answer." }); notes.push("Emergency pattern detected: escalation banner added."); }
      if (f.injection) notes.push("Prompt-injection attempt neutralised; instructions in the user text were ignored.");
      if (f.dose_request) notes.push("Patient-specific dosing is not provided; general information only. Confirm with a pharmacist or prescriber.");
      if (f.pii) notes.push(`${rep.pii.length} personal identifier(s) were masked before processing.`);
      if (!grounded) notes.push("No sufficiently relevant source found; the assistant abstained instead of guessing.");
      remember(sid, "assistant", text.slice(0, 300));
      return { answer: text, banners, guardrail_notes: notes, disclaimer: DISCLAIMER, grounded, interaction_alerts: alerts,
        citations: sources.slice(0, 3).map((r, i) => ({ n: i + 1, id: r.id, title: r.title, category: r.category, source: r.source, score: r.score, snippet: r.snippet })),
        confidence: sources.length ? +sources[0].score.toFixed(2) : 0, provider: grounded ? "browser:extractive" : "guardrail:abstain",
        latency_ms: Math.round(performance.now() - t0), patient_context: ctxString(sid), query_used: q };
    }

    /* ---------- agent ---------- */
    function route(text) {
      const t = text.toLowerCase(), plan = [], drugs = drugsIn(t), vit = parseVitals(t);
      if (drugs.length >= 2) plan.push({ tool: "check_drug_interactions", args: { drugs }, why: `${drugs.length} medicines mentioned` });
      if (Object.keys(vit).length >= 2) plan.push({ tool: "calculate_news2", args: vit, why: "vital signs supplied" });
      const w = t.match(/(\d{2,3})\s*kg/), h = t.match(/(\d{3})\s*cm/);
      if (w && h) plan.push({ tool: "calculate_bmi", args: { weight_kg: +w[1], height_cm: +h[1] }, why: "weight and height supplied" });
      if (R.symptoms.some((s) => s.patterns.some((p) => new RegExp(p).test(t)))) {
        const am = t.match(/(\d{1,3})[- ]?(?:year|yr|y)s?[- ]?old/), args = { complaint: text, age: am ? +am[1] : null };
        if (Object.keys(vit).length >= 2) args.vitals = vit;
        plan.push({ tool: "triage_patient", args, why: "symptoms described" });
      }
      return plan;
    }
    function runAgent(body) {
      const question = (body.question || "").trim(); if (!question) throw new Error("question is required");
      const t0 = performance.now(), trace = [], MAX = 8;
      const log = (agent, action, input, obs) => trace.push({ n: trace.length + 1, agent, action, input, observation: obs, ms: Math.max(1, Math.round(performance.now() - t0)) });
      const rep = checkInput(question), clean = rep.clean_text;
      log("Guardrail agent", "screen_input", "user question", `PII masked: ${rep.pii.length}; injection: ${rep.flags.injection}; self-harm: ${rep.flags.self_harm}`);
      const steps = [{ tool: "search_guidelines", args: { query: clean } }, ...route(clean)].slice(0, MAX - 3);
      log("Planner agent", "make_plan", clean, "Plan: " + steps.map((s) => s.tool).join(" -> ") + " -> safety_review -> synthesize");
      const findings = [], citations = [], structured = {};
      for (const s of steps) {
        if (s.tool === "search_guidelines") {
          let res = retriever.search(s.args.query, 4); const top = res.length ? res[0].score * 0.6 : 0;
          res = res.filter((r) => r.score >= Math.max(0.3, top));
          res.slice(0, 3).forEach((r, i) => { citations.push({ n: i + 1, id: r.id, title: r.title, source: r.source, score: r.score }); findings.push(`${r.snippet} [${i + 1}]`); });
          log("Retrieval agent", "search_guidelines", s.args.query, res.length ? `${res.length} relevant passage(s): ${res.slice(0, 3).map((r) => r.id).join(", ")}` : "no relevant passage found");
        } else if (s.tool === "check_drug_interactions") {
          const o = interactions(s.args.drugs); structured[s.tool] = o;
          o.interactions.forEach((p) => findings.push(`Drug safety (${p.severity}): ${p.a} + ${p.b}: ${p.effect} ${p.advice}`));
          log("Specialist agent", s.tool, s.args, `${o.count} interaction(s); worst: ${o.worst || "none"}`);
        } else if (s.tool === "calculate_news2") {
          const [total, detail] = news2(s.args); const risk = total >= 7 ? "high" : total >= 5 || Object.values(detail).some((d) => d.score === 3) ? "medium" : "low";
          structured[s.tool] = { score: total, risk }; findings.push(`Vital-sign early warning score is ${total} (${risk} risk).`);
          log("Specialist agent", s.tool, s.args, `NEWS2 = ${total} (${risk} risk)`);
        } else if (s.tool === "calculate_bmi") {
          const bmi = s.args.weight_kg / Math.pow(s.args.height_cm / 100, 2), cat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
          findings.push(`BMI ${bmi.toFixed(1)} (${cat}).`); log("Specialist agent", s.tool, s.args, `BMI ${bmi.toFixed(1)} (${cat})`);
        } else if (s.tool === "triage_patient") {
          const o = triage({ complaint: s.args.complaint, age: s.args.age, vitals: s.args.vitals }); structured[s.tool] = o;
          findings.push(`Triage suggests level ${o.level} (${o.level_name}): ${o.disposition}.`);
          log("Specialist agent", s.tool, "free-text complaint + vitals", `Level ${o.level} - ${o.level_name}; department ${o.department}`);
        }
      }
      const safety = [], tri = structured.triage_patient;
      if (tri && tri.escalate) safety.push("Escalate: emergency criteria met. 112 (India) / 911 (US).");
      if (rep.flags.self_harm) safety.push(SELF_HARM);
      if (rep.flags.dose_request) safety.push("Patient-specific dosing is out of scope; confirm with a pharmacist or prescriber.");
      if (!citations.length && !Object.keys(structured).length) safety.push("Evidence is insufficient to answer; agent abstained.");
      log("Safety agent", "safety_review", `${findings.length} finding(s)`, `${safety.length} safety note(s) raised`);
      log("Synthesizer agent", "write_report", `${findings.length} finding(s)`, "report written via browser:extractive");
      return { question: clean, plan: steps.map((s) => s.tool), trace, steps: trace.length, max_steps: MAX, provider: "browser:extractive", total_ms: Math.round(performance.now() - t0),
        report: { summary: findings.length ? "Summary of findings:\n" + findings.map((f) => "- " + f).join("\n") : "No supported findings were retrieved.", findings, safety,
          next_steps: tri ? tri.recommended_actions : ["Review the cited guidance with a clinician before acting."], citations } };
    }

    /* ---------- workflow ---------- */
    const audit = [];
    const SLOT = { 1: 0, 2: 15, 3: 60, 4: 120, 5: 1440 };
    function workflow(p) {
      const steps = []; const add = (step, detail) => steps.push({ step, status: "done", ms: 1 + Math.floor(Math.random() * 6), detail });
      if (!p.name || !p.complaint) return { ok: false, steps: [{ step: "1. Validate record", status: "failed", ms: 0, detail: "missing field: " + (!p.name ? "name" : "complaint") }] };
      let h = 0; for (const c of p.name.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const pid = "PT-" + h.toString(16).toUpperCase().padStart(8, "0").slice(0, 8);
      add("1. Validate record", `Record validated; pseudonymous ID ${pid} generated`);
      const [clean, found] = redact(p.complaint + " " + (p.phone || "")); add("2. Data minimisation (PII masking)", `${found.length} identifier(s) masked before AI processing`);
      const tri = triage({ complaint: found.length ? clean : p.complaint, age: p.age, vitals: p.vitals });
      add("3. AI triage", `Level ${tri.level} (${tri.level_name}); NEWS2 ${tri.news2 ?? "n/a"}; confidence ${tri.confidence}`);
      add("4. Department routing", `Routed to ${tri.department}; disposition: ${tri.disposition}`);
      const when = new Date(Date.now() + SLOT[tri.level] * 60000);
      add("5. Slot scheduling", "Slot reserved: " + (tri.level === 1 ? "Immediate" : when.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })));
      const messages = { patient_sms: `MediSphere: your visit is registered (${pid}). Please report to ${tri.department}. Target time: ${tri.target_time}.`,
        clinician_alert: `[${tri.escalate ? "ESCALATE" : "ROUTINE"}] ${pid} - L${tri.level} ${tri.level_name} - ${tri.reasons.join("; ") || "no red flags"}` };
      add("6. Notifications", "Drafted patient SMS and clinician alert (not sent - demo mode)");
      const note = `S: ${found.length ? clean : p.complaint}\nO: NEWS2 ${tri.news2 ?? "not recorded"}; symptoms: ${tri.symptoms.map((s) => s.label).join(", ") || "none recognised"}\nA: Triage level ${tri.level} - ${tri.level_name}. ${tri.reasons.join("; ")}\nP: ${tri.recommended_actions.join("; ")}`;
      add("7. EHR note draft", "SOAP-style EHR note drafted for clinician review");
      audit.unshift({ ts: new Date().toISOString().slice(0, 19), patient: pid, level: tri.level, dept: tri.department, actor: "workflow-agent" }); audit.length = Math.min(audit.length, 50);
      add("8. Audit log", `Audit entry #${audit.length} written`);
      return { ok: true, patient_id: pid, triage: tri, slot: when.toISOString().slice(0, 16), messages, ehr_note: note, steps, total_ms: steps.reduce((a, s) => a + s.ms, 0) };
    }

    /* ---------- documents ---------- */
    function analyseDoc(body) {
      const text = body.text || ""; if (!text.trim()) throw new Error("provide text or an image");
      let sex = body.sex || null; if (!sex) { if (/\b(sex|gender)\W{0,3}(m|male)\b/i.test(text)) sex = "male"; else if (/\b(sex|gender)\W{0,3}(f|female)\b/i.test(text)) sex = "female"; }
      const labs = [];
      for (const lab of R.labs) {
        const names = [...lab.aliases].sort((a, b) => b.length - a.length).map(esc).join("|");
        const m = text.match(new RegExp("(?<![a-z])(?:" + names + ")(?![a-z])[^0-9\\n]{0,25}?(\\d+(?:\\.\\d+)?)", "i")); if (!m) continue;
        const val = +m[1]; let lo = lab.low, hi = lab.high; if (sex === "male" && lab.low_m !== undefined) { lo = lab.low_m; hi = lab.high_m; }
        labs.push({ test: lab.name, value: val, unit: lab.unit, lo, hi, range: hi < 900 ? `${lo} - ${hi}` : `>= ${lo}`, flag: val < lo ? "Low" : val > hi ? "High" : "Normal", kb: lab.kb });
      }
      const meds = drugsIn(text), inter = meds.length >= 2 ? interactions(meds) : { interactions: [], count: 0 };
      const titles = Object.fromEntries(MS.kb.map((d) => [d.id, d.title])), abn = labs.filter((l) => l.flag !== "Normal");
      return { text, sex_used: sex, labs, abnormal_count: abn.length, medications: meds, interactions: inter.interactions,
        insights: abn.map((l) => `${l.test} is ${l.flag.toLowerCase()} (${l.value} ${l.unit}, reference ${l.range}). See: ${titles[l.kb]}.`),
        summary: `${labs.length} lab value(s) extracted, ${abn.length} outside the reference range; ${meds.length} medicine(s) recognised, ${inter.count} interaction(s).`, needs_review: true };
    }

    /* ---------- playground / search / misc ---------- */
    function playground(body) {
      const q = (body.question || "").trim(); if (!q) throw new Error("question is required");
      const docs = retriever.search(q, 2), ctx = docs.filter((d) => d.score >= 0.3).map((d) => `- ${d.title}: ${d.snippet}`).join("\n");
      const strategies = body.strategies && body.strategies.length ? body.strategies : Object.keys(MS.strategies);
      const off = docs.length && docs[0].score >= 0.3 ? "- " + docs[0].snippet : "No grounded context found.";
      return { question: q, providers: ["offline"], runs: strategies.map((s) => {
        const prompt = `${MS.strategies[s] || MS.strategies.zero_shot}${ctx ? "\n\nCONTEXT:\n" + ctx : ""}\n\nQUESTION: ${q}`;
        return { strategy: s, prompt, response: off, provider: "browser:extractive", latency_ms: 1, tokens_est: prompt.split(/\s+/).length + off.split(/\s+/).length };
      }) };
    }
    function search(body) {
      const q = (body.query || "").trim(); if (!q) throw new Error("query is required");
      const [, extra] = retriever.expand(q), results = {};
      for (const m of ["keyword", "semantic", "hybrid"]) results[m] = retriever.search(q, +body.k || 5, m).map((x) => { const { text, ...r } = x; return r; });
      return { query: q, expansion: extra, results };
    }
    function ingest(body) {
      const text = (body.text || "").trim(); if (text.length < 40) throw new Error("document text is too short");
      const [clean, found] = redact(text), n = retriever.add("upload-" + Math.random().toString(16).slice(2, 8), body.title || "Uploaded document", clean);
      return { title: body.title || "Uploaded document", chunks_added: n, pii_masked: found.length, total_chunks: retriever.chunks.length };
    }
    const toolsList = () => ({ tools: [
      { name: "check_drug_interactions", description: "Check interactions between a list of drugs." },
      { name: "calculate_news2", description: "Compute the NEWS2 early-warning score from vital signs." },
      { name: "calculate_bmi", description: "Compute BMI from weight (kg) and height (cm)." },
      { name: "triage_patient", description: "Assign a 5-level triage category from a free-text complaint." }] });
    const local = {
      "GET /api/health": () => ({ status: "ok", version: "1.0.0", hospital: "MediSphere General Hospital", providers: ["offline"], active_provider: "browser", ocr: false,
        indexed_chunks: retriever.chunks.length, documents: new Set(retriever.chunks.map((c) => c.doc_id)).size }),
      "GET /api/dashboard": () => MS.dashboard, "GET /api/tools": toolsList, "GET /api/audit": () => ({ entries: audit }),
      "POST /api/chat": ask, "POST /api/search": search, "POST /api/triage": triage, "POST /api/agent": runAgent, "POST /api/workflow": workflow,
      "POST /api/document": analyseDoc, "POST /api/ingest": ingest, "POST /api/playground": playground,
      "POST /api/reset": (b) => { delete memory.turns[b.session_id || "default"]; delete memory.profile[b.session_id || "default"]; return { ok: true }; } };
    return { local, retriever, triage, ask, tokens };
  }

  /* ---------- transport ---------- */
  const Engine = {
    mode: "pending", impl: null, demo: null, token: null, siteId: null, onAuthLost: null,
    async init() {
      const MS = root.__MS;
      if (MS) { this.impl = create(MS); if (root.__demoBackend) this.demo = root.__demoBackend(this.impl, MS); }
      if (!root.__MS_FORCE_LOCAL && /^https?:$/.test(location.protocol)) {
        try {
          const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 2500);
          const r = await fetch("/api/health", { signal: ctl.signal }); clearTimeout(to);
          if (r.ok && (r.headers.get("content-type") || "").includes("json")) { this.mode = "api"; return this.mode; }
        } catch (e) { /* fall through to local */ }
      }
      if (!this.impl) throw new Error("No backend reachable and no embedded data. Start the server: uvicorn medisphere.api:app");
      this.mode = "local"; return this.mode;
    },
    async call(method, path, body) {
      try {
        if (this.mode === "api") {
          const headers = { "content-type": "application/json" };
          if (this.token) headers.authorization = "Bearer " + this.token;
          if (this.siteId) headers["x-site-id"] = this.siteId;
          const r = await fetch(path, { method, headers, body: method === "POST" ? JSON.stringify(body || {}) : undefined });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error(j.detail ? (typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)) : "Request failed (" + r.status + ")"), { status: r.status });
          return j;
        }
        await new Promise((r) => setTimeout(r, 120)); // let the UI show its working state
        return this.demo.dispatch(method, path, body);
      } catch (e) {
        if (e.status === 401 && !path.startsWith("/api/auth/login") && this.onAuthLost) this.onAuthLost(e.message);
        throw e;
      }
    },
    async login(username, password) {
      const r = await this.post("/api/auth/login", { username, password });
      this.token = r.token; this.siteId = r.site.id; return r;
    },
    logout() { this.token = null; this.siteId = null; if (this.demo) this.demo.logout(); },
    get: (p) => Engine.call("GET", p), post: (p, b) => Engine.call("POST", p, b),
  };
  root.Engine = Engine; root.__createEngine = create;
  if (typeof module !== "undefined") module.exports = { create };
})(typeof window !== "undefined" ? window : globalThis);
