#!/usr/bin/env python3
"""Local Forma server. Run with Python 3.10+: python3 server/garmin_server.py."""
from datetime import date, timedelta
from functools import partial
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import secrets
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('garmin_sync', ROOT / 'dist/forma-garmin-sync.py')
garmin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(garmin)
SESSIONS = {}
LOCK = threading.Lock()
SESSION_SECONDS = 8 * 3600
PORT = 8765
ORIGIN = f'http://127.0.0.1:{PORT}'


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Do not log requests containing personal data.

    def reply(self, status, data, cookie=None):
        body = json.dumps(data, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def session(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
            token = cookies['forma_garmin'].value if 'forma_garmin' in cookies else ''
        except Exception:
            token = ''
        with LOCK:
            for key in list(SESSIONS):
                if SESSIONS[key]['expires'] <= time.monotonic():
                    del SESSIONS[key]
            return token, SESSIONS.get(token)

    def valid_host(self):
        return self.headers.get('Host') == f'127.0.0.1:{PORT}'

    def do_GET(self):
        if not self.valid_host():
            self.reply(403, {'error': 'Open Forma at ' + ORIGIN})
        elif self.path == '/api/garmin/status':
            _, session = self.session()
            self.reply(200, {'connected': session is not None})
        elif self.path.startswith('/api/'):
            self.reply(404, {'error': 'Unknown endpoint.'})
        else:
            super().do_GET()

    def do_POST(self):
        if (not self.valid_host() or self.headers.get('Origin') != ORIGIN
                or self.headers.get('X-Forma-Request') != '1'):
            return self.reply(403, {'error': 'Open Forma at ' + ORIGIN})
        if self.path not in ['/api/garmin/connect', '/api/garmin/sync', '/api/garmin/disconnect']:
            return self.reply(404, {'error': 'Unknown endpoint.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192 or self.headers.get('Content-Type') != 'application/json':
                raise ValueError
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError
        except (ValueError, TypeError):
            return self.reply(400, {'error': 'Invalid request.'})
        session_id, session = self.session()
        if self.path.endswith('/disconnect'):
            with LOCK:
                SESSIONS.pop(session_id, None)
            return self.reply(200, {'connected': False},
                              'forma_garmin=; HttpOnly; SameSite=Strict; Path=/api/garmin; Max-Age=0')
        try:
            if self.path.endswith('/connect'):
                key = body.get('key', '')
                if not isinstance(key, str) or not 10 <= len(key) <= 4096 or not key.isascii() or not key.isprintable() or any(c.isspace() for c in key):
                    return self.reply(400, {'error': 'Enter a valid Garmin Personal API key.'})
                token = garmin.request(garmin.TOKEN, 'ApiKey ' + key, exchange=True)
                # The access token lasts 24h; this shorter local session never stores the key.
                new_id = secrets.token_urlsafe(32)
                with LOCK:
                    SESSIONS.pop(session_id, None)
                    SESSIONS[new_id] = {'token': token, 'expires': time.monotonic() + SESSION_SECONDS,
                                        'busy': False, 'last_request': 0}
                return self.reply(200, {'connected': True},
                    f'forma_garmin={new_id}; HttpOnly; SameSite=Strict; Path=/api/garmin; Max-Age={SESSION_SECONDS}')
            if session is None:
                return self.reply(401, {'error': 'Connect your Garmin key to start a new session.'})
            days = body.get('days', 14)
            end_text = body.get('endDate', '')
            end = date.fromisoformat(end_text)
            if type(days) is not int or not 1 <= days <= 28 or abs((end - date.today()).days) > 1:
                return self.reply(400, {'error': 'Choose 1–28 days ending today.'})
            with LOCK:
                if session['busy'] or time.monotonic() - session['last_request'] < 60:
                    return self.reply(429, {'error': 'Please wait a minute before syncing again.'})
                session['busy'] = True
                session['last_request'] = time.monotonic()
            try:
                data = garmin.snapshot(session['token'], end - timedelta(days=days - 1), end)
                with LOCK:
                    if SESSIONS.get(session_id) is not session:
                        return self.reply(401, {'error': 'This session has disconnected.'})
                return self.reply(200, data)
            finally:
                with LOCK:
                    session['busy'] = False
        except garmin.AuthError:
            with LOCK:
                SESSIONS.pop(session_id, None)
            self.reply(401, {'error': 'Garmin rejected the credential. Check your key and expiry.'})
        except garmin.SyncError as error:
            self.reply(502, {'error': str(error)})
        except (ValueError, TypeError):
            self.reply(400, {'error': 'Invalid date or sync options.'})
        except Exception:
            self.reply(500, {'error': 'Sync could not complete. Please retry.'})


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', PORT), partial(Handler, directory=str(ROOT / 'dist')))
    print(f'Forma is available at {ORIGIN}. Garmin sessions expire after 8 hours or a restart.')
    server.serve_forever()
