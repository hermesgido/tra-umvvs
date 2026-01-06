
import json
import mimetypes
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


BASE_UPSTREAM = "https://taxpayerportal.tra.go.tz/umvvs-api/ExternalCalculator"


def _read_file_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


class Handler(BaseHTTPRequestHandler):
    def _send_cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            file_path = os.path.join(os.getcwd(), "index.html")
            if not os.path.exists(file_path):
                self.send_response(404)
                self._send_cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "index.html not found"}).encode("utf-8"))
                return
            data = _read_file_bytes(file_path)
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if path.startswith("/umvvs/"):
            endpoint = path[len("/umvvs/") :]
            upstream_url = f"{BASE_UPSTREAM}/{endpoint}"
            if parsed.query:
                upstream_url = f"{upstream_url}?{parsed.query}"

            req = urllib.request.Request(
                upstream_url,
                headers={
                    "User-Agent": "trakodi-umvvs-proxy/1.0",
                    "Accept": "application/json, text/plain, */*",
                },
            )

            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    body = r.read()
                    status = r.status
                    content_type = r.headers.get("Content-Type") or "application/json; charset=utf-8"
            except urllib.error.HTTPError as e:
                body = e.read() if e.fp else b""
                status = e.code
                content_type = e.headers.get("Content-Type") if e.headers else "application/json; charset=utf-8"
            except Exception as e:
                payload = json.dumps({"error": str(e), "upstream": upstream_url}).encode("utf-8")
                self.send_response(502)
                self._send_cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            self.send_response(status)
            self._send_cors()
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        file_path = os.path.join(os.getcwd(), path.lstrip("/"))
        if os.path.isfile(file_path):
            data = _read_file_bytes(file_path)
            mime, _ = mimetypes.guess_type(file_path)
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", (mime or "application/octet-stream") + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_response(404)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Not found", "path": path}).encode("utf-8"))


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
