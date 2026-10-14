import logging
import re
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

import requests
from django.conf import settings
from django.core.cache import cache
from django.contrib.auth.models import User
from django.db import DatabaseError
from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from userdata import tmdb_client
from userdata.logging import RedactingFormatter
from userdata.models import TMDBProfile
from userdata.tmdb_views import _request_token_key

FAKE_KEY = "deadbeefcafe0123456789"
TMDB_URL = f"https://api.themoviedb.org/3/authentication/session/new?api_key={FAKE_KEY}"


@contextmanager
def inline_background(test):
    """Run the request's on-commit callbacks, and the background revoke thread
    they start, inline: revokes happen after the local change (account-security)."""
    with patch("userdata.tmdb_client._start_background", side_effect=lambda target, *args: target(*args)), \
            test.captureOnCommitCallbacks(execute=True):
        yield


def _http_error(*args, **kwargs):
    # Same shape requests produces from raise_for_status(): URL (with key) in the message.
    raise requests.HTTPError(f"401 Client Error: Unauthorized for url: {TMDB_URL}")


@override_settings(TMDB_API_KEY=FAKE_KEY)
class TmdbAuthDisclosureTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="kai", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        # The create-session failure tests need a token this user was issued.
        cache.set(_request_token_key(self.user.id), "bad", 3600)

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
        with inline_background(self):
            res = self.client.delete("/api/tmdb-auth/disconnect/")
        self.assertEqual(res.data, {"connected": False})
        self._assert_revoke_call(delete)
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "")

    @patch("userdata.tmdb_client.requests.delete", side_effect=_revoke_error)
    def test_tmdb_failure_still_disconnects_and_logs_no_secrets(self, delete):
        with self.assertLogs("userdata.tmdb_client", level="WARNING") as cm, inline_background(self):
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
    def test_account_delete_revokes_after_user_is_gone(self, delete):
        user_existed = []

        def record(*args, **kwargs):
            user_existed.append(User.objects.filter(pk=self.user.pk).exists())
            return Mock(**{"json.return_value": {"success": True}})
        delete.side_effect = record
        with inline_background(self):
            res = self.client.delete("/api/auth/delete-account/", {"password": "Xk9#mQ2vTz8p"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self._assert_revoke_call(delete)
        # Deleted first: a slow or failing TMDB can't stop the deletion.
        self.assertEqual(user_existed, [False])
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())

    @patch("userdata.tmdb_client.requests.delete", side_effect=_revoke_error)
    def test_account_delete_survives_tmdb_failure(self, _):
        with self.assertLogs("userdata.tmdb_client", level="WARNING"), inline_background(self):
            res = self.client.delete("/api/auth/delete-account/", {"password": "Xk9#mQ2vTz8p"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())


@override_settings(TMDB_API_KEY=FAKE_KEY)
class TmdbConnectBindingTests(APITestCase):
    """A session is created only from the token issued to the requesting user, once."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="mia", password="Xk9#mQ2vTz8p")
        self.other = User.objects.create_user(username="eve", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _issue(self, user, token):
        self.client.force_authenticate(user=user)
        with patch("userdata.tmdb_client.get_request_token", return_value={"request_token": token}):
            res = self.client.get("/api/tmdb-auth/request-token/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=self.user)

    def _create(self, token):
        return self.client.post("/api/tmdb-auth/create-session/", {"request_token": token}, format="json")

    @patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"})
    def test_normal_connect(self, create):
        self._issue(self.user, "tok-mine")
        res = self._create("tok-mine")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        create.assert_called_once_with("tok-mine")
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-new")

    @patch("userdata.tmdb_client.create_session")
    def test_token_issued_to_another_user_is_refused(self, create):
        TMDBProfile.objects.create(user=self.user, session_id="sess-own")
        self._issue(self.other, "tok-attacker")
        res = self._create("tok-attacker")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Connect again", res.data["error"])
        create.assert_not_called()
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-own")

    @patch("userdata.tmdb_client.create_session")
    def test_token_never_issued_is_refused(self, create):
        res = self._create("tok-forged")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        create.assert_not_called()
        self.assertFalse(TMDBProfile.objects.filter(user=self.user).exists())

    @patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"})
    def test_replay_is_refused(self, create):
        self._issue(self.user, "tok-mine")
        self.assertEqual(self._create("tok-mine").status_code, status.HTTP_200_OK)
        self.assertEqual(self._create("tok-mine").status_code, status.HTTP_400_BAD_REQUEST)
        create.assert_called_once()

    @patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"})
    def test_only_latest_issued_token_counts(self, create):
        self._issue(self.user, "tok-old")
        self._issue(self.user, "tok-new")
        self.assertEqual(self._create("tok-old").status_code, status.HTTP_400_BAD_REQUEST)
        create.assert_not_called()

    @patch("userdata.tmdb_client.create_session")
    def test_expired_token_is_refused(self, create):
        self._issue(self.user, "tok-mine")
        cache.delete(_request_token_key(self.user.id))  # what the 60-minute TTL does
        self.assertEqual(self._create("tok-mine").status_code, status.HTTP_400_BAD_REQUEST)
        create.assert_not_called()

    def test_token_ttl_matches_tmdb(self):
        with (
            patch("userdata.tmdb_client.get_request_token", return_value={"request_token": "t"}),
            patch("userdata.tmdb_views.cache.set") as cache_set,
        ):
            self.client.get("/api/tmdb-auth/request-token/")
        cache_set.assert_any_call(_request_token_key(self.user.id), "t", 3600)

    @patch("userdata.tmdb_client.requests.delete")
    @patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"})
    def test_reconnect_revokes_previous_session(self, _, delete):
        delete.return_value.json.return_value = {"success": True}
        TMDBProfile.objects.create(user=self.user, session_id="sess-old")
        self._issue(self.user, "tok-mine")
        with inline_background(self):
            self.assertEqual(self._create("tok-mine").status_code, status.HTTP_200_OK)
        delete.assert_called_once()
        self.assertEqual(delete.call_args.kwargs["json"], {"session_id": "sess-old"})
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-new")

    @patch("userdata.tmdb_client.requests.delete", side_effect=requests.ConnectionError("down"))
    @patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"})
    def test_failed_revoke_does_not_block_reconnect(self, *_):
        TMDBProfile.objects.create(user=self.user, session_id="sess-old")
        self._issue(self.user, "tok-mine")
        with self.assertLogs("userdata.tmdb_client", level="WARNING") as cm, inline_background(self):
            res = self._create("tok-mine")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-new")
        self.assertNotIn("sess-old", "\n".join(cm.output))


@override_settings(TMDB_API_KEY=FAKE_KEY)
class TmdbLocalChangeFirstTests(APITestCase):
    """account-security: the stored session is never one that was revoked, and
    no request waits on a TMDB revoke. endpoint-time-budgets: connect is bounded."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="ola", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        self.release = threading.Event()
        self.addCleanup(self.release.set)  # never leave a pool thread blocked

    def _issue(self, token):
        with patch("userdata.tmdb_client.get_request_token", return_value={"request_token": token}):
            self.client.get("/api/tmdb-auth/request-token/")

    def _create(self, token):
        return self.client.post("/api/tmdb-auth/create-session/", {"request_token": token}, format="json")

    @patch("userdata.tmdb_client.requests.delete")
    @patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"})
    def test_reconnect_revokes_only_after_the_new_session_is_committed(self, _, delete):
        TMDBProfile.objects.create(user=self.user, session_id="sess-old")
        self._issue("tok")
        with patch("userdata.tmdb_client._start_background") as start, \
                self.captureOnCommitCallbacks(execute=False) as callbacks:
            res = self._create("tok")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        start.assert_not_called()  # nothing revoked inside the request
        delete.assert_not_called()
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-new")
        self.assertEqual(len(callbacks), 1)

    @patch("userdata.tmdb_client.requests.delete")
    @patch("userdata.tmdb_client.create_session", return_value={"session_id": "sess-new"})
    def test_failed_save_on_reconnect_revokes_nothing(self, _, delete):
        TMDBProfile.objects.create(user=self.user, session_id="sess-old")
        self._issue("tok")
        with patch.object(TMDBProfile, "save", side_effect=DatabaseError("down")), inline_background(self):
            res = self._create("tok")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        delete.assert_not_called()
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-old")

    @patch("userdata.tmdb_client.TMDB_CALL_DEADLINE", 0.3)
    def test_create_session_hanging_returns_502_in_time_and_keeps_the_session(self):
        TMDBProfile.objects.create(user=self.user, session_id="sess-old")
        self._issue("tok")
        with patch("userdata.tmdb_client.create_session", side_effect=lambda *a: self.release.wait(10)):
            started = time.monotonic()
            res = self._create("tok")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(res.data, {"error": "Couldn't reach TMDB. Try again."})
        self.assertLess(time.monotonic() - started, 2)
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "sess-old")

    @patch("userdata.tmdb_client.TMDB_CALL_DEADLINE", 0.3)
    def test_request_token_hanging_returns_502_in_time(self):
        with patch("userdata.tmdb_client.get_request_token", side_effect=lambda: self.release.wait(10)):
            started = time.monotonic()
            res = self.client.get("/api/tmdb-auth/request-token/")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertLess(time.monotonic() - started, 2)

    def test_disconnect_and_delete_never_wait_on_a_hanging_revoke(self):
        TMDBProfile.objects.create(user=self.user, session_id="sess-old")

        entered = threading.Semaphore(0)

        def hanging_delete(*args, **kwargs):
            entered.release()
            self.release.wait(10)
            return Mock(**{"json.return_value": {"success": True}})

        def hang():
            return patch("userdata.tmdb_client.requests.delete", side_effect=hanging_delete)

        def request_then_commit(send):
            """Send the request, then run its on-commit callbacks (what autocommit
            does at once in production): neither may wait on the hanging revoke."""
            with hang():
                with self.captureOnCommitCallbacks(execute=False) as callbacks:
                    started = time.monotonic()
                    res = send()
                for callback in callbacks:
                    callback()
                self.assertLess(time.monotonic() - started, 2)
                # The background revoke is now inside the fake, so it can't
                # reach the real network after the patch ends.
                self.assertTrue(entered.acquire(timeout=5))
            return res

        self.client.get("/api/tmdb-auth/status/")  # warm up: the first request loads the URLconf
        res = request_then_commit(lambda: self.client.delete("/api/tmdb-auth/disconnect/"))
        self.assertEqual(res.data, {"connected": False})
        self.assertEqual(TMDBProfile.objects.get(user=self.user).session_id, "")

        TMDBProfile.objects.filter(user=self.user).update(session_id="sess-2")
        self.user.refresh_from_db()
        res = request_then_commit(
            lambda: self.client.delete("/api/auth/delete-account/", {"password": "Xk9#mQ2vTz8p"}, format="json")
        )
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())


class TmdbConnectBudgetTests(SimpleTestCase):
    def test_connect_endpoints_fit_under_gunicorn_timeout(self):
        entrypoint = (Path(__file__).resolve().parents[2] / "docker-entrypoint.sh").read_text()
        timeout = int(re.search(r"gunicorn .*--timeout (\d+)", entrypoint).group(1))
        # One bounded TMDB call per request; the revoke runs after it, in the background.
        self.assertLessEqual(tmdb_client.TMDB_CALL_DEADLINE, timeout - 10)

