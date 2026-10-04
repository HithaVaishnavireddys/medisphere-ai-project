"""Zero-dependency HTTP server (Python standard library only), same API as api.py.
Run:  python -m medisphere.server_lite --port 8000"""
import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, urlsplit

from . import routes, services, store
from .config import FRONTEND

SEC_HEADERS = {
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "MediSphere"

    def _send(self, code, payload, ctype="application/json"):
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for k, v in SEC_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _api(self, method):
        u = urlsplit(self.path)
        body = {}
        if method == "POST":
            n = int(self.headers.get("Content-Length", 0) or 0)
            if n > 8_000_000:
                return self._send(413, {"detail": "request too large"})
            try:
                body = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                return self._send(422, {"detail": "invalid JSON"})
        code, out = routes.dispatch(method, u.path, dict(parse_qsl(u.query)), body, dict(self.headers), self.client_address[0])
        self._send(code, out)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            return self._api("GET")
        rel = "index.html" if path in ("/", "") else path.removeprefix("/static/").lstrip("/")
        f = (FRONTEND / rel).resolve()
        if FRONTEND.resolve() in f.parents and f.is_file():
            return self._send(200, f.read_bytes(), mimetypes.guess_type(str(f))[0] or "application/octet-stream")
        self._send(404, {"detail": "not found"})

    def do_POST(self):
        if urlsplit(self.path).path.startswith("/api/"):
            return self._api("POST")
        self._send(404, {"detail": "not found"})

    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    created = store.bootstrap()
    if created:
        print("First run: demo accounts created (change them before real use):", ", ".join(created["users"]))
        print("Initial password:", created["password"])
    services.health()  # warm the retrieval index
    print(f"MediSphere AI running on http://{a.host}:{a.port}")
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
