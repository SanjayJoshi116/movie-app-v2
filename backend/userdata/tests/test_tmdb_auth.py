import logging
import sys
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.logging import RedactingFormatter

FAKE_KEY = "deadbeefcafe0123456789"
TMDB_URL = f"https://api.themoviedb.org/3/authentication/session/new?api_key={FAKE_KEY}"


def _http_error(*args, **kwargs):
    # Same shape requests produces from raise_for_status(): URL (with key) in the message.
    raise requests.HTTPError(f"401 Client Error: Unauthorized for url: {TMDB_URL}")


@override_settings(TMDB_API_KEY=FAKE_KEY)
class TmdbAuthDisclosureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="kai", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    @patch("userdata.tmdb_client.create_session", side_effect=_http_error)
    def test_create_session_failure_hides_upstream_error(self, _):
        with self.assertLogs("userdata.tmdb_views", level="WARNING"):
            res = self.client.post("/api/tmdb-auth/create-session/", {"request_token": "bad"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        body = res.content.decode()
        for leaked in (FAKE_KEY, "api_key", "themoviedb.org"):
            self.assertNotIn(leaked, body)

    @patch("userdata.tmdb_client.get_request_token", side_effect=_http_error)
    def test_request_token_failure_hides_upstream_error(self, _):
        with self.assertLogs("userdata.tmdb_views", level="WARNING"):
            res = self.client.get("/api/tmdb-auth/request-token/")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertNotIn(FAKE_KEY, res.content.decode())

    @patch("userdata.tmdb_client.create_session", side_effect=_http_error)
    def test_logged_failure_is_redacted(self, _):
        with self.assertLogs("userdata.tmdb_views", level="WARNING") as cm:
            self.client.post("/api/tmdb-auth/create-session/", {"request_token": "bad"}, format="json")
        record = cm.records[0]
        self.assertIn(FAKE_KEY, record.getMessage())  # raw record does carry it...
        formatted = RedactingFormatter().format(record)
        self.assertNotIn(FAKE_KEY, formatted)  # ...the configured formatter strips it
        self.assertIn("***", formatted)

    def test_console_handler_uses_redacting_formatter(self):
        handler = settings.LOGGING["handlers"]["console"]
        formatter = settings.LOGGING["formatters"][handler["formatter"]]
        self.assertEqual(formatter["()"], "userdata.logging.RedactingFormatter")

    def test_redacts_exception_traceback(self):
        try:
            _http_error()
        except requests.HTTPError:
            record = logging.getLogger("x").makeRecord(
                "x", logging.ERROR, __file__, 0, "boom", None, sys.exc_info()
            )
        self.assertNotIn(FAKE_KEY, RedactingFormatter().format(record))

    @patch("userdata.tmdb_client.get_request_token", return_value={"request_token": "tok123"})
    def test_redirect_to_is_one_encoded_param(self, _):
        res = self.client.get("/api/tmdb-auth/request-token/", {"redirect_to": "http://localhost/cb?x=1&foo=bar"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        qs = parse_qs(urlsplit(res.data["redirect_url"]).query)
        self.assertEqual(qs, {"redirect_to": ["http://localhost/cb?x=1&foo=bar"]})
