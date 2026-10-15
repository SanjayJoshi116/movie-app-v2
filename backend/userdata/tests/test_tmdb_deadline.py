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
        with patch("userdata.tmdb_client.requests.get", return_value=ok) as get, \
                patch("userdata.tmdb_client.requests.post", return_value=ok) as post, \
                patch("userdata.tmdb_client.requests.delete", return_value=ok) as delete:
            tmdb_client._get("/x")
            tmdb_client._post("/x")
            tmdb_client._delete("/x")
        for call in (get, post, delete):
            self.assertEqual(call.call_args.kwargs["timeout"], tmdb_client.TMDB_TIMEOUT)
        self.assertEqual(len(tmdb_client.TMDB_TIMEOUT), 2)
