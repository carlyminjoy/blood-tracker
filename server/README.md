# Garmin Personal API connection

Run from the repository root using Python 3.10 or newer:

```sh
python3 server/garmin_server.py
```

Open http://127.0.0.1:8765 and select Data sources → Set up Garmin sync.
Create a personal key using the linked official Garmin instructions, paste it
into the password field, and select Connect. The first sync imports 14 days.
Choose 7, 14, or 28 days for subsequent manual syncs.

The server reuses `dist/forma-garmin-sync.py` for Garmin requests and response
mapping. It exchanges the key for an access token and discards the key. Tokens
are held only in process memory for an eight-hour session. Disconnect or restart
the server to clear a session. No credentials are written to localStorage or disk.
The browser holds an opaque HttpOnly, SameSite session cookie. Sessions are
isolated, mutations require the exact local Origin and a custom header, and the
server binds only to 127.0.0.1 with Host validation. Do not expose this local
development server to the internet. Production hosting requires authenticated
users, HTTPS, and a suitable secret/session store.

Imported health readings use the app's existing browser persistence and date
merge logic. A local origin has separate browser storage from the hosted site.
Partial Garmin failures preserve existing readings and report the failed data
groups. Sync requests are limited to once per minute per session.

The static Sites deployment retains file sync as a fallback. Direct connection
requires this local server. A live Garmin account/key is required to verify real
provider access. The automated tests use representative mocked API responses.

```sh
python3 -m unittest discover -s server -p 'test_*.py'
```

Official API documentation:
https://developer.garmin.com/gc-developer-program/personal/personal-api/
https://developer.garmin.com/gc-developer-program/personal/swagger-docs/
