"""
Tiny mirror for electron-builder binaries.

Serves our patched winCodeSign archive (without the macOS symlink files that
Windows refuses to extract) locally, and 302-redirects every other artifact
(nsis, nsis-resources, ...) to the real GitHub release.

Used only at build time via ELECTRON_BUILDER_BINARIES_MIRROR.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8788
SERVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "serve")
SERVE_DIR = os.path.abspath(SERVE_DIR)
GITHUB_BASE = "https://github.com/electron-userland/electron-builder-binaries/releases/download"


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        rel = self.path.lstrip("/")
        local_path = os.path.join(SERVE_DIR, rel)
        if os.path.isfile(local_path):
            with open(local_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            sys.stdout.write("LOCAL  %s\n" % self.path)
            sys.stdout.flush()
        else:
            target = GITHUB_BASE + self.path
            self.send_response(302)
            self.send_header("Location", target)
            self.end_headers()
            sys.stdout.write("PROXY  %s -> %s\n" % (self.path, target))
            sys.stdout.flush()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        sys.stdout.write("eb-mirror serving %s on http://127.0.0.1:%d\n" % (SERVE_DIR, PORT))
        sys.stdout.flush()
        httpd.serve_forever()
