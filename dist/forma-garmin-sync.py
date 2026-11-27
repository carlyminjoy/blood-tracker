#!/usr/bin/env python3
"""Write a rolling Garmin Personal API wellness snapshot for Forma. Python 3.8+.

python3 forma-garmin-sync.py
python3 forma-garmin-sync.py --watch
python3 forma-garmin-sync.py --days 21 --output ~/Downloads/forma-garmin.json

Obtain your own key in Garmin Connect. Enter it at the hidden terminal prompt
or set GARMIN_PERSONAL_API_KEY locally. No keys or bearer tokens are saved.
https://developer.garmin.com/gc-developer-program/personal/personal-api/
https://developer.garmin.com/gc-developer-program/personal/swagger-docs/
"""
import argparse
from datetime import date, datetime, timedelta, timezone
import getpass
from http.client import HTTPException
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import build_opener, HTTPRedirectHandler, ProxyHandler, Request
import warnings

HOST = "https://personal.connectapi.garmin.com"
TOKEN = "/personalapitoken-service/personal-api/personal-api-key/token"
FORMAT = "forma-garmin-personal-v1"
LIMIT = 8 * 1024 * 1024


class SyncError(Exception):
    """Message safe to show locally, with credentials and provider bodies omitted."""


class AuthError(SyncError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(path, auth, exchange=False):
    if not path.startswith("/") or path.startswith("//"):
        raise SyncError("Unexpected request path.")
    req = Request(HOST + path, method="POST" if exchange else "GET",
                  headers={"Accept": "*/*" if exchange else "application/json", "Authorization": auth})
    # Credentials stay between this process and Garmin. Never follow redirects.
    opener = build_opener(ProxyHandler({}), NoRedirect())
    try:
        with opener.open(req, timeout=30) as response:
            if response.status == 204 and not exchange:
                return None
            body = response.read(LIMIT + 1)
        if len(body) > LIMIT:
            raise SyncError("Garmin response exceeded the expected size.")
        if exchange:
            token = body.decode("ascii").strip()
            if len(token.split(".")) != 3 or not token.isprintable() or any(c.isspace() for c in token):
                raise SyncError("Garmin returned an unexpected token format.")
            return token
        return json.loads(body)
    except HTTPError as err:
        if err.code == 401 or (exchange and err.code == 403):
            raise AuthError("Garmin rejected the credential. Check your personal key and expiry.") from None
        raise SyncError("Garmin returned HTTP {}.".format(err.code)) from None
    except (URLError, HTTPException, OSError):
        raise SyncError("Unable to reach Garmin over HTTPS.") from None
    except (ValueError, UnicodeError):
        raise SyncError("Garmin returned an unreadable response.") from None


def nested(data, *keys):
    for key in keys:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data


def numeric(value, low, high):
    if type(value) in (int, float) and math.isfinite(value) and low <= value <= high:
        return value
    return None


def observations(kind, data, start, end):
    if data is None:
        return []
    if kind == "daily":
        data = nested(data, "data")
    elif kind == "hrv":
        data = nested(data, "hrvSummaries")
    if not isinstance(data, list):
        raise SyncError("Garmin returned an unrecognised summary structure.")
    result = []
    for raw in data:
        d = nested(raw, "calendarDate")
        try:
            day = date.fromisoformat(d)
        except (TypeError, ValueError):
            continue
        if not (start <= day <= end) or d != day.isoformat():
            continue
        row = {"date": d}
        if kind == "daily":
            steps = numeric(nested(raw, "movement", "steps", "value"), 0, 500000)
            if steps is not None and steps == int(steps):
                row["steps"] = int(steps)
            rhr = numeric(nested(raw, "heartRate", "restingValue"), 1, 350)
            if rhr is not None:
                row["restingHR"] = rhr
        elif kind == "sleep":
            seconds = numeric(raw.get("sleepTimeSeconds"), 1, 86400)
            if seconds is not None:
                row["sleepHours"] = round(seconds / 3600, 6)
        elif kind == "hrv":
            hrv = numeric(raw.get("lastNightAvg"), 0.01, 2000)
            if hrv is not None:
                row["hrv"] = hrv
        if len(row) > 1:
            result.append(row)
    return result


def snapshot(token, start, end, fetch=request):
    dates = "?startDate={}&endDate={}".format(start, end)
    paths = {"daily": "/usersummary-service/v2/dailysummaries" + dates,
             "sleep": "/sleep-service/sleep/dailySleepSummariesByDate" + dates,
             "hrv": "/hrv-service/hrv/daily/{}/{}".format(start, end)}
    rows, status = {}, {}
    for name, path in paths.items():
        try:
            readings = observations(name, fetch(path, "Bearer " + token), start, end)
        except AuthError:
            raise
        except SyncError as err:
            status[name] = {"status": "error", "message": str(err)}
            continue
        status[name] = {"status": "ok" if readings else "no readings", "days": len({r["date"] for r in readings})}
        for row in readings:
            rows.setdefault(row["date"], {}).update(row)
    if not rows:
        detail = " ".join("{}: {}.".format(k, v.get("message", v["status"]).rstrip(".")) for k, v in status.items())
        raise SyncError("No fresh readings. Existing file retained. " + detail)
    return {"format": FORMAT, "source": "Garmin Connect Personal API",
            "refreshedAt": datetime.now(timezone.utc).isoformat(), "fromDate": start.isoformat(), "toDate": end.isoformat(),
            "units": {"steps": "count", "restingHR": "bpm", "sleepHours": "h", "hrv": "ms (lastNightAvg)"},
            "endpoints": status, "records": [rows[k] for k in sorted(rows)]}


def save(data, path):
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise SyncError("Choose a regular output file.")
    if path.exists():
        try:
            with path.open(encoding="utf8") as old:
                if path.stat().st_size > LIMIT or nested(json.load(old), "format") != FORMAT:
                    raise ValueError
        except (ValueError, UnicodeError):
            raise SyncError("An unrelated file already exists. Choose a different --output name.") from None
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf8", dir=path.parent, delete=False) as f:
            temp = f.name
            json.dump(data, f, indent=2, allow_nan=False)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        if temp and os.path.exists(temp):
            os.unlink(temp)


def main():
    parser = argparse.ArgumentParser(description="Download recent Garmin Personal API wellness data for Forma.")
    parser.add_argument("--days", type=int, default=14, metavar="1-28", help="calendar days including today (default 14)")
    parser.add_argument("--output", type=Path, default=Path("forma-garmin.json"), help="output JSON in an existing directory")
    parser.add_argument("--watch", action="store_true", help="refresh every hour until Ctrl+C")
    args = parser.parse_args()
    if not 1 <= args.days <= 28:
        parser.error("--days must be between 1 and 28.")
    path = args.output.expanduser()
    if not path.parent.is_dir():
        parser.error("Choose an existing output directory.")
    key = os.environ.get("GARMIN_PERSONAL_API_KEY", "").strip()
    if not key:
        if not sys.stdin.isatty():
            parser.error("Run in Terminal to enter a hidden key, or set GARMIN_PERSONAL_API_KEY.")
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            try:
                key = getpass.getpass("Garmin personal API key (hidden): ").strip()
            except (getpass.GetPassWarning, EOFError):
                parser.error("Hidden input requires an interactive Terminal.")
    if not key or not key.isascii() or not key.isprintable() or any(c.isspace() for c in key):
        parser.error("Enter a valid key with no whitespace.")
    token, issued = None, 0
    while True:
        end = date.today()
        start = end - timedelta(days=args.days - 1)
        try:
            if token is None or time.monotonic() - issued >= 23 * 3600:
                token = request(TOKEN, "ApiKey " + key, exchange=True)
                issued = time.monotonic()
            data = snapshot(token, start, end)
            save(data, path)
            print("Saved {} dates to {}.".format(len(data["records"]), path.resolve()), flush=True)
            partial = False
            for name, result in data["endpoints"].items():
                if result["status"] != "ok":
                    print("{}: {}".format(name, result.get("message", result["status"])), file=sys.stderr)
                    partial = partial or result["status"] == "error"
            if not args.watch:
                return 2 if partial else 0
        except AuthError as e:
            print(e, file=sys.stderr)
            return 1
        except (SyncError, OSError) as e:
            print(e, file=sys.stderr)
            if not args.watch or isinstance(e, OSError):
                return 1
        print("Next refresh in one hour. Press Ctrl+C to stop.", flush=True)
        time.sleep(3600)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nSync stopped.", file=sys.stderr)
        sys.exit(130)
