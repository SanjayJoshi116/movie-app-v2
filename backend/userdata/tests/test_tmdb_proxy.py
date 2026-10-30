import ipaddress
import re
import socket
import threading
import time
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from django.contrib.auth.models import User
from django.conf import settings
from django.core.cache import cache, caches
from django.db import Error as DatabaseError
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from userdata import tmdb_client, tmdb_proxy_views


@patch.object(tmdb_proxy_views.TmdbProxyThrottle, "rate", "2/min", create=True)
@patch("userdata.tmdb_proxy_views._session.get")
class TmdbProxyThrottleIdentityTests(APITestCase):
    """The TMDB client sends the JWT, so users behind one NAT get their own bucket."""

    NAT = str(ipaddress.IPv4Address(3000))  # synthetic: one shared public address

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def _get(self, token=None):
        headers = {"REMOTE_ADDR": self.NAT}
        if token:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return self.client.get("/api/tmdb/movie/550", **headers).status_code

    def _token(self, username):
        user = User.objects.create_user(username=username, password="Xk9#mQ2vTz8p")
        return str(RefreshToken.for_user(user).access_token)

    def _ok(self, mock_get):
        mock_get.return_value = Mock(status_code=200, **{"json.return_value": {"id": 550}})

    def test_signed_in_users_on_one_ip_have_separate_buckets(self, mock_get):
        self._ok(mock_get)
        alice, bob = self._token("alice"), self._token("bob")
        self.assertEqual([self._get(alice) for _ in range(3)], [200, 200, 429])
        self.assertEqual([self._get(bob) for _ in range(2)], [200, 200])

    def test_signed_out_requests_share_the_ip_bucket(self, mock_get):
        self._ok(mock_get)
        self.assertEqual([self._get() for _ in range(3)], [200, 200, 429])


