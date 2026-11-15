#!/usr/bin/env python3
"""Preview the canonical website folder. No build step or external packages."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
from functools import partial
import argparse, http.server, ssl
from preview_range import RangeRequestHandler
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8080)
parser.add_argument('--tls-dir', type=Path)
args = parser.parse_args()
class Preview(RangeRequestHandler):
    def send_head(self):
        if any(part.startswith('.') for part in unquote(urlsplit(self.path).path).split('/') if part):
            self.send_error(403, 'Private project files are not served')
            return None
        return super().send_head()
server = http.server.ThreadingHTTPServer(('0.0.0.0', args.port), partial(Preview, directory=str(ROOT)))
if args.tls_dir:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(str(args.tls_dir/'server.pem'), str(args.tls_dir/'server-key.pem'))
    server.socket = context.wrap_socket(server.socket, server_side=True)
print('The Visitor preview: '+('https' if args.tls_dir else 'http')+'://127.0.0.1:'+str(args.port)+'/writing/the-visitor/chapter-one/?v=22',flush=True)
try: server.serve_forever()
except KeyboardInterrupt: pass
finally: server.server_close()
