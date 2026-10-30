import re
import threading
import time
from pathlib import Path
from unittest.mock import patch

import requests
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from userdata import stats_views, tmdb_client
from userdata.models import WatchedEntry


class StatsGenreLookupTests(APITestCase):
    def setUp(self):
        self._reset_genre_cache()
        self.addCleanup(self._reset_genre_cache)
        self.user = User.objects.create_user(username="gwen", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        WatchedEntry.objects.create(
            user=self.user, media_id=1, media_type="movie", title="A", genre_ids=[18],
            original_language="en", release_year=2000, metadata_settled=True,
        )

    @staticmethod
    def _reset_genre_cache():
        stats_views._genre_name_cache = {}
        stats_views._genre_cache_ts = 0.0
        stats_views._genre_cache_ttl = 0.0

    def _top_genres(self):
        res = self.client.get("/api/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return [g["genre"] for g in res.data["topGenres"]]

    @patch("userdata.tmdb_client._session.request", side_effect=requests.Timeout())
    def test_unreachable_tmdb_uses_builtin_names_with_the_short_timeout(self, get):
        with self.assertLogs("userdata.stats_views", level="WARNING"):
            self.assertEqual(self._top_genres(), ["Drama"])
        self.assertEqual(get.call_args.kwargs["timeout"], stats_views.GENRE_LOOKUP_TIMEOUT)

    @patch("userdata.tmdb_client._get")
    def test_fallback_is_retried_after_its_short_ttl(self, mock_get):
        mock_get.side_effect = requests.ConnectionError()
        with self.assertLogs("userdata.stats_views", level="WARNING"):
            self._top_genres()
        calls = mock_get.call_count

        self._top_genres()  # inside the fallback TTL: no new lookup
        self.assertEqual(mock_get.call_count, calls)

        stats_views._genre_cache_ts = time.time() - stats_views._GENRE_FALLBACK_TTL - 1
        mock_get.side_effect = None
        mock_get.return_value = {"genres": [{"id": 18, "name": "Drama (TMDB)"}]}
        self.assertEqual(self._top_genres(), ["Drama (TMDB)"])
        self.assertGreater(mock_get.call_count, calls)

    @patch("userdata.tmdb_client._get", return_value={"genres": [{"id": 18, "name": "Drama"}]})
    def test_successful_lookup_is_kept_for_a_day(self, mock_get):
        self._top_genres()
        calls = mock_get.call_count
        stats_views._genre_cache_ts = time.time() - stats_views._GENRE_FALLBACK_TTL - 1
        self._top_genres()
        self.assertEqual(mock_get.call_count, calls)

    def test_lookup_fits_under_gunicorn_timeout(self):
        entrypoint = (Path(__file__).resolve().parents[2] / "docker-entrypoint.sh").read_text()
        match = re.search(r"gunicorn .*--timeout (\d+)", entrypoint)
        self.assertIsNotNone(match, "docker-entrypoint.sh must set gunicorn --timeout explicitly")
        # Two sequential calls (movie + tv) on a cold cache, each under a
        # wall-clock deadline (per-attempt timeouts can't bound a call).
        self.assertLessEqual(2 * stats_views.GENRE_LOOKUP_DEADLINE, int(match.group(1)) - 10)

    @patch.object(stats_views, "GENRE_LOOKUP_DEADLINE", 0.3)
    def test_hanging_lookup_answers_with_builtin_names_within_the_budget(self):
        release = threading.Event()
        self.addCleanup(release.set)  # never leave a pool thread blocked
        self.client.get("/api/ratings/")  # warm up (no TMDB): the first request loads the URLconf
        with patch("userdata.tmdb_client._get", side_effect=lambda *a, **k: release.wait(10)), \
                self.assertLogs("userdata.stats_views", level="WARNING"):
            started = time.monotonic()
            genres = self._top_genres()
        self.assertLess(time.monotonic() - started, 2)
        self.assertEqual(genres, ["Drama"])

    def test_get_genre_names_still_falls_back_by_default(self):
        with patch("userdata.tmdb_client._get", side_effect=requests.ConnectionError()):
            self.assertEqual(tmdb_client.get_genre_names("movie"), tmdb_client.STATIC_GENRE_NAMES)
            with self.assertRaises(requests.ConnectionError):
                tmdb_client.get_genre_names("movie", fallback=False)
