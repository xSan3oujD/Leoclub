import http.server
import socketserver

PORT = 8000

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    pass

Handler = http.server.SimpleHTTPRequestHandler

with ThreadingHTTPServer(("", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
