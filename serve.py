"""Local dev server that tells the browser not to cache, so edits show up on a normal refresh.

Usage: python3 serve.py [port]   (default 8765)
"""
import functools
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoCacheHandler, directory=sys.path[0] or '.')
    with http.server.ThreadingHTTPServer(('', port), handler) as server:
        print(f'Serving on http://localhost:{port}')
        server.serve_forever()
