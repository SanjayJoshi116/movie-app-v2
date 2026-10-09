import io
import logging
from contextlib import contextmanager
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APITestCase

from userdata.logging import RedactingFormatter

FAKE_KEY = "deadbeefcafe0123456789"


@contextmanager
def captured_console():
    """Point the configured root redacting handler at a buffer for one test."""
    handler = next(
        h for h in logging.getLogger().handlers if isinstance(h.formatter, RedactingFormatter)
    )
    buf = io.StringIO()
    old = handler.setStream(buf)
    try:
        yield buf
    finally:
        handler.setStream(old)


@override_settings(TMDB_API_KEY=FAKE_KEY, DEBUG=False)
class LoggingRedactionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lin", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_third_party_warning_is_redacted(self):
        # Same shape urllib3's HTTPConnectionPool.urlopen logs on every retry.
        with captured_console() as buf:
            logging.getLogger("urllib3.connectionpool").warning(
                "Retrying (%r) after connection broken by '%r': %s",
                "Retry(total=1)", "ReadTimeoutError()", f"/3/movie/550?api_key={FAKE_KEY}",
            )
        out = buf.getvalue()
        self.assertIn("Retrying", out)
        self.assertIn("api_key=***", out)
        self.assertNotIn(FAKE_KEY, out)

    @patch("userdata.tmdb_client.get_request_token", side_effect=RuntimeError(f"boom api_key={FAKE_KEY}"))
    def test_unhandled_500_is_logged_redacted_in_production(self, _):
        self.client.raise_request_exception = False
        with captured_console() as buf:
            res = self.client.get("/api/tmdb-auth/request-token/")
        self.assertEqual(res.status_code, 500)
        out = buf.getvalue()
        self.assertIn("/api/tmdb-auth/request-token/", out)
        self.assertIn("Traceback", out)
        self.assertIn("RuntimeError: boom api_key=***", out)
        self.assertNotIn(FAKE_KEY, out)

    def test_client_errors_are_not_logged(self):
        with captured_console() as buf:
            not_found = self.client.get("/api/no-such-endpoint/")
            self.client.force_authenticate(user=None)
            unauthorized = self.client.get("/api/watchlist/")
        self.assertEqual(not_found.status_code, 404)
        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(buf.getvalue(), "")

    def test_every_handler_redacts(self):
        formatters = settings.LOGGING["formatters"]
        for name, handler in settings.LOGGING["handlers"].items():
            with self.subTest(handler=name):
                self.assertEqual(
                    formatters[handler["formatter"]]["()"], "userdata.logging.RedactingFormatter"
                )
        self.assertEqual(settings.LOGGING["root"]["handlers"], ["console"])


class CredentialRedactionTests(APITestCase):
    def _format(self, msg):
        record = logging.getLogger("x").makeRecord("x", logging.WARNING, __file__, 0, msg, None, None)
        return RedactingFormatter().format(record)

    def test_session_id_query_param(self):
        out = self._format("401 for url: https://api.tmdb.org/3/movie/1/rating?session_id=SECRET123&x=1")
        self.assertNotIn("SECRET123", out)
        self.assertIn("session_id=***&x=1", out)

    def test_request_token_query_param(self):
        out = self._format("GET /tmdb-callback?request_token=TOKEN456&approved=true")
        self.assertNotIn("TOKEN456", out)

    def test_json_body_value(self):
        out = self._format('payload {"session_id": "SECRET789"}')
        self.assertNotIn("SECRET789", out)

    def test_unrelated_text_unchanged(self):
        self.assertEqual(self._format("a_session_idea=1 is fine"), "a_session_idea=1 is fine")

    @patch("userdata.tmdb_proxy_views._session.get", side_effect=__import__("requests").ConnectionError(
        "Max retries exceeded with url: /3/account?session_id=PROXYSECRET"
    ))
    def test_proxy_failure_with_session_param_is_redacted(self, _):
        with captured_console() as buf:
            self.client.get("/api/tmdb/account", {"session_id": "PROXYSECRET"})
        logged = buf.getvalue()
        self.assertIn("tmdb_proxy request failed", logged)
        self.assertNotIn("PROXYSECRET", logged)
