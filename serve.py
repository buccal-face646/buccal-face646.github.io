"""Local dev server with browser caching disabled.

The stock `python -m http.server` lets the browser cache JS and CSS, so after
editing js/profile.js you can reload and still see the old version. This sends
`Cache-Control: no-store` on every response, so a plain reload always shows
your latest edit.

    python serve.py          # http://localhost:8098
    python serve.py 9000     # pick another port
"""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8098
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    print(f"Serving {ROOT} at http://localhost:{PORT}  (caching disabled)")
    http.server.ThreadingHTTPServer(("", PORT), handler).serve_forever()
