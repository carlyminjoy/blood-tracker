from datetime import date
from functools import partial
import http.client
import json
import threading
import unittest
from unittest.mock import patch

import garmin_server as app


class ConnectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = app.ThreadingHTTPServer(('127.0.0.1', 0),
            partial(app.Handler, directory=str(app.ROOT / 'dist')))
        app.PORT = cls.server.server_port
        app.ORIGIN = f'http://127.0.0.1:{app.PORT}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        app.SESSIONS.clear()

    def request(self, path, body=None, cookie='', origin=None):
        client = http.client.HTTPConnection('127.0.0.1', app.PORT)
        headers = {'Cookie': cookie, 'Origin': origin or app.ORIGIN,
                   'X-Forma-Request': '1', 'Content-Type': 'application/json'}
        client.request('POST' if body is not None else 'GET', path,
                       json.dumps(body) if body is not None else None, headers)
        response = client.getresponse()
        status, cookie = response.status, response.getheader('Set-Cookie', '')
        data = json.loads(response.read())
        client.close()
        return status, cookie, data

    @patch.object(app.garmin, 'request', return_value='mock.access.token')
    def test_session_sync_disconnect(self, exchange):
        status, cookie, data = self.request('/api/garmin/connect', {'key': 'personal-test-key'})
        self.assertEqual(status, 200)
        self.assertIn('HttpOnly', cookie)
        self.assertNotIn('personal-test-key', repr(app.SESSIONS))
        self.assertTrue(self.request('/api/garmin/status', cookie=cookie)[2]['connected'])
        self.assertFalse(self.request('/api/garmin/status')[2]['connected'])
        with patch.object(app.garmin, 'snapshot', return_value={'records': [{'date': date.today().isoformat(), 'steps': 2500}]}):
            body = {'days': 14, 'endDate': date.today().isoformat()}
            self.assertEqual(self.request('/api/garmin/sync', body, cookie)[0], 200)
            self.assertEqual(self.request('/api/garmin/sync', body, cookie)[0], 429)
        self.assertEqual(self.request('/api/garmin/disconnect', {}, cookie)[0], 200)
        self.assertEqual(len(app.SESSIONS), 0)
        self.assertEqual(self.request('/api/garmin/sync', body, cookie)[0], 401)

    def test_cross_origin_rejected(self):
        self.assertEqual(self.request('/api/garmin/connect', {'key': 'personal-test-key'},
                                      origin='https://untrusted.example')[0], 403)

    @patch.object(app.garmin, 'request', side_effect=app.garmin.AuthError('private detail'))
    def test_auth_failure_redacted(self, exchange):
        status, _, data = self.request('/api/garmin/connect', {'key': 'personal-test-key'})
        self.assertEqual(status, 401)
        self.assertNotIn('private detail', json.dumps(data))
        self.assertEqual(len(app.SESSIONS), 0)

    def test_partial_sync(self):
        today = date.today()
        def fetch(path, auth):
            if 'dailysummaries' in path:
                return {'data': [{'calendarDate': today.isoformat(), 'movement': {'steps': {'value': 0}}, 'heartRate': {'restingValue': 48}}]}
            if 'sleep' in path:
                return [{'calendarDate': today.isoformat(), 'sleepTimeSeconds': 28800}]
            raise app.garmin.SyncError('Garmin returned HTTP 429.')
        result = app.garmin.snapshot('token', today, today, fetch)
        self.assertEqual(result['records'][0]['steps'], 0)
        self.assertEqual(result['records'][0]['sleepHours'], 8)
        self.assertEqual(result['endpoints']['hrv']['status'], 'error')
