"""The wall-clock deadline for TMDB calls made while a request waits
(tmdb_client.call_with_deadline). Fakes block on an Event; no real network."""
import threading
import time
from unittest.mock import patch

import requests
from django.test import SimpleTestCase

from userdata import tmdb_client


class CallWithDeadlineTests(SimpleTestCase):
    def setUp(self):
        self.release = threading.Event()
        self.addCleanup(self.release.set)  # never leave a pool thread blocked

    def test_returns_the_result_in_time(self):
        self.assertEqual(tmdb_client.call_with_deadline(lambda x: x * 2, 1, 21), 42)

    def test_overrun_raises_a_requests_timeout(self):
        started = time.monotonic()
        with self.assertRaises(tmdb_client.TMDBDeadlineExceeded) as ctx:
            tmdb_client.call_with_deadline(self.release.wait, 0.2)
        self.assertLess(time.monotonic() - started, 1.5)
        # Existing `except requests.RequestException` handlers catch it.
        self.assertIsInstance(ctx.exception, requests.Timeout)
        self.assertIsInstance(ctx.exception, requests.RequestException)

    def test_errors_from_the_call_pass_through(self):
        def fail():
            raise requests.ConnectionError("reset")
        with self.assertRaises(requests.ConnectionError):
            tmdb_client.call_with_deadline(fail, 1)

    def test_a_queued_call_that_never_started_is_cancelled(self):
        ran = threading.Event()
        # Fill every pool worker, then queue one more with a tiny deadline.
        blockers = [tmdb_client._DEADLINE_POOL.submit(self.release.wait) for _ in range(tmdb_client.DEADLINE_POOL_SIZE)]
        with self.assertRaises(tmdb_client.TMDBDeadlineExceeded):
            tmdb_client.call_with_deadline(ran.set, 0.2)
        self.release.set()
        for b in blockers:
            b.result(timeout=5)
        time.sleep(0.1)
        self.assertFalse(ran.is_set())


class TimeoutTupleTests(SimpleTestCase):
    """Per-attempt (connect, read) instead of a scalar applied to each separately."""

    def test_get_post_delete_use_the_tuple(self):
        ok = type("R", (), {"raise_for_status": lambda self: None, "json": lambda self: {}})()
        with patch("userdata.tmdb_client._session.request", return_value=ok) as request:
            tmdb_client._get("/x")
            tmdb_client._post("/x")
            tmdb_client._delete("/x")
        # Every verb goes through the one shared session, with the tuple.
        self.assertEqual([c.args[0] for c in request.call_args_list], ["GET", "POST", "DELETE"])
        for call in request.call_args_list:
            self.assertEqual(call.kwargs["timeout"], tmdb_client.TMDB_TIMEOUT)
        self.assertEqual(len(tmdb_client.TMDB_TIMEOUT), 2)


class SharedClientTests(SimpleTestCase):
    """fix-tmdb-sweep-b2: every backend call shares the session; malformed bodies are failures."""

    def _answer(self, body):
        return type("R", (), {"raise_for_status": lambda self: None, "json": lambda self: body})()

    def test_non_object_body_is_a_value_error(self):
        with patch("userdata.tmdb_client._session.request", return_value=self._answer([1, 2])), \
                self.assertRaises(ValueError):
            tmdb_client._get("/x")

    def test_malformed_genre_lists_fall_back_to_names(self):
        for body in ({"genres": None}, {"genres": [{"id": 18}]}, {"genres": "x"}, {}):
            with patch("userdata.tmdb_client._session.request", return_value=self._answer(body)):
                self.assertEqual(tmdb_client.get_genre_names("movie"), tmdb_client.STATIC_GENRE_NAMES, body)
        with patch("userdata.tmdb_client._session.request", return_value=self._answer([])):
            self.assertEqual(tmdb_client.get_genre_names("tv"), tmdb_client.STATIC_GENRE_NAMES)

    def test_good_genre_list_is_used(self):
        body = {"genres": [{"id": 18, "name": "Drama"}, {"id": 99}]}
        with patch("userdata.tmdb_client._session.request", return_value=self._answer(body)):
            self.assertEqual(tmdb_client.get_genre_names("movie"), {18: "Drama"})

    def test_null_lists_read_as_empty(self):
        body = {"genres": None, "credits": {"cast": None}, "results": None}
        with patch("userdata.tmdb_client._session.request", return_value=self._answer(body)):
            self.assertEqual(tmdb_client.get_details_with_cast(1, "movie"), {"genre_ids": [], "top_cast": []})
            self.assertEqual(tmdb_client.discover("movie", "18"), [])


class SharedRetryTests(SimpleTestCase):
    def test_a_post_on_a_dropped_pooled_connection_is_retried(self):
        # A pooled connection TMDB already closed fails the POST with a read
        # error; every TMDB write here is safe to resend, so it's retried.
        self.assertIn("POST", tmdb_client.RETRY.allowed_methods)
        self.assertTrue(tmdb_client.RETRY._is_method_retryable("POST"))
        self.assertTrue(tmdb_client.RETRY._is_method_retryable("DELETE"))
