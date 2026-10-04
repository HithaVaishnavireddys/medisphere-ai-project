/* MediSphere AI - UI. Talks to Engine (api or in-browser). No framework: small views, cached after first render. */
(function () {
  "use strict";
  const t = (k, v) => I18N.t(k, v);
  const ME = { user: null, site: null, sites: [] };
  const can = (perm) => !!ME.user && (ME.user.permissions.includes("*") || ME.user.permissions.includes(perm));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const I = {
    grid: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-5.2A8 8 0 1 1 21 12z"/>',
    heart: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    doc: '<path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8"/>',
    flow: '<path d="M4 4h6v5H4zM14 15h6v5h-6zM7 9v4a2 2 0 0 0 2 2h5"/>',
    agent: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0M12 2v2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    flask: '<path d="M9 2h6M10 2v6L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19l-6-11V2M7 15h10"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    check: '<path d="m5 12 5 5L20 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
    send: '<path d="m22 2-11 11M22 2l-7 20-4-9-9-4z"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 3a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6"/>', shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>', down: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>',
    spk: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  };
  const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
  const toast = (msg) => { const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; $("#toast-host").appendChild(t); setTimeout(() => t.remove(), 3600); };
  const busy = (btn, on, label) => { btn.disabled = on; if (on) { btn.dataset.l = btn.innerHTML; btn.innerHTML = `<span class="spin"></span> ${label || "Working"}`; } else if (btn.dataset.l) btn.innerHTML = btn.dataset.l; };
  const num = (v) => (v === "" || v === null || v === undefined || isNaN(+v) ? null : +v);
  const LV = { 1: "var(--l1)", 2: "var(--l2)", 3: "var(--l3)", 4: "var(--l4)", 5: "var(--l5)" };
  const errBox = (e) => `<div class="err" role="alert">${esc(e.message || e)}</div>`;
  const rich = (text) => {
    const lines = text.split("\n").filter(Boolean), li = lines.filter((l) => l.startsWith("- "));
    const fmt = (s) => esc(s).replace(/\[(\d)\]/g, '<button class="cite" data-n="$1" aria-label="Source $1">$1</button>');
    return li.length ? "<ul>" + li.map((l) => "<li>" + fmt(l.slice(2)) + "</li>").join("") + "</ul>" : "<p>" + fmt(text) + "</p>";
  };

  /* ---------------- chart helpers (SVG, theme tokens) ---------------- */
  function niceMax(m) { const p = Math.pow(10, Math.floor(Math.log10(m || 1))), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function barChart(vals, labels, hi, color = "var(--brand)", label = "") {
    const W = 600, H = 210, L = 34, B = 24, T = 10, max = niceMax(Math.max(...vals)), bw = (W - L) / vals.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
    for (let i = 0; i <= 4; i++) { const y = T + (H - T - B) * (1 - i / 4); s += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round(max * i / 4)}</text>`; }
    vals.forEach((v, i) => { const h = (H - T - B) * v / max, x = L + i * bw + bw * 0.16; s += `<rect x="${x}" y="${H - B - h}" width="${bw * 0.68}" height="${h}" rx="2" fill="${i === hi ? "var(--l2)" : color}"><title>${labels[i]}: ${v}</title></rect>`; if (i % (vals.length > 12 ? 3 : 1) === 0) s += `<text x="${x + bw * 0.34}" y="${H - 7}" text-anchor="middle">${labels[i]}</text>`; });
    return s + "</svg>";
  }
  function lineChart(vals, labels, label = "") {
    const W = 600, H = 190, L = 34, B = 24, T = 14, R = 16, max = niceMax(Math.max(...vals)), step = (W - L - R) / (vals.length - 1 || 1);
    const pts = vals.map((v, i) => [L + i * step, T + (H - T - B) * (1 - v / max)]);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
    for (let i = 0; i <= 4; i++) { const y = T + (H - T - B) * (1 - i / 4); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round(max * i / 4)}</text>`; }
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    s += `<path d="${d} L${pts[pts.length - 1][0]} ${H - B} L${L} ${H - B}Z" fill="var(--brand)" opacity=".12"/><path d="${d}" fill="none" stroke="var(--brand)" stroke-width="2.2" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 4.5 : 2.5}" fill="${i === pts.length - 1 ? "var(--brand)" : "var(--surface)"}" stroke="var(--brand)" stroke-width="1.6"><title>${labels[i]}: ${vals[i]}</title></circle>`; if (i % 2 === 0) s += `<text x="${p[0]}" y="${H - 7}" text-anchor="middle">${labels[i]}</text>`; });
    return s + "</svg>";
  }

  /* ---------------- views ---------------- */
  const V = {};

  V.dashboard = {
    title: "Command Center", icon: "grid", group: "g_overview", perm: "dashboard.view",
    sub: "Hospital-wide throughput, triage mix and readmission risk for the last 90 days (synthetic, de-identified data).",
    html: () => `<div class="live" id="live"></div><div class="kpis" id="kpis"></div><div class="grid g2" style="margin-bottom:16px"><section class="panel"><header><h2>Arrivals by hour of day</h2><span class="small muted">visits, 90 days</span></header><div class="body chart" id="ch-hours"></div></section>
      <section class="panel"><header><h2>Weekly visits</h2><span class="small muted">partial first week</span></header><div class="body chart" id="ch-week"></div></section></div>
      <div class="grid split" style="margin-bottom:16px"><section class="panel"><header><h2>Department load</h2></header><div class="tablewrap"><table id="dept-t"></table></div></section>
      <div class="grid"><section class="panel"><header><h2>Triage mix</h2></header><div class="body" id="tri-mix"></div></section><section class="panel"><header><h2>What needs attention</h2></header><div class="body insights" id="insights"></div></section></div></div>`,
    async init(root) {
      const d = await Engine.get("/api/dashboard"), k = d.kpis;
      const lv = d.live || { waiting: 0, in_treatment: 0, critical_waiting: 0 };
      $("#live", root).innerHTML = `<span class="liveitem"><i class="dot" style="color:var(--ok)"></i>${esc(ME.site.city)} live</span><span class="liveitem"><b class="num">${lv.waiting}</b> ${esc(t("waiting"))}</span><span class="liveitem"><b class="num">${lv.in_treatment}</b> ${esc(t("in_treatment"))}</span><span class="liveitem ${lv.critical_waiting ? "crit" : ""}"><b class="num">${lv.critical_waiting}</b> ${esc(t("critical_waiting"))}</span>`;
      const tile = (v, u, l, d2, cls) => `<div class="panel kpi"><div class="v">${v}<small>${u}</small></div><div class="l">${l}</div><div class="d ${cls || "muted"}">${d2}</div></div>`;
      $("#kpis", root).innerHTML = tile(k.visits.toLocaleString("en-IN"), "", "Visits", "90-day total") + tile(k.avg_wait, "min", "Average wait", `90th percentile ${k.p90_wait} min`) +
        tile(k.pct_seen_60, "%", "Seen within 60 min", k.pct_seen_60 >= 85 ? "On target (85%)" : "Below 85% target", k.pct_seen_60 >= 85 ? "pill ok" : "pill warn") +
        tile(k.critical_pct, "%", "Triage level 1-2", "Resuscitation + emergent") + tile(k.readmit_rate, "%", "30-day readmission", "all departments") + tile(k.avg_los, "h", "Average length of stay", "ED to disposition");
      const pk = d.hours.indexOf(Math.max(...d.hours));
      $("#ch-hours", root).innerHTML = barChart(d.hours, d.hours.map((_, i) => String(i).padStart(2, "0")), pk, "var(--brand)", "Arrivals by hour") + `<div class="legend" style="margin-top:6px"><span><i style="background:var(--l2)"></i>Peak hour ${String(pk).padStart(2, "0")}:00 (${d.hours[pk]} visits)</span></div>`;
      $("#ch-week", root).innerHTML = lineChart(d.weekly.map((w) => w.visits), d.weekly.map((w) => w.week), "Weekly visits");
      const maxv = Math.max(...d.departments.map((x) => x.visits)), avg = k.readmit_rate;
      $("#dept-t", root).innerHTML = `<tr><th>Department</th><th>Visits</th><th style="min-width:120px">Share</th><th>Avg wait</th><th>Readmit</th></tr>` + d.departments.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.visits}</td><td><div class="hbar"><i style="width:${(x.visits / maxv * 100).toFixed(0)}%"></i></div></td><td class="num">${x.avg_wait} min</td><td class="num">${x.readmit > avg * 1.25 ? `<span class="pill warn">${x.readmit}%</span>` : x.readmit + "%"}</td></tr>`).join("");
      const names = ["Immediate", "Emergent", "Urgent", "Less urgent", "Non-urgent"], tot = d.triage.reduce((a, b) => a + b, 0);
      $("#tri-mix", root).innerHTML = `<div class="stack" role="img" aria-label="Triage mix">${d.triage.map((v, i) => `<i style="width:${v / tot * 100}%;background:${LV[i + 1]}" title="${names[i]}: ${v}"></i>`).join("")}</div><div class="legend" style="margin-top:10px">${d.triage.map((v, i) => `<span><i style="background:${LV[i + 1]}"></i>L${i + 1} ${names[i]} <b class="num">${(v / tot * 100).toFixed(1)}%</b></span>`).join("")}</div>`;
      const slow = [...d.departments].sort((a, b) => b.avg_wait - a.avg_wait)[0], rr = [...d.departments].sort((a, b) => b.readmit - a.readmit)[0], oldest = d.readmit_by_age;
      const ins = [["alert", "warn", `Longest wait: ${slow.name}`, `Averages ${slow.avg_wait} min against ${k.avg_wait} min hospital-wide.`],
        ["alert", "crit", `Highest readmission: ${rr.name}`, `${rr.readmit}% of discharges return within 30 days (hospital ${avg}%). Review discharge planning.`],
        ["info", "info", `Staff to the ${String(pk).padStart(2, "0")}:00 peak`, `${d.hours[pk]} arrivals in the busiest hour. Arrivals from 10:00 to 20:00 carry the longest queues.`],
        ["info", "info", "Readmission rises with age", Object.entries(oldest).map(([a, v]) => `${a}: ${v}%`).join("  ·  ")]];
      $("#insights", root).innerHTML = ins.map(([i, c, t, s]) => `<div class="insight"><span style="color:var(--${c === "info" ? "info" : c})">${ic(i)}</span><div><b>${esc(t)}</b><div class="small muted">${esc(s)}</div></div></div>`).join("");
    },
  };

  V.assistant = {
    title: "Clinical Assistant", icon: "chat", group: "g_clinical", perm: "ai.use",
    sub: "Ask about guidelines, medicines or hospital policy. Every answer cites its source, and the assistant declines when the knowledge base cannot support one.",
    html: () => `<div class="grid split-r" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)"><section class="panel chat"><header><h2>Conversation</h2><button class="btn sm" id="tts">${ic("spk", 15)} Read aloud: off</button><button class="btn sm" id="newchat">New chat</button></header>
      <div class="msgs" id="msgs" aria-live="polite"></div><div class="suggest" id="sug"></div>
      <form class="composer" id="chatf"><textarea id="q" rows="1" placeholder="Ask a clinical or hospital question..." aria-label="Question"></textarea><button type="button" class="iconbtn" id="mic" title="Speak your question" aria-label="Speak your question">${ic("mic")}</button><button class="btn primary" id="send">${ic("send", 16)} Send</button></form></section>
      <aside class="grid"><section class="panel"><header><h2>Evidence</h2><span class="pill" id="conf" hidden></span></header><div class="body evid" id="evid"><div class="empty"><b>No answer yet</b>Sources used for each answer appear here.</div></div></section>
      <section class="panel"><header><h2>Safety checks</h2></header><div class="body"><ul class="notes" id="notes"><li class="muted">Checks run on every message: PII masking, prompt-injection filter, emergency and crisis routing, grounding.</li></ul><div class="small muted" id="ctx" style="margin-top:10px"></div></div></section></aside></div>`,
    init(root) {
      const sid = "web-" + Math.random().toString(36).slice(2, 8), msgs = $("#msgs", root); let speak = false;
      const sug = ["What are the warning signs of dengue?", "My father has chest pressure and is sweating", "What are the visiting hours?", "I take warfarin and ibuprofen. Is that safe?", "How do I treat low blood sugar?"];
      $("#sug", root).innerHTML = sug.map((s) => `<button class="chip" type="button">${esc(s)}</button>`).join("");
      const welcome = () => { msgs.innerHTML = `<div class="msg bot"><div class="bubble">Hello. I answer from the hospital's clinical guidelines and policies, and I show the sources. I cannot diagnose or give personal drug doses.</div></div>`; };
      welcome();
      const add = (html, cls) => { const d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
      async function ask(text) {
        if (!text.trim()) return; add(esc(text), "user"); $("#q", root).value = ""; const wait = add('<div class="bubble"><span class="spin"></span> Searching guidelines...</div>', "bot");
        try {
          const r = await Engine.post("/api/chat", { question: text, session_id: sid });
          wait.innerHTML = `<div class="bubble">${r.banners.map((b) => `<div class="banner ${b.kind}">${ic("alert", 18)}<div>${esc(b.text)}</div></div>`).join("")}${rich(r.answer)}${r.interaction_alerts.map((a) => `<div class="alertbox">${esc(a)}</div>`).join("")}<div class="small muted" style="margin-top:8px">${esc(r.disclaimer)}</div></div>`;
          const ev = $("#evid", root);
          ev.innerHTML = r.citations.length ? r.citations.map((c) => `<div class="ev" data-n="${c.n}"><h4><span class="cite" style="margin:0">${c.n}</span>${esc(c.title)}</h4><p>${esc(c.source)} &middot; ${esc(c.category)}</p><p>${esc(c.snippet)}</p><div class="meter" title="relevance ${c.score}"><i style="width:${Math.round(c.score * 100)}%"></i></div></div>`).join("") : `<div class="empty"><b>No supporting source</b>The assistant abstained.</div>`;
          const cf = $("#conf", root); cf.hidden = false; cf.className = "pill " + (r.confidence >= 0.55 ? "ok" : r.confidence > 0 ? "warn" : "crit"); cf.textContent = "Match " + Math.round(r.confidence * 100) + "%";
          $("#notes", root).innerHTML = (r.guardrail_notes.length ? r.guardrail_notes : ["No guardrail triggered. Answer grounded in retrieved sources."]).map((n) => `<li><span style="color:var(--ok)">${ic("check", 15)}</span><span>${esc(n)}</span></li>`).join("") + `<li class="muted small">Engine: ${esc(r.provider)} &middot; ${r.latency_ms} ms</li>`;
          $("#ctx", root).textContent = r.patient_context ? "Remembered in this chat: " + r.patient_context : "";
          wait.querySelectorAll(".cite").forEach((b) => b.addEventListener("click", () => { $$(".ev", root).forEach((e) => e.classList.toggle("hl", e.dataset.n === b.dataset.n)); }));
          if (speak && "speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(r.answer.replace(/\[\d\]/g, "").replace(/^- /gm, "")); u.lang = "en-IN"; speechSynthesis.cancel(); speechSynthesis.speak(u); }
        } catch (e) { wait.innerHTML = `<div class="bubble">${errBox(e)}</div>`; }
        msgs.scrollTop = msgs.scrollHeight;
      }
      $("#chatf", root).addEventListener("submit", (e) => { e.preventDefault(); ask($("#q", root).value); });
      $("#q", root).addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(e.target.value); } });
      $("#sug", root).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) ask(c.textContent); });
      $("#newchat", root).addEventListener("click", () => { welcome(); Engine.post("/api/reset", { session_id: sid }).catch(() => {}); $("#ctx", root).textContent = ""; });
      $("#tts", root).addEventListener("click", (e) => { if (!("speechSynthesis" in window)) return toast("Read-aloud is not supported in this browser."); speak = !speak; e.currentTarget.innerHTML = `${ic("spk", 15)} Read aloud: ${speak ? "on" : "off"}`; });
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      $("#mic", root).addEventListener("click", () => {
        if (!SR) return toast("Voice input is not supported in this browser. Try Chrome or Edge.");
        try { const r = new SR(); r.lang = "en-IN"; r.interimResults = false; r.onresult = (ev) => { $("#q", root).value = ev.results[0][0].transcript; $("#q", root).focus(); };
          r.onerror = (ev) => toast("Voice input unavailable here (" + ev.error + "). Type your question instead."); r.start(); toast("Listening..."); } catch (e) { toast("Voice input could not start."); }
      });
    },
  };

  V.triage = {
    title: "AI Triage", icon: "heart", group: "g_clinical", perm: "ai.use",
    sub: "Free-text complaint plus optional vital signs. Returns a validated 5-level triage record with NEWS2 scoring and the reasons behind it.",
    html: () => `<div class="grid split-r"><section class="panel"><header><h2>Presentation</h2></header><form class="body grid" id="trf" style="gap:12px">
      <label class="f">Chief complaint<textarea id="tr-c" required minlength="3" placeholder="e.g. 58-year-old with chest pressure and sweating for 30 minutes"></textarea></label>
      <div class="fields"><label class="f">Age (years)<input id="tr-a" type="number" min="0" max="120" step="any"></label><label class="f">Sex<select id="tr-s"><option value="">Not stated</option><option>female</option><option>male</option></select></label></div>
      <h3>Vital signs <span class="muted" style="font-weight:400">(optional)</span></h3>
      <div class="fields"><label class="f">Resp. rate<input id="v-rr" type="number" min="0" max="80" placeholder="/min"></label><label class="f">SpO2 %<input id="v-sp" type="number" min="0" max="100"></label><label class="f">Systolic BP<input id="v-bp" type="number" min="0" max="300" placeholder="mmHg"></label><label class="f">Pulse<input id="v-hr" type="number" min="0" max="300" placeholder="/min"></label><label class="f">Temp &deg;C<input id="v-t" type="number" min="25" max="45" step="0.1"></label></div>
      <div class="row"><label class="check"><input type="checkbox" id="v-o2"> On supplemental oxygen</label><label class="check"><input type="checkbox" id="v-nc"> New confusion / not alert</label></div>
      <div class="row"><button class="btn primary" id="tr-go">Assess</button></div>
      <div><div class="small muted" style="margin-bottom:6px">Try an example</div><div class="row" id="tr-ex"></div></div></form></section>
      <section class="panel"><header><h2>Triage result</h2><button class="btn sm" id="tr-json" hidden>View JSON</button></header><div class="body" id="tr-out"><div class="empty"><b>No assessment yet</b>Describe a presentation and press Assess.</div></div></section></div>`,
    init(root) {
      const ex = [["Chest pain", "58-year-old with chest pressure, sweating and pain going down the left arm", { a: 58 }], ["Sore throat", "Sore throat and runny nose for two days, mild cough", { a: 24 }],
        ["Septic picture", "Fever, headache and feeling confused", { a: 72, rr: 24, sp: 93, bp: 98, hr: 112, t: 39.2 }], ["Infant fever", "Baby has a fever and is feeding poorly", { a: 0.1 }]];
      $("#tr-ex", root).innerHTML = ex.map((e, i) => `<button type="button" class="chip" data-i="${i}">${e[0]}</button>`).join("");
      let last = null;
      $("#tr-ex", root).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; const [, t, v] = ex[+c.dataset.i];
        $("#tr-c", root).value = t; $("#tr-a", root).value = v.a ?? ""; ["rr", "sp", "bp", "hr", "t"].forEach((k) => ($("#v-" + k, root).value = v[k] ?? "")); });
      $("#trf", root).addEventListener("submit", async (e) => {
        e.preventDefault(); const b = $("#tr-go", root); busy(b, true, "Assessing"); const out = $("#tr-out", root);
        const vit = { resp_rate: num($("#v-rr", root).value), spo2: num($("#v-sp", root).value), sbp: num($("#v-bp", root).value), pulse: num($("#v-hr", root).value), temp: num($("#v-t", root).value), on_oxygen: $("#v-o2", root).checked, alert: !$("#v-nc", root).checked };
        const has = ["resp_rate", "spo2", "sbp", "pulse", "temp"].some((k) => vit[k] !== null) || vit.on_oxygen || !vit.alert;
        const body = { complaint: $("#tr-c", root).value, age: num($("#tr-a", root).value), sex: $("#tr-s", root).value || null, vitals: has ? vit : null };
        try {
          const r = await Engine.post("/api/triage", body); last = r;
          const ns = r.news2 !== null && r.news2 !== undefined;
          out.innerHTML = `<div class="level" style="background:${r.color}"><div class="n">${r.level}</div><div><h2>${esc(r.level_name)}</h2><div class="t">${esc(r.target_time)}</div><div class="scale">${[1, 2, 3, 4, 5].map((i) => `<i class="${i === r.level ? "on" : ""}" style="background:#fff"></i>`).join("")}</div></div></div>
          ${r.escalate ? `<div class="banner emergency" style="margin-top:12px">${ic("alert")}<div>Escalate now. Notify the emergency team. India 112 / 108.</div></div>` : ""}
          <dl class="kv" style="margin-top:14px"><dt>Department</dt><dd><b>${esc(r.department)}</b></dd><dt>Disposition</dt><dd>${esc(r.disposition)}</dd><dt>NEWS2</dt><dd>${ns ? `<b class="num">${r.news2}</b> ` + (r.news2 >= 7 ? '<span class="pill crit">high risk</span>' : r.news2 >= 5 ? '<span class="pill warn">medium risk</span>' : '<span class="pill ok">low risk</span>') : '<span class="muted">not scored (no vitals)</span>'}</dd><dt>Confidence</dt><dd><span class="num">${Math.round(r.confidence * 100)}%</span><div class="meter" style="width:140px;display:inline-block;vertical-align:middle;margin-left:8px"><i style="width:${r.confidence * 100}%"></i></div></dd></dl>
          ${ns && Object.keys(r.news2_breakdown).length ? `<h3 style="margin:14px 0 6px">NEWS2 breakdown</h3><div class="tablewrap"><table><tr><th>Parameter</th><th>Value</th><th>Score</th></tr>${Object.entries(r.news2_breakdown).map(([k, v]) => `<tr><td>${esc(k.replace("_", " "))}</td><td class="num">${esc(v.value)}</td><td class="num">${v.score >= 3 ? `<span class="pill crit">${v.score}</span>` : v.score}</td></tr>`).join("")}</table></div>` : ""}
          <h3 style="margin:14px 0 6px">Why</h3>${r.reasons.length ? `<ul class="plain">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : '<p class="muted">No red flags found.</p>'}
          ${r.symptoms.length ? `<div class="row" style="margin-top:10px">${r.symptoms.map((s) => `<span class="pill ${s.red_flag ? "crit" : ""}">${esc(s.label)}</span>`).join("")}</div>` : ""}
          <h3 style="margin:14px 0 6px">Recommended actions</h3><ul class="plain">${r.recommended_actions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <pre class="json" id="tr-pre" hidden></pre>`;
          $("#tr-json", root).hidden = false;
        } catch (er) { out.innerHTML = errBox(er); }
        busy(b, false);
      });
      $("#tr-json", root).addEventListener("click", () => { const p = $("#tr-pre", root); p.textContent = JSON.stringify(last, null, 2); p.hidden = !p.hidden; });
    },
  };

  const SAMPLE_LAB = "MediSphere Diagnostics - Pathology Report\nPatient: SAMPLE PATIENT   Age: 52   Sex: Male\nHaemoglobin 11.2 g/dL\nWBC 12.4 x10^9/L\nPlatelets 138 x10^9/L\nFasting Blood Sugar 142 mg/dL\nHbA1c 7.1 %\nCreatinine 1.0 mg/dL\nLDL 131 mg/dL\nPotassium 4.2 mmol/L\nTSH 2.1 mIU/L\nRx: Metformin, Atorvastatin, Aspirin, Warfarin";
  V.documents = {
    title: "Document AI", icon: "doc", group: "g_clinical", perm: "docs.use",
    sub: "Read a lab report or prescription (photo or text), extract values, flag results outside reference ranges and check medicines for interactions.",
    html: () => `<div class="grid split-r"><section class="panel"><header><h2>Report</h2></header><div class="body grid" style="gap:12px"><label class="dropzone" id="dz" for="dz-f">${ic("doc", 22)}<div><b>Drop a report image</b> or click to choose</div><div class="small">PNG or JPG. OCR runs on the hospital server.</div><input id="dz-f" type="file" accept="image/*" hidden></label>
      <label class="f">Or paste the report text<textarea id="dt" rows="9" placeholder="Haemoglobin 11.2 g/dL..."></textarea></label><p class="small muted">Reports are analysed in memory. They are not stored and never enter the shared knowledge base.</p>
      <div class="row"><button class="btn primary" id="d-go">Analyse report</button><button class="btn" id="d-sample" type="button">Load sample</button></div></div></section>
      <section class="panel"><header><h2>Findings</h2></header><div class="body" id="d-out"><div class="empty"><b>No report analysed</b>Load the sample report to see the output.</div></div></section></div>`,
    init(root) {
      const out = $("#d-out", root);
      const render = (r) => {
        const rows = r.labs.map((l) => { const span = (l.hi < 900 ? l.hi - l.lo : l.lo) || 1, mn = l.lo - span * 0.7, mx = (l.hi < 900 ? l.hi : l.lo * 2) + span * 0.7, p = (v) => Math.max(0, Math.min(100, (v - mn) / (mx - mn) * 100));
          const cls = l.flag === "Normal" ? "ok" : "crit"; return `<tr><td><b>${esc(l.test)}</b></td><td class="num">${l.value} <span class="muted small">${esc(l.unit)}</span></td><td class="num small muted">${esc(l.range)}</td><td style="min-width:130px"><div class="rng"><div class="ok" style="left:${p(l.lo)}%;width:${(l.hi < 900 ? p(l.hi) : 100) - p(l.lo)}%"></div><b style="left:${p(l.value)}%"></b></div></td><td><span class="pill ${cls}">${l.flag}</span></td></tr>`; }).join("");
        out.innerHTML = `<p style="margin-bottom:12px"><b>${esc(r.summary)}</b></p>${r.labs.length ? `<div class="tablewrap"><table><tr><th>Test</th><th>Result</th><th>Reference</th><th>Position</th><th>Flag</th></tr>${rows}</table></div>` : '<div class="empty"><b>No lab values recognised</b>Check that each line reads like "Haemoglobin 11.2 g/dL".</div>'}
        ${r.insights.length ? `<h3 style="margin:16px 0 6px">What stands out</h3><ul class="plain">${r.insights.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${r.medications.length ? `<h3 style="margin:16px 0 6px">Medicines found</h3><div class="row">${r.medications.map((m) => `<span class="pill">${esc(m)}</span>`).join("")}</div>` : ""}
        ${r.interactions.map((p) => `<div class="alertbox"><b>${esc(p.severity)}: ${esc(p.a)} + ${esc(p.b)}.</b> ${esc(p.effect)} ${esc(p.advice)}</div>`).join("")}
        <p class="small muted" style="margin-top:14px">Machine-read values need clinician verification before use.</p>`;
      };
      const run = async (body) => { const b = $("#d-go", root); busy(b, true, "Reading"); try { render(await Engine.post("/api/document", body)); } catch (e) { out.innerHTML = errBox(e); } busy(b, false); };
      $("#d-sample", root).addEventListener("click", () => ($("#dt", root).value = SAMPLE_LAB));
      $("#d-go", root).addEventListener("click", () => { const tx = $("#dt", root).value; if (!tx.trim()) return toast("Paste report text or load the sample first."); run({ text: tx }); });
      const file = (f) => { if (!f) return; if (Engine.mode !== "api") return toast("Image OCR needs the hospital server. Paste the report text here instead."); const fr = new FileReader(); fr.onload = () => run({ image_b64: fr.result }); fr.readAsDataURL(f); };
      $("#dz-f", root).addEventListener("change", (e) => file(e.target.files[0]));
      const dz = $("#dz", root); ["dragover", "dragenter"].forEach((n) => dz.addEventListener(n, (e) => { e.preventDefault(); dz.classList.add("over"); })); ["dragleave", "drop"].forEach((n) => dz.addEventListener(n, () => dz.classList.remove("over")));
      dz.addEventListener("drop", (e) => { e.preventDefault(); file(e.dataTransfer.files[0]); });
    },
  };

  V.workflow = {
    title: "Patient Intake", icon: "flow", group: "g_clinical", perm: "encounters.write",
    sub: "Register a patient and run the intake pipeline: validation, PII masking, AI triage, routing, saved encounter, appointment, drafted notifications, EHR note and a tamper-evident audit entry.",
    html: () => `<div class="grid split-r"><section class="panel"><header><h2>Patient and presentation</h2></header><form class="body grid" id="wf" style="gap:12px"><div id="w-existing" class="banner crisis" hidden></div>
      <div class="fields"><label class="f">Full name<input id="w-n" required autocomplete="off"></label><label class="f">Age (years)<input id="w-a" type="number" step="any" min="0" max="120"></label><label class="f">Sex<select id="w-s"><option value="">Not stated</option><option>female</option><option>male</option></select></label></div>
      <div class="fields"><label class="f">Phone (masked before AI)<input id="w-p" autocomplete="off"></label><label class="f">Preferred language<select id="w-l"><option value="en">English</option><option value="hi">Hindi</option><option value="ar">Arabic</option><option value="es">Spanish</option></select></label></div>
      <label class="f">Complaint<textarea id="w-c" required placeholder="e.g. chest pain with sweating since this morning"></textarea></label>
      <h3>Vital signs <span class="muted" style="font-weight:400">(optional)</span></h3>
      <div class="fields"><label class="f">Resp. rate<input id="w-rr" type="number"></label><label class="f">SpO2 %<input id="w-sp" type="number"></label><label class="f">Systolic BP<input id="w-bp" type="number"></label><label class="f">Pulse<input id="w-hr" type="number"></label><label class="f">Temp &deg;C<input id="w-t" type="number" step="0.1"></label></div>
      <div class="row"><button class="btn primary" id="w-go">Register and run</button><button class="btn" type="button" id="w-demo">Fill example</button></div><p class="small muted">Messages are drafted for staff review and never sent automatically. Use fictional data in demos.</p></form></section>
      <div class="grid"><section class="panel"><header><h2>Pipeline</h2><span class="small muted" id="w-ms"></span></header><div class="body"><div class="pipe" id="w-steps"><div class="empty"><b>Not run yet</b>Submit the form to start.</div></div></div></section>
      <section class="panel" id="w-res" hidden><header><h2>Outputs</h2></header><div class="body grid" style="gap:12px" id="w-out"></div></section></div></div>`,
    init(root) {
      let existing = null;
      if (window.__wfPatient) { existing = window.__wfPatient; window.__wfPatient = null; $("#w-n", root).value = existing.name; $("#w-n", root).readOnly = true; $("#w-a", root).value = existing.age ?? ""; const b = $("#w-existing", root); b.hidden = false; b.innerHTML = `${ic("info", 16)}<div>New encounter for <b>${esc(existing.name)}</b> (${esc(existing.mrn)}).</div>`; }
      $("#w-demo", root).addEventListener("click", () => { if (!existing) { $("#w-n", root).value = "Kiran Patel"; $("#w-a", root).value = 58; $("#w-s", root).value = "male"; $("#w-p", root).value = "9000012345"; } $("#w-c", root).value = "Chest pain with sweating since this morning"; $("#w-rr", root).value = 22; $("#w-sp", root).value = 94; $("#w-bp", root).value = 104; $("#w-hr", root).value = 112; $("#w-t", root).value = 37.2; });
      $("#wf", root).addEventListener("submit", async (e) => {
        e.preventDefault(); const b = $("#w-go", root); busy(b, true, "Running");
        const v = { resp_rate: num($("#w-rr", root).value), spo2: num($("#w-sp", root).value), sbp: num($("#w-bp", root).value), pulse: num($("#w-hr", root).value), temp: num($("#w-t", root).value) }, has = Object.values(v).some((x) => x !== null);
        try {
          const r = await Engine.post("/api/workflow", { patient_id: existing ? existing.id : undefined, name: $("#w-n", root).value, age: num($("#w-a", root).value), sex: $("#w-s", root).value || null, phone: $("#w-p", root).value, language: $("#w-l", root).value, complaint: $("#w-c", root).value, vitals: has ? { ...v, on_oxygen: false, alert: true } : null });
          const host = $("#w-steps", root); host.innerHTML = r.steps.map((s) => `<div class="pstep wait" data-s="${s.status}"><span class="ic">${ic("check", 14)}</span><div><b>${esc(s.step)}</b><div class="small muted">${esc(s.detail)}</div></div><span class="small muted num">${s.ms} ms</span></div>`).join("");
          for (const el of $$(".pstep", host)) { await new Promise((r2) => setTimeout(r2, 110)); el.classList.remove("wait"); if (el.dataset.s === "failed") { el.classList.add("fail"); el.querySelector(".ic").innerHTML = ic("x", 14); } }
          $("#w-ms", root).textContent = r.total_ms ? r.total_ms + " ms total" : "";
          if (r.ok) { $("#w-res", root).hidden = false; $("#w-out", root).innerHTML = `<div class="row"><span class="pill" style="background:${r.triage.color};color:#fff">Level ${r.triage.level} ${esc(r.triage.level_name)}</span><span class="pill">${esc(r.triage.department)}</span><span class="pill">${esc(r.mrn)}</span></div>
            <div><h3>Patient SMS (draft)</h3><div class="msgbox">${esc(r.messages.patient_sms)}</div></div><div><h3>Clinician alert (draft)</h3><div class="msgbox">${esc(r.messages.clinician_alert)}</div></div><div><h3>EHR note (draft)</h3><div class="msgbox">${esc(r.ehr_note)}</div></div><button type="button" class="btn" id="w-q">Open live queue</button>`;
            $("#w-q", root).addEventListener("click", () => go("queue")); toast("Registered " + r.mrn + " at level " + r.triage.level); }
          else { $("#w-res", root).hidden = true; toast("Intake stopped at a failed step."); }
        } catch (er) { $("#w-steps", root).innerHTML = errBox(er); }
        busy(b, false);
      });
    },
  };

  const TARGET = { 1: 0, 2: 15, 3: 60, 4: 120, 5: 1440 };
  V.queue = {
    title: "Live Queue", icon: "clock", group: "g_clinical", perm: "queue.view",
    sub: "Everyone waiting or in treatment at this site, most urgent first. Waiting times turn red when a patient has passed the target for their triage level.",
    html: () => `<div class="kpis k4" id="q-k"></div><section class="panel"><header><h2>Emergency department board</h2><span class="small muted" id="q-t"></span><button class="btn sm" id="q-r">Refresh</button></header><div class="tablewrap" id="q-b"></div></section>`,
    init(root) {
      const load = async () => {
        if (!root.isConnected || root.hidden) return;
        try {
          const r = await Engine.get("/api/queue"), q = r.queue, crit = q.filter((x) => x.status === "waiting" && x.level <= 2).length, lw = Math.max(0, ...q.filter((x) => x.status === "waiting").map((x) => x.waiting_min));
          const tile = (v, l, c) => `<div class="panel kpi"><div class="v ${c || ""}">${v}</div><div class="l">${l}</div></div>`;
          $("#q-k", root).innerHTML = tile(r.waiting, esc(t("waiting"))) + tile(r.in_treatment, esc(t("in_treatment"))) + tile(crit, esc(t("critical_waiting")), crit ? "crit-t" : "") + tile(lw + "<small>min</small>", "Longest wait");
          const w = can("encounters.write");
          $("#q-b", root).innerHTML = q.length ? `<table><tr><th>Level</th><th>Patient</th><th>Complaint</th><th>Department</th><th>Waiting</th><th>NEWS2</th><th>Status</th>${w ? "<th></th>" : ""}</tr>` + q.map((x) => {
            const over = x.status === "waiting" && x.waiting_min > TARGET[x.level];
            return `<tr><td><span class="lvl" style="background:${LV[x.level]}">${x.level}</span></td><td><b>${esc(x.name)}</b><div class="small muted">${esc(x.mrn)} &middot; ${x.age}y ${esc((x.sex || "")[0] || "")}</div></td><td style="min-width:200px">${esc(x.complaint)}</td><td>${esc(x.department)}</td>
            <td class="num ${over ? "overdue" : ""}">${x.waiting_min} min${over ? " (over target)" : ""}</td><td class="num">${x.news2 ?? "-"}</td><td><span class="pill ${x.status === "in_treatment" ? "ok" : ""}">${x.status === "in_treatment" ? esc(t("in_treatment")) : esc(t("waiting"))}</span></td>
            ${w ? `<td style="white-space:nowrap">${x.status === "waiting" ? `<button class="btn sm primary" data-a="in_treatment" data-id="${x.id}">${esc(t("start"))}</button> ` : ""}<button class="btn sm" data-a="discharged" data-id="${x.id}">${esc(t("discharge"))}</button></td>` : ""}</tr>`; }).join("") + "</table>" : '<div class="empty"><b>No one waiting</b>New registrations from Patient Intake appear here.</div>';
          $("#q-t", root).textContent = "Updated " + new Date().toLocaleTimeString();
        } catch (e) { $("#q-b", root).innerHTML = errBox(e); }
      };
      root.addEventListener("click", async (e) => { const b = e.target.closest("[data-a]"); if (!b) return; b.disabled = true; try { await Engine.post(`/api/encounters/${b.dataset.id}/status`, { status: b.dataset.a }); toast(b.dataset.a === "discharged" ? "Patient discharged" : "Treatment started"); } catch (er) { toast(er.message); } load(); });
      $("#q-r", root).addEventListener("click", load); load(); setInterval(load, 15000);
    },
  };

  function modal(title, bodyHtml) {
    const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="sheet"><header><h2>${esc(title)}</h2><button class="iconbtn" aria-label="Close">${ic("x", 16)}</button></header><div class="body">${bodyHtml}</div></div>`;
    const close = () => m.remove(); m.addEventListener("click", (e) => { if (e.target === m) close(); }); m.querySelector("header button").addEventListener("click", close);
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
    document.body.appendChild(m); return m;
  }

  V.patients = {
    title: "Patient Registry", icon: "users", group: "g_clinical", perm: "patients.read",
    sub: "Search patients registered at this site. Every view of a record is written to the audit trail. Phone numbers are masked in the list.",
    html: () => `<div class="grid split-r" style="grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)"><section class="panel"><header><h2>Patients</h2>${can("patients.write") ? `<button class="btn sm primary" id="p-new">Register patient</button>` : ""}</header><div class="body"><input id="p-q" type="search" aria-label="Search patients"></div><div class="tablewrap" id="p-list"></div></section>
      <section class="panel"><header><h2>Record</h2><div class="row" id="p-act"></div></header><div class="body" id="p-det"><div class="empty"><b>No patient selected</b>Choose a patient from the list.</div></div></section></div>`,
    init(root) {
      $("#p-q", root).placeholder = t("search_ph");
      const list = async () => { try { const r = await Engine.get("/api/patients?q=" + encodeURIComponent($("#p-q", root).value)); $("#p-list", root).innerHTML = r.patients.length ? `<table><tr><th>Patient</th><th>MRN</th><th>Age / sex</th><th>Phone</th></tr>${r.patients.map((p) => `<tr class="clickrow" data-id="${p.id}" tabindex="0"><td><b>${esc(p.name)}</b></td><td class="num small">${esc(p.mrn)}</td><td class="num">${p.age ?? "-"} ${esc((p.sex || "")[0] || "")}</td><td class="num small muted">${esc(p.phone || "-")}</td></tr>`).join("")}</table>` : '<div class="empty"><b>No patients found</b>Register a patient to begin.</div>'; } catch (e) { $("#p-list", root).innerHTML = errBox(e); } };
      let tm; $("#p-q", root).addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(list, 250); });
      const open = async (id) => {
        try {
          const r = await Engine.get("/api/patients/" + id), p = r.patient, act = $("#p-act", root); act.innerHTML = "";
          if (can("encounters.write")) { const b = document.createElement("button"); b.className = "btn sm"; b.textContent = "New encounter"; b.onclick = () => { window.__wfPatient = p; delete inited.workflow; $$('.view[data-key="workflow"]').forEach((x) => x.remove()); go("workflow"); }; act.appendChild(b); }
          if (can("fhir.export")) { const b = document.createElement("button"); b.className = "btn sm"; b.innerHTML = ic("down", 14) + " Export FHIR"; b.onclick = async () => { try { const f = await Engine.get(`/api/patients/${p.id}/fhir`), txt = JSON.stringify(f, null, 2);
            const m = modal("FHIR R4 bundle: " + p.mrn, `<div class="row" style="margin-bottom:10px"><button class="btn sm" id="f-copy">Copy JSON</button>${Engine.mode === "api" ? `<button class="btn sm" id="f-dl">Download</button>` : ""}<span class="small muted">${f.entry.length} resources</span></div><pre class="json" style="max-height:60vh"></pre>`);
            m.querySelector("pre").textContent = txt; m.querySelector("#f-copy").onclick = () => { try { navigator.clipboard.writeText(txt).then(() => toast("Copied")).catch(() => toast("Select the text to copy")); } catch (e) { toast("Select the text to copy"); } };
            if (m.querySelector("#f-dl")) m.querySelector("#f-dl").onclick = () => { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "application/fhir+json" })); a.download = p.mrn + ".fhir.json"; a.click(); } catch (e) { toast("Download is not available here. Use Copy JSON."); } }; } catch (er) { toast(er.message); } }; act.appendChild(b); }
          $("#p-det", root).innerHTML = `<h2 style="font-size:18px">${esc(p.name)}</h2><dl class="kv" style="margin-top:10px"><dt>MRN</dt><dd class="num">${esc(p.mrn)}</dd><dt>Age / sex</dt><dd>${p.age ?? "-"} / ${esc(p.sex || "not stated")}</dd><dt>Date of birth</dt><dd>${esc(p.dob || "not recorded")}</dd><dt>Phone</dt><dd>${esc(p.phone || "not recorded")}</dd><dt>Language</dt><dd>${esc(p.language || "en")}</dd><dt>Registered</dt><dd>${esc((p.created_at || "").replace("T", " ").slice(0, 16))}</dd></dl>
            <h3 style="margin:16px 0 8px">Encounters</h3>${r.encounters.length ? r.encounters.map((e) => `<div class="insight" style="margin-bottom:8px"><span class="lvl" style="background:${LV[e.level]}">${e.level}</span><div><b>${esc(e.complaint)}</b><div class="small muted">${esc(e.department)} &middot; ${esc(e.arrived_at.replace("T", " ").slice(0, 16))} &middot; ${esc(e.status.replace("_", " "))}${e.news2 !== null && e.news2 !== undefined ? " &middot; NEWS2 " + e.news2 : ""}</div></div></div>`).join("") : '<p class="muted">No encounters yet.</p>'}`;
        } catch (e) { $("#p-det", root).innerHTML = errBox(e); }
      };
      $("#p-list", root).addEventListener("click", (e) => { const r = e.target.closest("[data-id]"); if (r) open(r.dataset.id); });
      $("#p-list", root).addEventListener("keydown", (e) => { if (e.key === "Enter") { const r = e.target.closest("[data-id]"); if (r) open(r.dataset.id); } });
      const nb = $("#p-new", root); if (nb) nb.addEventListener("click", () => go("workflow")); list();
    },
  };

  V.admin = {
    title: "Administration", icon: "shield", group: "g_system", perm: "users.manage",
    sub: "Staff accounts, the tamper-evident audit trail and system status. Visible to administrators only.",
    html: () => `<div class="grid g2" style="margin-bottom:16px"><section class="panel"><header><h2>Staff accounts</h2></header><div class="tablewrap" id="a-users"></div></section>
      <section class="panel"><header><h2>Add account</h2></header><form class="body grid" id="a-f" style="gap:10px"><div class="fields"><label class="f">Username<input id="a-u" required></label><label class="f">Full name<input id="a-n"></label></div><div class="fields"><label class="f">Role<select id="a-r"><option>doctor</option><option>nurse</option><option>receptionist</option><option>analyst</option><option>admin</option></select></label><label class="f">Site<select id="a-s"></select></label></div>
      <label class="f">Initial password<input id="a-p" type="password" autocomplete="new-password" required></label><p class="small muted">At least 10 characters with upper case, lower case and a digit.</p><div class="row"><button class="btn primary" id="a-go">Create account</button></div></form></section></div>
      <div class="grid split" style="margin-bottom:16px"><section class="panel"><header><h2>Audit trail</h2><span class="pill" id="a-ver" hidden></span><button class="btn sm" id="a-v">Verify chain</button></header><div class="tablewrap" id="a-log"></div></section>
      <section class="panel"><header><h2>System</h2></header><div class="body"><dl class="kv" id="a-sys"></dl></div></section></div>`,
    async init(root) {
      const users = async () => { const r = await Engine.get("/api/users"); $("#a-users", root).innerHTML = `<table><tr><th>User</th><th>Role</th><th>Site</th></tr>${r.users.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="small muted">${esc(u.username)}</div></td><td>${esc(u.role)}</td><td>${esc(u.site_id || "all")}</td></tr>`).join("")}</table>`; };
      const logs = async () => { const r = await Engine.get("/api/audit?limit=40"); $("#a-log", root).innerHTML = `<table><tr><th>Time (UTC)</th><th>User</th><th>Action</th><th>Resource</th><th>Result</th></tr>${r.entries.map((e) => `<tr><td class="num small">${esc(e.ts.replace("T", " ").slice(0, 19))}</td><td>${esc(e.username)}<div class="small muted">${esc(e.role)} &middot; ${esc(e.site_id)}</div></td><td>${esc(e.action)}</td><td class="small muted">${esc(e.resource || "")}</td><td><span class="pill ${e.outcome === "ok" ? "ok" : "crit"}">${esc(e.outcome)}</span></td></tr>`).join("")}</table>`; };
      try {
        $("#a-s", root).innerHTML = ME.sites.map((s) => `<option value="${s.id}">${esc(s.city)} (${s.id})</option>`).join(""); await users(); await logs();
        const h = await Engine.get("/api/system");
        $("#a-sys", root).innerHTML = `<dt>Mode</dt><dd>${Engine.mode === "api" ? "Server" : "Static demo (in browser)"}</dd><dt>Knowledge base</dt><dd>${h.documents} documents, ${h.indexed_chunks} passages</dd><dt>LLM providers</dt><dd>${esc(h.providers.join(", "))}</dd><dt>OCR</dt><dd>${h.ocr ? "Available" : "Not available"}</dd><dt>Field encryption</dt><dd>${h.field_encryption ? '<span class="pill ok">on</span>' : '<span class="pill warn">off (set MEDISPHERE_FIELD_KEY)</span>'}</dd><dt>Signing secret</dt><dd>${h.ephemeral_secret ? '<span class="pill warn">ephemeral (set MEDISPHERE_SECRET)</span>' : '<span class="pill ok">configured</span>'}</dd>`;
      } catch (e) { root.insertAdjacentHTML("beforeend", errBox(e)); }
      $("#a-v", root).addEventListener("click", async () => { const r = await Engine.get("/api/audit/verify"), p = $("#a-ver", root); p.hidden = false; p.className = "pill " + (r.ok ? "ok" : "crit"); p.textContent = r.ok ? `Chain intact (${r.entries} entries)` : `Tampering detected at entry ${r.broken_at}`; });
      $("#a-f", root).addEventListener("submit", async (e) => { e.preventDefault(); const b = $("#a-go", root); busy(b, true, "Creating"); try { await Engine.post("/api/users", { username: $("#a-u", root).value, name: $("#a-n", root).value, role: $("#a-r", root).value, site_id: $("#a-s", root).value, password: $("#a-p", root).value }); toast("Account created"); $("#a-f", root).reset(); users(); logs(); } catch (er) { toast(er.message); } busy(b, false); });
    },
  };

  const AG = { "Guardrail agent": "a-guard", "Planner agent": "a-plan", "Retrieval agent": "a-ret", "Specialist agent": "a-spec", "Safety agent": "a-safe", "Synthesizer agent": "a-syn" };
  V.agent = {
    title: "Research Agent", icon: "agent", group: "g_intel", perm: "ai.use",
    sub: "Give the agent a case. It plans, calls tools (guideline search, drug checker, NEWS2, triage), reviews safety and writes a report. Every step is logged.",
    html: () => `<section class="panel" style="margin-bottom:16px"><div class="body grid" style="gap:12px"><label class="f">Case or question<textarea id="ag-q" rows="3">70-year-old on warfarin and ibuprofen with fever. BP 96/60, pulse 120, SpO2 92, RR 26, temp 39.0. What should we check?</textarea></label>
      <div class="row"><button class="btn primary" id="ag-go">Run agent</button><span class="small muted">Examples:</span><button class="chip" data-q="Patient on sildenafil and nitroglycerin asks about chest pain. What is the risk?">Nitrate + sildenafil</button><button class="chip" data-q="Child with fever and rash, platelets falling, mosquito exposure. What are the dengue warning signs?">Dengue warning signs</button></div></div></section>
      <div class="grid split" id="ag-res" hidden><section class="panel"><header><h2>Agent trace</h2><span class="pill" id="ag-meta"></span></header><div class="body"><ol class="timeline" id="ag-tl"></ol></div></section><section class="panel"><header><h2>Report</h2></header><div class="body" id="ag-rep"></div></section></div>`,
    init(root) {
      root.addEventListener("click", (e) => { const c = e.target.closest("[data-q]"); if (c) $("#ag-q", root).value = c.dataset.q; });
      $("#ag-go", root).addEventListener("click", async (e) => {
        const b = e.currentTarget; busy(b, true, "Agent working"); const res = $("#ag-res", root);
        try {
          const r = await Engine.post("/api/agent", { question: $("#ag-q", root).value }); res.hidden = false;
          $("#ag-meta", root).textContent = `${r.steps}/${r.max_steps} steps · ${r.total_ms} ms`;
          $("#ag-tl", root).innerHTML = r.trace.map((t) => `<li><span class="pin ${AG[t.agent] || "a-syn"}">${t.n}</span><div><span class="who">${esc(t.agent)}</span> <span class="act">${esc(t.action)}</span><div class="obs">${esc(t.observation)}</div></div></li>`).join("");
          const p = r.report;
          $("#ag-rep", root).innerHTML = `${p.safety.map((s) => `<div class="banner emergency">${ic("alert")}<div>${esc(s)}</div></div>`).join("")}<h3>Findings</h3>${p.findings.length ? `<ul class="plain" style="margin-top:6px">${p.findings.map((f) => `<li>${esc(f).replace(/\[(\d)\]/g, '<span class="cite">$1</span>')}</li>`).join("")}</ul>` : '<p class="muted">No supported findings.</p>'}
            <h3 style="margin-top:14px">Next steps</h3><ul class="plain" style="margin-top:6px">${p.next_steps.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
            ${p.citations.length ? `<h3 style="margin-top:14px">Sources</h3><ul class="plain" style="margin-top:6px">${p.citations.map((c) => `<li><span class="cite">${c.n}</span> ${esc(c.title)} <span class="muted small">(${esc(c.source)})</span></li>`).join("")}</ul>` : ""}
            <p class="small muted" style="margin-top:14px">Decision support only. A clinician must verify before acting.</p>`;
        } catch (er) { res.hidden = false; $("#ag-rep", root).innerHTML = errBox(er); }
        busy(b, false);
      });
    },
  };

  V.search = {
    title: "Knowledge Search", icon: "search", group: "g_intel", perm: "search.use",
    sub: "Compare keyword (BM25), semantic (vector) and hybrid retrieval on the same query. Medical synonyms expand the query automatically.",
    html: () => `<section class="panel" style="margin-bottom:16px"><div class="body grid" style="gap:10px"><form class="row" id="sf" style="flex-wrap:nowrap"><input id="sq" value="heart attack symptoms" aria-label="Search query"><button class="btn primary" id="s-go">Search</button></form><div class="row" id="s-exp"></div></div></section>
      <div class="cols3" id="s-res"></div>
${can("kb.manage") ? `<section class="panel" style="margin-top:16px"><header><h2>Add a document to the index</h2></header><div class="body grid" style="gap:10px"><div class="fields" style="grid-template-columns:1fr"><label class="f">Title<input id="ig-t" value="Ward 4B isolation SOP"></label></div><label class="f">Text<textarea id="ig-x" rows="4">Patients with suspected airborne infections are admitted to a negative-pressure room. Staff wear an N95 respirator and a gown before entry. Visitors are limited to one adult per day and must register at the nursing station.</textarea></label><div class="row"><button class="btn" id="ig-go">Chunk, mask PII and index</button><span class="small muted" id="ig-out"></span></div></div></section>` : ""}`,
    init(root) {
      const col = (name, sub, hits) => `<section class="panel"><header><h2>${name}</h2><span class="small muted">${sub}</span></header><div class="body">${hits.length ? hits.map((h) => `<div class="hit"><div class="t">${esc(h.title)}</div><div class="small muted">${esc(h.category)}</div><div class="s"><div class="meter"><i style="width:${Math.round(h.score * 100)}%"></i></div><b class="num small">${h.score.toFixed(2)}</b></div></div>`).join("") : '<div class="empty">No match</div>'}</div></section>`;
      const go = async () => { const b = $("#s-go", root); busy(b, true, "Searching"); try { const r = await Engine.post("/api/search", { query: $("#sq", root).value, k: 5 });
        $("#s-exp", root).innerHTML = r.expansion.length ? `<span class="small muted">Expanded with:</span>` + r.expansion.map((x) => `<span class="pill">${esc(x)}</span>`).join("") : '<span class="small muted">No synonym expansion applied.</span>';
        $("#s-res", root).innerHTML = col("Keyword", "BM25", r.results.keyword) + col("Semantic", "vector similarity", r.results.semantic) + col("Hybrid", "fused + re-ranked", r.results.hybrid); } catch (e) { $("#s-res", root).innerHTML = errBox(e); } busy(b, false); };
      $("#sf", root).addEventListener("submit", (e) => { e.preventDefault(); go(); });
      if ($("#ig-go", root)) $("#ig-go", root).addEventListener("click", async (e) => { const b = e.currentTarget; busy(b, true, "Indexing"); try { const r = await Engine.post("/api/ingest", { title: $("#ig-t", root).value, text: $("#ig-x", root).value }); $("#ig-out", root).textContent = `${r.chunks_added} passage(s) added, ${r.pii_masked} identifier(s) masked. Index now holds ${r.total_chunks} passages. Try searching "isolation room".`; } catch (er) { $("#ig-out", root).textContent = er.message; } busy(b, false); });
      go();
    },
  };

  V.lab = {
    title: "Prompt Lab", icon: "flask", group: "g_intel", perm: "ai.use",
    sub: "Run one clinical question through five prompting strategies and compare prompt, response, size and latency. Connect an API key to compare real models.",
    html: () => `<section class="panel" style="margin-bottom:16px"><div class="body grid" style="gap:12px"><label class="f">Question<input id="pl-q" value="What are the warning signs of low blood sugar?"></label><div class="row" id="pl-s"></div><div class="row"><button class="btn primary" id="pl-go">Run strategies</button><span class="small muted" id="pl-prov"></span></div></div></section><div class="grid g2" id="pl-out"></div>`,
    init(root) {
      const names = { zero_shot: "Zero-shot", role: "Role prompt", few_shot: "Few-shot", chain_of_thought: "Chain of thought", plain_language: "Plain language" };
      $("#pl-s", root).innerHTML = Object.entries(names).map(([k, n]) => `<label class="check"><input type="checkbox" value="${k}" checked> ${n}</label>`).join("");
      $("#pl-go", root).addEventListener("click", async (e) => { const b = e.currentTarget; busy(b, true, "Running"); try {
        const r = await Engine.post("/api/playground", { question: $("#pl-q", root).value, strategies: $$("#pl-s input:checked", root).map((x) => x.value) });
        $("#pl-prov", root).textContent = "Providers available: " + r.providers.join(", ");
        $("#pl-out", root).innerHTML = r.runs.map((x) => `<section class="panel"><header><h2>${names[x.strategy] || x.strategy}</h2><span class="small muted num">${x.tokens_est} tokens · ${x.latency_ms} ms</span></header><div class="body">${rich(x.response)}<div class="small muted" style="margin-top:6px">${esc(x.provider)}</div><details class="pr"><summary>Show prompt</summary><pre>${esc(x.prompt)}</pre></details></div></section>`).join(""); } catch (er) { $("#pl-out", root).innerHTML = errBox(er); } busy(b, false); });
    },
  };

  V.arch = {
    title: "Architecture", icon: "layers", group: "g_system",
    sub: "How the eleven course topics map to modules in this project.",
    html: () => {
      const days = [["Day 1", "Python for AI development", "config.py, llm.py, Git, requirements", "Project foundation"], ["Day 2", "Data handling and APIs", "analytics.py (pandas), REST + JSON", "Command Center"], ["Day 3", "Prompt engineering", "prompts.py, multi-provider llm.py", "Prompt Lab"],
        ["Day 4", "LLM application development", "triage.py (structured output), tools.py, memory.py", "AI Triage, Assistant"], ["Day 5", "Multimodal AI", "ocr.py (Tesseract), browser voice", "Document AI, microphone"], ["Day 6", "AI workflow automation", "workflow.py", "Intake Workflow"],
        ["Day 7", "Embeddings and vector databases", "retrieval.py (TF-IDF + LSA vector store)", "Knowledge Search"], ["Day 8", "Retrieval-augmented generation", "rag.py with citations", "Clinical Assistant"], ["Day 9", "Advanced RAG and enterprise AI", "hybrid search, guardrails.py, ingestion", "Knowledge Search, safety checks"],
        ["Day 10", "Agentic AI", "agents.py (5 agents, bounded loop)", "Research Agent"], ["Day 11", "Deployment", "FastAPI, Dockerfile, static build", "This application"]];
      return `<section class="panel" style="margin-bottom:16px"><header><h2>Request flow</h2></header><div class="body"><div class="flow"><div><b>Clinician UI</b><span class="small muted">HTML, JS, voice</span></div><span>&rarr;</span><div><b>FastAPI</b><span class="small muted">/api/*, validation</span></div><span>&rarr;</span><div><b>Guardrails</b><span class="small muted">PII, injection, crisis</span></div><span>&rarr;</span><div><b>RAG / Agents / Tools</b><span class="small muted">hybrid search, NEWS2, drug checker</span></div><span>&rarr;</span><div><b>LLM provider</b><span class="small muted">offline, Claude, OpenAI</span></div></div></div></section>
      <div class="days">${days.map((d) => `<div class="day"><span class="dn">${d[0]}</span><h3>${esc(d[1])}</h3><span class="mod">${esc(d[2])}</span><span class="pill" style="justify-self:start">${esc(d[3])}</span></div>`).join("")}</div>
      <section class="panel" style="margin-top:16px"><header><h2>Runtime</h2></header><div class="body"><dl class="kv" id="rt"></dl></div></section>`;
    },
    async init(root) { try { const h = can("users.manage") ? await Engine.get("/api/system") : { documents: "-", indexed_chunks: "-", providers: ["restricted"], active_provider: "-", ocr: false, version: "1.0.0" }; $("#rt", root).innerHTML = `<dt>Mode</dt><dd>${Engine.mode === "api" ? "Connected to server API" : "In-browser engine (static demo)"}</dd><dt>Knowledge base</dt><dd>${h.documents} documents, ${h.indexed_chunks} indexed passages</dd><dt>LLM providers</dt><dd>${esc(h.providers.join(", "))} (active: ${esc(h.active_provider)})</dd><dt>OCR</dt><dd>${h.ocr ? "Tesseract available" : "Not available in this mode"}</dd><dt>Version</dt><dd>${esc(h.version)}</dd>`; } catch (e) { /* ignore */ } },
  };

  /* ---------------- shell: sign-in, navigation, language, site ---------------- */
  const order = ["dashboard", "queue", "patients", "workflow", "assistant", "triage", "documents", "agent", "search", "lab", "admin", "arch"], inited = {};
  let current = "dashboard";
  const store = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } };
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const allowed = () => order.filter((k) => !V[k].perm || can(V[k].perm));

  function buildNav() {
    let g = "", h = "";
    allowed().forEach((k) => { const v = V[k]; if (v.group !== g) { g = v.group; h += `<h6>${esc(t(g))}</h6>`; } h += `<button data-view="${k}">${ic(v.icon)}<span>${esc(t(k))}</span></button>`; });
    $("#nav").innerHTML = h;
  }
  function resetViews() { $("#content").innerHTML = ""; Object.keys(inited).forEach((k) => delete inited[k]); }
  function paintShell() {
    buildNav();
    $("#hosp-name").textContent = ME.site.name; $("#safety-text").textContent = t("safety", { n: ME.site.emergency_number });
    $("#uname").textContent = ME.user.name; $("#urole").textContent = `${ME.user.role_label} · ${ME.site.city}`; $("#av").textContent = ME.user.name.replace(/^(Dr\.|Nurse)\s+/, "").split(/\s+/).map((x) => x[0]).slice(0, 2).join("");
    $("#signout").textContent = t("signout"); $("#engine-foot").textContent = ME.site.regulations;
    const ss = $("#site-sel"); ss.hidden = ME.user.role !== "admin"; if (!ss.hidden) { ss.innerHTML = ME.sites.map((s) => `<option value="${s.id}" ${s.id === ME.site.id ? "selected" : ""}>${esc(s.city)}</option>`).join(""); ss.setAttribute("aria-label", t("site")); }
    $("#lang").innerHTML = I18N.langs.map(([k, n]) => `<option value="${k}" ${k === I18N.lang ? "selected" : ""}>${n}</option>`).join("");
  }
  async function go(key) {
    const ok = allowed(); if (!V[key] || !ok.includes(key)) key = ok[0]; current = key;
    $$("#nav button").forEach((b) => b.setAttribute("aria-current", b.dataset.view === key ? "page" : "false"));
    $$(".view").forEach((s) => (s.hidden = s.dataset.key !== key));
    let sec = $(`.view[data-key="${key}"]`);
    if (!sec) {
      sec = document.createElement("section"); sec.className = "view"; sec.dataset.key = key; const v = V[key];
      sec.innerHTML = `<div class="view-head"><div><h1>${esc(t(key))}</h1><p>${v.sub}</p></div></div>${v.html()}`; $("#content").appendChild(sec);
    }
    if (!inited[key]) { inited[key] = true; try { await V[key].init(sec); } catch (e) { sec.insertAdjacentHTML("beforeend", errBox(e)); } }
    try { history.replaceState(null, "", "#" + key); } catch (e) { /* sandboxed */ }
    document.title = t(key) + " - MediSphere AI"; window.scrollTo(0, 0);
  }
  function enter(r) {
    ME.user = r.user; ME.site = r.site; ME.sites = r.sites || [r.site]; if (Engine.mode === "api") store("ms-token", Engine.token);
    $("#login").hidden = true; $("#app").hidden = false; paintShell(); resetViews();
    const want = (location.hash || "").slice(1); go(allowed().includes(want) ? want : allowed()[0]);
  }
  function showLogin(msg) {
    $("#app").hidden = true; const L = $("#login"); L.hidden = false; const demo = Engine.mode === "local", MSD = window.__MS || {};
    L.innerHTML = `<div class="login-hero"><div class="brand"><svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="#6CC8E3" stroke-width="2"/><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff"/><circle cx="16" cy="16" r="3" fill="#0B2536"/></svg><span>MediSphere <b>AI</b></span></div>
      <h1>Clinical intelligence for every site</h1><p>Guideline answers with sources, AI triage with early-warning scoring, a live emergency queue and FHIR-ready records, under one audited sign-in.</p>
      <ul class="sites">${(MSD.sites || [{ city: "Hyderabad", country: "India", emergency_number: "112 / 108" }, { city: "Dubai", country: "United Arab Emirates", emergency_number: "998 / 999" }, { city: "London", country: "United Kingdom", emergency_number: "999 / 112" }, { city: "Singapore", country: "Singapore", emergency_number: "995" }]).map((s) => `<li><b>${esc(s.city)}</b><span>${esc(s.country)}</span><span class="num">${esc(s.emergency_number)}</span></li>`).join("")}</ul></div>
      <div class="login-card"><form id="lf"><h2>${esc(t("signin"))}</h2>${msg ? `<div class="err" role="alert" style="margin:12px 0">${esc(msg)}</div>` : ""}
      ${demo ? "" : `<label class="f" style="margin-top:14px">${esc(t("username"))}<input id="lu" autocomplete="username" required></label><label class="f" style="margin-top:12px">${esc(t("password"))}<input id="lp" type="password" autocomplete="current-password" required></label><button class="btn primary" id="lgo" style="width:100%;margin-top:16px;padding:10px">${esc(t("signin"))}</button>`}
      ${demo ? `<p class="muted" style="margin:10px 0 12px">Hosted demo with fictional data. Choose a role to see how access changes. The server edition requires a username and password.</p><div class="roles">${(MSD.users || []).map((u) => `<button type="button" class="rolebtn" data-u="${esc(u.username)}"><b>${esc(u.name)}</b><span>${esc(MSD.role_labels[u.role])} &middot; ${esc(u.site_id || "all sites")}</span></button>`).join("")}</div>` : ""}
      <p class="small muted" style="margin-top:16px">Access is logged. Do not share your credentials.</p></form></div>`;
    const done = (r) => enter(r);
    if (demo) $$(".rolebtn", L).forEach((b) => b.addEventListener("click", async () => { try { done(await Engine.login(b.dataset.u, "demo")); } catch (e) { showLogin(e.message); } }));
    else $("#lf", L).addEventListener("submit", async (e) => { e.preventDefault(); const b = $("#lgo", L); busy(b, true, "Signing in"); try { done(await Engine.login($("#lu", L).value, $("#lp", L).value)); } catch (er) { busy(b, false); showLogin(er.message); } });
  }
  function signout(msg) { Engine.logout(); store("ms-token", null); ME.user = null; resetViews(); showLogin(typeof msg === "string" ? msg : ""); }
  function theme() {
    const root = document.documentElement; let dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const s = pref("ms-theme"); if (s) { root.dataset.theme = s; dark = s === "dark"; }
    $("#theme-btn").addEventListener("click", () => { dark = !dark; root.dataset.theme = dark ? "dark" : "light"; pref("ms-theme", root.dataset.theme); });
  }
  async function boot() {
    I18N.set(pref("ms-lang") || "en"); theme();
    $("#nav").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) { go(b.dataset.view); $("#rail").classList.remove("open"); } });
    $("#menu-btn").addEventListener("click", () => $("#rail").classList.toggle("open"));
    $("#signout").addEventListener("click", () => signout());
    $("#lang").addEventListener("change", (e) => { I18N.set(e.target.value); pref("ms-lang", e.target.value); paintShell(); resetViews(); go(current); });
    $("#site-sel").addEventListener("change", async (e) => {
      Engine.siteId = e.target.value; if (Engine.demo) Engine.demo.setSite(e.target.value);
      try { const me = await Engine.get("/api/auth/me"); ME.site = me.site; paintShell(); resetViews(); go(current); toast("Now viewing " + ME.site.city); } catch (er) { toast(er.message); } });
    Engine.onAuthLost = (m) => { if (ME.user) signout(m || "Your session ended. Sign in again."); };
    try {
      const mode = await Engine.init(), pill = $("#engine-pill");
      pill.className = "pill " + (mode === "api" ? "ok" : ""); pill.innerHTML = `<i class="dot"></i><span>${mode === "api" ? "Secure server" : "Hosted demo"}</span>`;
      if (mode === "api" && store("ms-token")) {
        Engine.token = store("ms-token");
        try { const me = await Engine.get("/api/auth/me"), sl = await Engine.get("/api/sites"); Engine.siteId = me.site.id; return enter({ user: me.user, site: me.site, sites: sl.sites }); } catch (e) { store("ms-token", null); Engine.token = null; }
      }
      showLogin();
    } catch (e) { $("#login").hidden = false; $("#login").innerHTML = `<div class="login-card" style="grid-column:1/-1;margin:auto">${errBox(e)}</div>`; }
  }
  boot();
})();
