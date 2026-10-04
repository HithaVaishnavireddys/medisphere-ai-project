"""Build the single-file static demo (works with no server: the engine runs in the browser).

Outputs
  dist/medisphere-demo.html  complete HTML document (open anywhere / host on GitHub Pages)
  dist/artifact.html         same page as a body fragment (for hosts that wrap the page themselves)
  dist/ms-data.json          the data bundle injected as window.__MS
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from medisphere import analytics, prompts  # noqa: E402
from medisphere.config import load_json  # noqa: E402

FE = ROOT / "frontend"
DIST = ROOT / "dist"
DIST.mkdir(exist_ok=True)

from medisphere import security, store  # noqa: E402

ms = {"kb": load_json("knowledge_base.json"), "rules": load_json("rules.json"), "drugs": load_json("drug_interactions.json"),
      "dashboards": {s[0]: analytics.dashboard(s[0], live=False) for s in store.SITES}, "strategies": prompts.STRATEGIES,
      "permissions": {r: sorted(p) for r, p in security.PERMISSIONS.items()}, "role_labels": security.ROLE_LABEL,
      "sites": [dict(zip(["id", "name", "country", "city", "timezone", "locale", "emergency_number", "regulations"], s)) for s in store.SITES],
      "users": [{"id": i + 1, "username": u, "name": n, "role": r, "site_id": s} for i, (u, n, r, s) in enumerate(store.DEMO_USERS)]}
(DIST / "ms-data.json").write_text(json.dumps(ms, separators=(",", ":")), encoding="utf-8")
data_js = "window.__MS=" + json.dumps(ms, separators=(",", ":")) + ";window.__MS_FORCE_LOCAL=true;"

css = (FE / "app.css").read_text(encoding="utf-8")
body = (FE / "body.html").read_text(encoding="utf-8")
js = "\n".join((FE / f).read_text(encoding="utf-8") for f in ("engine.js", "demo.js", "i18n.js", "app.js"))
FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">'
TITLE = "<title>MediSphere AI</title>"

frag = f"{TITLE}\n{FONT}\n<style>\n{css}\n</style>\n{body}\n<script>\n{data_js}\n</script>\n<script>\n{js}\n</script>\n"
(DIST / "artifact.html").write_text(frag, encoding="utf-8")
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + frag.replace("</style>\n", "</style>\n</head>\n<body>\n", 1) + "</body>\n</html>\n")
(DIST / "medisphere-demo.html").write_text(full, encoding="utf-8")

# Server-mode index (loads assets from /static, talks to /api)
idx = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       f'{TITLE}\n{FONT}\n<link rel="stylesheet" href="/static/app.css">\n</head>\n<body>\n{body}\n'
       '<script src="/static/engine.js"></script>\n<script src="/static/i18n.js"></script>\n<script src="/static/app.js"></script>\n</body>\n</html>\n')
(FE / "index.html").write_text(idx, encoding="utf-8")
print("built:", {p.name: p.stat().st_size for p in DIST.iterdir()})
