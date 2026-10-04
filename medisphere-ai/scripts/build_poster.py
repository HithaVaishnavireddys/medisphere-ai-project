"""Build the A2 project poster (PDF + PNG) from assets/. Logo slots pick up files from assets/logos/:
   edvergencex-dark.png, edvergencex-light.png, ttit-dark.png, ttit-light.png   (png/svg/jpg accepted)
"dark" = logo designed for a dark background (shown on the navy band); "light" = for a light background."""
import base64
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"
URL = "https://claude.ai/artifact/HYp2gPDnNiWQ4Lp2NcaLZf"


def img(name):
    return "data:image/png;base64," + base64.b64encode((A / "screens" / f"{name}.png").read_bytes()).decode()


def logo(stem, label, dark_bg):
    for ext in ("png", "svg", "jpg", "jpeg", "webp"):
        f = A / "logos" / f"{stem}.{ext}"
        if f.exists():
            mime = "image/svg+xml" if ext == "svg" else f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"
            return f'<img class="logo" alt="{label}" src="data:{mime};base64,{base64.b64encode(f.read_bytes()).decode()}">'
    return f'<div class="slot {"on-dark" if dark_bg else "on-light"}"><b>{label}</b><span>logo file not received yet</span></div>'


qr = (A / "qr.svg").read_text()
html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: 420mm 594mm; margin: 0 }}
:root {{ --navy:#0B2536; --teal:#0A6C8A; --sky:#6CC8E3; --ink:#10212E; --muted:#546675; --line:#D8E1E7; --bg:#F2F6F8; }}
* {{ box-sizing:border-box; margin:0 }}
body {{ width:1587px; height:2245px; font-family:Inter,'Noto Sans',sans-serif; color:var(--ink); background:var(--bg); overflow:hidden; position:relative }}
.top {{ background:var(--navy); height:150px; display:flex; align-items:center; justify-content:space-between; padding:0 72px }}
.top .brandline {{ color:#9FB6C5; font-size:22px; letter-spacing:.04em }}
.logo {{ height:78px; width:auto; max-width:360px; object-fit:contain }}
.slot {{ height:78px; min-width:300px; border:2px dashed; border-radius:10px; display:flex; flex-direction:column; justify-content:center; padding:0 20px; font-size:20px }}
.slot span {{ font-size:15px; opacity:.75 }}
.on-dark {{ border-color:#4C6A7E; color:#C9D8E2 }} .on-light {{ border-color:#9DB3C1; color:#3B5568 }}
.hero {{ padding:40px 72px 24px; display:grid; grid-template-columns:1.25fr 1fr; gap:56px; align-items:end }}
h1 {{ font-size:104px; line-height:.98; font-weight:700; letter-spacing:-.02em; color:var(--navy) }}
h1 em {{ font-style:normal; color:var(--teal) }}
.lead {{ font-size:30px; line-height:1.35; color:#26394A; margin-top:14px; max-width:34ch }}
.hero p.sub {{ font-size:23px; line-height:1.5; color:var(--muted) }}
.hero .tag {{ display:inline-block; margin-top:14px; font-size:20px; font-weight:600; color:var(--teal); border:2px solid var(--teal); border-radius:99px; padding:6px 18px }}
.shot {{ background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; box-shadow:0 8px 30px rgba(16,33,46,.12) }}
.shot img {{ width:100%; height:260px; object-fit:cover; object-position:top left; display:block }} .shot.big img {{ height:330px }}
.shot figcaption {{ padding:10px 16px; font-size:17.5px; line-height:1.35; color:var(--muted); border-top:1px solid var(--line) }} .shot figcaption b {{ color:var(--ink) }}
.main {{ padding:0 72px; display:grid; gap:22px }}
.row4 {{ display:grid; grid-template-columns:repeat(4,1fr); gap:20px }}
.bot {{ display:grid; grid-template-columns:1fr 1fr; gap:22px }}
.row2 {{ display:grid; grid-template-columns:1fr 1fr; gap:28px }}
.sec {{ font-size:34px; font-weight:700; color:var(--navy); margin:4px 0 0 }}
.cols {{ display:grid; grid-template-columns:repeat(3,1fr); gap:28px }}
.card {{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px 22px }}
.card h3 {{ font-size:24px; margin-bottom:6px; color:var(--navy) }} .card p, .card li {{ font-size:18.5px; line-height:1.4; color:#33475A }}
.card ul {{ padding-left:22px; display:grid; gap:6px }}
.flow {{ display:flex; align-items:stretch; gap:10px }} .flow div {{ flex:1; background:var(--navy); color:#fff; border-radius:12px; padding:14px 16px; font-size:18px }} .flow b {{ display:block; font-size:21px; color:var(--sky); margin-bottom:3px }}
.flow i {{ align-self:center; color:var(--teal); font-style:normal; font-size:36px }}
.days {{ display:grid; grid-template-columns:repeat(11,1fr); gap:8px }} .days div {{ background:#fff; border:1px solid var(--line); border-top:6px solid var(--teal); border-radius:10px; padding:8px 6px; font-size:15.5px; text-align:center; line-height:1.3 }} .days b {{ display:block; font-size:19px; color:var(--teal) }}
.stats {{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px }} .stats div {{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:12px 10px; text-align:center }} .stats b {{ font-size:46px; color:var(--teal); line-height:1; display:block }} .stats span {{ font-size:17px; color:var(--muted) }}
.qrbox {{ background:var(--navy); color:#fff; border-radius:16px; padding:20px; display:flex; gap:22px; align-items:center }}
.qrbox .q {{ background:#fff; padding:14px; border-radius:12px; width:210px; height:210px; flex:none }} .qrbox .q svg {{ width:182px; height:182px }}
.qrbox h3 {{ font-size:28px; color:var(--sky) }} .qrbox p {{ font-size:18px; line-height:1.4; margin-top:6px; color:#D3E0E8 }}
.bottom {{ position:absolute; left:0; right:0; bottom:0; height:150px; background:#fff; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; padding:0 72px }}
.bottom .note {{ max-width:760px; font-size:17px; color:var(--muted); line-height:1.45; text-align:center }}
</style></head><body>
<div class="top">{logo('edvergencex-dark','Edvergencex (dark background)',True)}<div class="brandline">CAPSTONE PROJECT &middot; AI APPLICATION DEVELOPMENT</div>{logo('ttit-dark','TTIT (dark background)',True)}</div>
<section class="hero"><div><h1>MediSphere <em>AI</em></h1><p class="lead">Clinical intelligence for hospitals that operate in many countries.</p></div>
<div><p class="sub">One audited sign-in gives each role the right tools: guideline answers with sources, AI triage with early-warning scoring, a live emergency queue and FHIR-ready records for four hospital sites in four languages.</p><span class="tag">Healthcare &middot; RAG &middot; Agents &middot; FHIR</span></div></section>
<div class="main">
<div class="shot big"><img src="{img('dashboard')}"><figcaption><b>Command Center.</b> Throughput, waits, triage mix and readmission risk, with the live emergency count for the selected site.</figcaption></div>
<div class="row4">
 <div class="shot"><img src="{img('queue')}"><figcaption><b>Live Queue.</b> Most urgent first; waits turn red when past the target for the triage level.</figcaption></div>
 <div class="shot"><img src="{img('assistant')}"><figcaption><b>Clinical Assistant.</b> Cited answers, emergency banner, drug-interaction alert, safety checks.</figcaption></div>
 <div class="shot"><img src="{img('triage')}"><figcaption><b>AI Triage.</b> Validated 5-level record with NEWS2 breakdown and reasons.</figcaption></div>
 <div class="shot"><img src="{img('agent')}"><figcaption><b>Research Agent.</b> Plan, tool calls, safety review and report, fully traced.</figcaption></div>
</div>
<h2 class="sec">How it works</h2>
<div class="flow"><div><b>Clinician UI</b>Role-based screens, voice, 4 languages</div><i>&rsaquo;</i><div><b>API</b>Sign-in, RBAC, rate limits, audit chain</div><i>&rsaquo;</i><div><b>Guardrails</b>PII masking, injection, crisis routing</div><i>&rsaquo;</i><div><b>RAG / Agents / Tools</b>Hybrid search, NEWS2, drug checker</div><i>&rsaquo;</i><div><b>Data</b>SQLite &rarr; PostgreSQL, FHIR R4 export</div></div>
<div class="days">
{''.join(f'<div><b>Day {n}</b>{t}</div>' for n,t in [(1,'Python and APIs'),(2,'Data with pandas'),(3,'Prompt engineering'),(4,'LLM apps, tools, memory'),(5,'OCR and voice'),(6,'Workflow automation'),(7,'Embeddings'),(8,'RAG'),(9,'Guardrails, hybrid search'),(10,'Agents'),(11,'Deployment')])}
</div>
<div class="cols">
 <div class="card"><h3>Built for real operations</h3><ul><li>9-step intake: validate, mask, triage, route, save, schedule, draft messages, draft note, audit</li><li>Per-site data isolation and local emergency numbers</li><li>Patient reports analysed in memory, never stored</li></ul></div>
 <div class="card"><h3>Safety and security</h3><ul><li>5 roles with least-privilege access</li><li>Hash-chained audit trail that detects tampering</li><li>Lockout, rate limits, signed expiring sessions, optional field encryption</li></ul></div>
 <div class="card"><h3>Honest by design</h3><ul><li>Abstains when evidence is weak</li><li>Never gives personal drug doses</li><li>Decision support only; needs clinical validation before patient use</li></ul></div>
</div>
<div class="bot"><div class="stats"><div><b>38</b><span>knowledge documents</span></div><div><b>4</b><span>hospital sites</span></div><div><b>5</b><span>user roles</span></div><div><b>36</b><span>automated tests passing</span></div><div><b>4</b><span>interface languages</span></div><div><b>R4</b><span>FHIR export</span></div></div>
<div class="qrbox"><div class="q">{qr}</div><div><h3>Scan to open the live demo</h3><p>Hosted demo with fictional data. Choose a role on the sign-in screen to see how access, queue and records change. Source code, tests and Docker files are in the project folder.</p></div></div></div>
</div>
<div class="bottom">{logo('edvergencex-light','Edvergencex (light background)',False)}<div class="note">Educational decision-support demo using synthetic data. Not a medical device. In an emergency call your local emergency number.</div>{logo('ttit-light','TTIT (light background)',False)}</div>
</body></html>"""
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "poster.html").write_text(html, encoding="utf-8")
out = ROOT / "deliverables"
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1587, "height": 2245})
    pg.goto("file://" + str(ROOT / "dist" / "poster.html"))
    pg.wait_for_timeout(600)
    over = pg.evaluate("[document.querySelector('.main').scrollHeight, document.querySelector('.bottom').getBoundingClientRect().top, document.querySelector('.qrbox').getBoundingClientRect().bottom]")
    print("main height / bottom top / qr bottom:", over)
    pg.screenshot(path=str(out / "MediSphere_AI_Poster.png"))
    pg.pdf(path=str(out / "MediSphere_AI_Poster.pdf"), width="420mm", height="594mm", print_background=True)
    b.close()