class TmdbProxyTests(APITestCase):
    @patch("userdata.tmdb_proxy_views._session.get")
    def test_connection_failure_returns_clean_502(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("boom")

        res = self.client.get("/api/tmdb/movie/550")

        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(res.data, {"error": "TMDB request failed."})

    @patch("userdata.tmdb_proxy_views._session.get")
    def test_successful_request_is_passed_through(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {"id": 550, "title": "Fight Club"}
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        res = self.client.get("/api/tmdb/movie/550")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, {"id": 550, "title": "Fight Club"})

    @patch("userdata.tmdb_proxy_views._session.get")
    def test_unresponsive_tmdb_returns_502_with_bounded_timeout(self, mock_get):
        mock_get.side_effect = requests.ReadTimeout("no response")

        res = self.client.get("/api/tmdb/movie/550")

        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(
            mock_get.call_args.kwargs["timeout"],
            tmdb_proxy_views.TMDB_TIMEOUT,
        )


def _gunicorn_timeout():
    entrypoint = (Path(__file__).resolve().parents[2] / "docker-entrypoint.sh").read_text()
    match = re.search(r"gunicorn .*--timeout (\d+)", entrypoint)
    assert match, "docker-entrypoint.sh must set gunicorn --timeout explicitly"
    return int(match.group(1))


class TmdbProxyTimeBudgetTests(SimpleTestCase):
    def test_deadline_fits_under_gunicorn_timeout(self):
        # 5s headroom for the view itself, JSON parsing, and the response write.
        self.assertLessEqual(tmdb_proxy_views.PROXY_DEADLINE_SECONDS, _gunicorn_timeout() - 5)

    def test_session_uses_the_budgeted_retry(self):
        adapter = tmdb_proxy_views._session.get_adapter("https://api.themoviedb.org/3/movie/550")
        self.assertIs(adapter.max_retries, tmdb_client.RETRY)
        self.assertIs(tmdb_proxy_views._session, tmdb_client._session)  # one session for every TMDB call


class TmdbProxyDeadlineTests(APITestCase):
    """The bound is elapsed time for the whole call, not a model of attempts."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        caches["tmdb"].clear()

    @patch.object(tmdb_proxy_views, "PROXY_DEADLINE_SECONDS", 0.3)
    def test_hanging_fetch_returns_502_within_the_deadline_and_isnt_cached(self):
        release = threading.Event()
        self.addCleanup(release.set)
        with patch("userdata.tmdb_proxy_views._session.get", side_effect=lambda *a, **k: release.wait(10)):
            started = time.monotonic()
            res = self.client.get("/api/tmdb/movie/550")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertLess(time.monotonic() - started, 2)
        self.assertEqual(caches["tmdb"].get(tmdb_proxy_views._cache_key("movie/550", [])), None)

    @patch.object(tmdb_proxy_views, "PROXY_DEADLINE_SECONDS", 0.5)
    def test_connect_hanging_on_every_resolved_address_still_returns_502_in_time(self):
        # The real urllib3 connect loop: four addresses, each attempt slow to
        # fail. Attempts x addresses x delay is well past the deadline.
        addresses = [str(ipaddress.IPv4Address(4000 + i)) for i in range(4)]
        infos = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (a, 443)) for a in addresses]
        tried = []
        done = threading.Event()
        real_get = tmdb_proxy_views._session.get
        real_getaddrinfo, real_connect = socket.getaddrinfo, socket.socket.connect

        # Only the TMDB call's own thread gets the fakes; anything else in the
        # test process that resolves or connects keeps the real functions.
        def in_tmdb_thread():
            return threading.current_thread().name.startswith("tmdb-proxy")

        def fake_getaddrinfo(*args, **kwargs):
            return infos if in_tmdb_thread() else real_getaddrinfo(*args, **kwargs)

        def slow_connect(sock, addr):
            if not in_tmdb_thread():
                return real_connect(sock, addr)
            tried.append(addr[0])
            time.sleep(0.2)
            raise TimeoutError("timed out")

        def tracked_get(*args, **kwargs):
            try:
                return real_get(*args, **kwargs)
            finally:
                done.set()

        # Load the URLconf and its view modules (scikit-learn, scipy) first: a
        # cold import on the first request takes seconds and isn't the call's time.
        self.assertEqual(self.client.get("/api/tmdb/movie/..").status_code, 400)
        with patch("socket.getaddrinfo", fake_getaddrinfo), \
                patch("socket.socket.connect", slow_connect), \
                patch("userdata.tmdb_proxy_views._session.get", side_effect=tracked_get):
            started = time.monotonic()
            res = self.client.get("/api/tmdb/movie/550")
            elapsed = time.monotonic() - started
            # Keep the fakes in place until the abandoned call has finished, so
            # it can never reach the real network.
            self.assertTrue(done.wait(15))

        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertLess(elapsed, 2)
        self.assertGreaterEqual(len(set(tried)), 2)  # it really walked the addresses


@patch("userdata.tmdb_proxy_views._session.get")
class TmdbProxyCacheTests(APITestCase):
    """Successful responses are reused across requests and users (tmdb-proxy-cache spec)."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def _ok(self, mock_get, body=None, status_code=200):
        mock_get.return_value = Mock(status_code=status_code, **{"json.return_value": body or {"id": 550}})

    def test_repeat_request_is_served_from_the_cache(self, mock_get):
        self._ok(mock_get, {"id": 550, "title": "Fight Club"})
        first = self.client.get("/api/tmdb/movie/550?append_to_response=credits")
        second = self.client.get("/api/tmdb/movie/550?append_to_response=credits")
        self.assertEqual(mock_get.call_count, 1)
        self.assertEqual((second.status_code, second.data), (200, {"id": 550, "title": "Fight Club"}))
        self.assertEqual((first["X-Cache"], second["X-Cache"]), ("MISS", "HIT"))

    def test_different_params_are_fetched_separately(self, mock_get):
        self._ok(mock_get)
        self.client.get("/api/tmdb/discover/movie?page=1")
        self.client.get("/api/tmdb/discover/movie?page=2")
        self.assertEqual(mock_get.call_count, 2)

    def test_client_api_key_does_not_split_or_poison_the_key(self, mock_get):
        self._ok(mock_get)
        self.client.get("/api/tmdb/movie/550")
        self.client.get("/api/tmdb/movie/550?api_key=abc")
        self.assertEqual(mock_get.call_count, 1)

    def test_error_responses_are_not_cached(self, mock_get):
        for code in (404, 429, 500):
            mock_get.reset_mock()
            self._ok(mock_get, {"status_code": 34}, status_code=code)
            self.assertEqual(self.client.get(f"/api/tmdb/movie/{code}").status_code, code)
            self._ok(mock_get)
            self.assertEqual(self.client.get(f"/api/tmdb/movie/{code}").status_code, 200)
            self.assertEqual(mock_get.call_count, 2, code)

    def test_upstream_failure_is_not_cached(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("boom")
        self.assertEqual(self.client.get("/api/tmdb/movie/550").status_code, 502)
        mock_get.side_effect = None
        self._ok(mock_get)
        self.assertEqual(self.client.get("/api/tmdb/movie/550").status_code, 200)
        self.assertEqual(mock_get.call_count, 2)

    def test_session_id_bypasses_the_cache(self, mock_get):
        self._ok(mock_get)
        for params in ({"session_id": "S"}, {"guest_session_id": "G"}):
            mock_get.reset_mock()
            a = self.client.get("/api/tmdb/movie/550/account_states", params)
            self.client.get("/api/tmdb/movie/550/account_states", params)
            self.assertEqual(mock_get.call_count, 2, params)
            self.assertEqual(a["X-Cache"], "BYPASS")
        key = tmdb_proxy_views._cache_key("movie/550/account_states", [("session_id", "S")])
        self.assertIsNone(caches["tmdb"].get(key))

    def test_account_paths_bypass_the_cache(self, mock_get):
        self._ok(mock_get)
        self.client.get("/api/tmdb/account")
        self.client.get("/api/tmdb/account")
        self.assertEqual(mock_get.call_count, 2)

    def test_entries_are_stored_with_their_tier_ttl(self, mock_get):
        self._ok(mock_get)
        with patch.object(caches["tmdb"], "set", wraps=caches["tmdb"].set) as cache_set:
            for path in ("trending/movie/week", "genre/movie/list", "movie/550"):
                self.client.get(f"/api/tmdb/{path}")
        self.assertEqual([c.args[2] for c in cache_set.call_args_list], [
            tmdb_proxy_views.LIST_TTL, tmdb_proxy_views.STATIC_TTL, tmdb_proxy_views.DETAIL_TTL,
        ])

    def test_cache_hits_still_count_against_the_throttle(self, mock_get):
        self._ok(mock_get)
        with patch.object(tmdb_proxy_views.TmdbProxyThrottle, "rate", "2/min", create=True):
            codes = [self.client.get("/api/tmdb/movie/550").status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])
        self.assertEqual(mock_get.call_count, 1)

    def test_cache_backend_errors_fall_through_to_tmdb(self, mock_get):
        self._ok(mock_get)
        with patch.object(caches["tmdb"], "get", side_effect=DatabaseError("no table")), \
                patch.object(caches["tmdb"], "set", side_effect=DatabaseError("no table")):
            res = self.client.get("/api/tmdb/movie/550")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(mock_get.call_count, 1)


class TmdbProxyCacheTtlTests(SimpleTestCase):
    def test_lifetime_tiers(self):
        ttl = tmdb_proxy_views.cache_ttl
        for path in ("trending/all/day", "discover/tv", "search/movie", "movie/popular", "movie/now_playing",
                     "movie/upcoming", "movie/top_rated", "tv/airing_today", "tv/on_the_air", "person/popular"):
            self.assertEqual(ttl(path), tmdb_proxy_views.LIST_TTL, path)
        for path in ("genre/movie/list", "genre/tv/list", "configuration", "configuration/languages"):
            self.assertEqual(ttl(path), tmdb_proxy_views.STATIC_TTL, path)
        for path in ("movie/550", "movie/550/similar", "tv/1399/season/1", "person/287", "movie/popularity"):
            self.assertEqual(ttl(path), tmdb_proxy_views.DETAIL_TTL, path)
        self.assertLessEqual(tmdb_proxy_views.LIST_TTL, 10 * 60)
        self.assertLessEqual(tmdb_proxy_views.STATIC_TTL, 24 * 60 * 60)
        self.assertLessEqual(tmdb_proxy_views.DETAIL_TTL, 6 * 60 * 60)


class TmdbProxyCacheIsolationTests(SimpleTestCase):
    def test_filling_the_proxy_cache_never_evicts_default_entries(self):
        caches["default"].set("throttle_user_1", [1, 2, 3], 300)
        self.addCleanup(caches["default"].delete, "throttle_user_1")
        limit = settings.CACHES["tmdb"]["OPTIONS"]["MAX_ENTRIES"]
        for i in range(limit + 50):
            caches["tmdb"].set(f"tmdbproxy:{i}", {"i": i}, 60)
        caches["tmdb"].clear()
        self.assertEqual(caches["default"].get("throttle_user_1"), [1, 2, 3])

    def test_production_uses_its_own_bounded_table(self):
        prod = settings.TMDB_CACHE_PRODUCTION
        self.assertEqual(prod["BACKEND"], "django.core.cache.backends.db.DatabaseCache")
        self.assertNotEqual(prod["LOCATION"], settings.PRODUCTION_CACHE["LOCATION"])
        self.assertTrue(prod["OPTIONS"]["MAX_ENTRIES"])
        self.assertNotEqual(settings.TMDB_CACHE_DEV["LOCATION"], settings.CACHES["default"].get("LOCATION", ""))


@patch("userdata.tmdb_proxy_views._session.get")
class TmdbProxySweepB2Tests(APITestCase):
    """fix-tmdb-sweep-b2: plain paths only, translated upstream errors, order-free keys."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        caches["tmdb"].clear()

    def _answer(self, mock_get, status_code=200, body=None, headers=None):
        mock_get.return_value = Mock(
            status_code=status_code, headers=headers or {}, **{"json.return_value": body or {"id": 550}}
        )

    def test_paths_that_arent_plain_are_refused_before_tmdb(self, mock_get):
        self._answer(mock_get)
        for path in ("movie/550%3Fsession_id=abc", "..%2F4%2Flist%2F1", "movie/550%23x",
                     "movie/./550", "movie//550", "movie/550%25"):
            res = self.client.get(f"/api/tmdb/{path}")
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, path)
        mock_get.assert_not_called()

    def test_nested_plain_paths_are_forwarded(self, mock_get):
        self._answer(mock_get)
        for path in ("tv/1396/season/1", "watch/providers/regions", "person/287/combined_credits"):
            self.assertEqual(self.client.get(f"/api/tmdb/{path}").status_code, 200, path)

    def test_refused_server_key_is_a_502_never_a_401(self, mock_get):
        for code in (401, 403):
            self._answer(mock_get, code, {"status_code": 7})
            with self.assertLogs("userdata.tmdb_proxy_views", level="WARNING"):
                res = self.client.get("/api/tmdb/movie/550")
            self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY, code)
            self.assertEqual(res.data, {"error": "TMDB request failed."})
        self.assertIsNone(caches["tmdb"].get(tmdb_proxy_views._cache_key("movie/550", [])))

    def test_rate_limit_keeps_retry_after(self, mock_get):
        self._answer(mock_get, 429, {"status_code": 25}, {"Retry-After": "7"})
        res = self.client.get("/api/tmdb/movie/550")
        self.assertEqual(res.status_code, 429)
        self.assertEqual(res["Retry-After"], "7")

    def test_same_params_in_another_order_hit_the_cache(self, mock_get):
        self._answer(mock_get)
        self.client.get("/api/tmdb/discover/movie?page=1&language=en-US")
        res = self.client.get("/api/tmdb/discover/movie?language=en-US&page=1")
        self.assertEqual(mock_get.call_count, 1)
        self.assertEqual(res["X-Cache"], "HIT")


class TmdbProxyPoolTests(SimpleTestCase):
    def test_full_proxy_pool_doesnt_delay_other_tmdb_calls(self):
        release = threading.Event()
        self.addCleanup(release.set)
        blockers = [tmdb_proxy_views.PROXY_POOL.submit(release.wait, 10)
                    for _ in range(tmdb_proxy_views.PROXY_POOL_SIZE)]
        try:
            started = time.monotonic()
            self.assertEqual(tmdb_client.call_with_deadline(lambda: "synced", 1), "synced")
            self.assertLess(time.monotonic() - started, 0.5)
        finally:
            release.set()
            for b in blockers:
                b.result(timeout=5)
