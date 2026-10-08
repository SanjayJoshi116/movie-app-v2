import logging
import sys
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.logging import RedactingFormatter
from userdata.models import TMDBProfile

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


SESSION_ID = "sess-5f1e2d3c4b5a"


def _revoke_error(*args, **kwargs):
    # What requests raises: the URL (with the key) in the message, plus the session for good measure.
    raise requests.ConnectionError(f"Max retries exceeded with url: {TMDB_URL} session_id={SESSION_ID}")


@override_settings(TMDB_API_KEY=FAKE_KEY)
class TmdbSessionRevokeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lea", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        TMDBProfile.objects.create(user=self.user, session_id=SESSION_ID)

    def _assert_revoke_call(self, delete):
        delete.assert_called_once()
        self.assertTrue(delete.call_args.args[0].endswith("/authentication/session"))
        self.assertEqual(delete.call_args.kwargs["json"], {"session_id": SESSION_ID})

    @patch("userdata.tmdb_client.requests.delete")
    def test_disconnect_revokes_session(self, delete):
        delete.return_value.json.return_value = {"success": True}
        res = self.client.delete("/api/tmdb-auth/disconnect/")
        self.assertEqual(res.data, {"connected": False})
        self._assert_revoke_call(delete)
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "")

    @patch("userdata.tmdb_client.requests.delete", side_effect=_revoke_error)
    def test_tmdb_failure_still_disconnects_and_logs_no_secrets(self, delete):
        with self.assertLogs("userdata.tmdb_client", level="WARNING") as cm:
            res = self.client.delete("/api/tmdb-auth/disconnect/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, {"connected": False})
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "")
        logged = "\n".join(cm.output)
        self.assertIn("ConnectionError", logged)
        for secret in (SESSION_ID, FAKE_KEY):
            self.assertNotIn(secret, logged)

    @patch("userdata.tmdb_client.requests.delete")
    def test_disconnect_without_session_skips_tmdb(self, delete):
        TMDBProfile.objects.filter(user=self.user).update(session_id="")
        self.user.refresh_from_db()  # drop the cached tmdb_profile on the shared force_authenticate user
        res = self.client.delete("/api/tmdb-auth/disconnect/")
        self.assertEqual(res.data, {"connected": False})
        delete.assert_not_called()

    @patch("userdata.tmdb_client.requests.delete")
    def test_account_delete_revokes_before_user_is_gone(self, delete):
        user_existed = []

        def record(*args, **kwargs):
            user_existed.append(User.objects.filter(pk=self.user.pk).exists())
            return Mock(**{"json.return_value": {"success": True}})
        delete.side_effect = record
        res = self.client.delete("/api/auth/delete-account/", {"password": "Xk9#mQ2vTz8p"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self._assert_revoke_call(delete)
        self.assertEqual(user_existed, [True])
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())

    @patch("userdata.tmdb_client.requests.delete", side_effect=_revoke_error)
    def test_account_delete_survives_tmdb_failure(self, _):
        with self.assertLogs("userdata.tmdb_client", level="WARNING"):
            res = self.client.delete("/api/auth/delete-account/", {"password": "Xk9#mQ2vTz8p"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
