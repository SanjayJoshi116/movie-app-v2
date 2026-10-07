import time
from datetime import timedelta
from unittest.mock import MagicMock, patch

import requests
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from userdata import metadata_backfill
from userdata.metadata_backfill import backfill_entries, entry_needs_metadata, request_backfill
from userdata.models import TMDBMediaCache, WatchedEntry
from userdata.recommendations import _ensure_cached


def _http_error(status):
    resp = MagicMock(status_code=status)
    return requests.HTTPError(response=resp)


def _details(genres=(18, 80), lang="ja", date="2001-07-20"):
    return {"genres": [{"id": g, "name": str(g)} for g in genres], "original_language": lang, "release_date": date}


class _Base(APITestCase):
    def setUp(self):
        metadata_backfill._running.clear()
        metadata_backfill._failed_at.clear()
        metadata_backfill._settled.clear()
        self.user = User.objects.create_user(username="meta", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _entry(self, media_id=1, **kw):
        return WatchedEntry.objects.create(
            user=self.user, media_id=media_id, media_type="movie", title=f"T{media_id}", **kw
        )


class EnsureCachedTests(_Base):
    @patch("userdata.recommendations.tmdb_client.get_details_with_cast", side_effect=requests.ConnectionError())
    def test_failed_refresh_keeps_good_stale_row(self, _):
        entry = self._entry()
        row = TMDBMediaCache.objects.create(
            media_id=1, media_type="movie", genre_ids=[18], top_cast=[{"id": 5, "name": "A"}]
        )
        TMDBMediaCache.objects.filter(pk=row.pk).update(cached_at=timezone.now() - timedelta(days=30))

        result = _ensure_cached(entry)

        self.assertEqual(result.genre_ids, [18])
        row.refresh_from_db()
        self.assertEqual(row.genre_ids, [18])
        self.assertEqual(row.top_cast, [{"id": 5, "name": "A"}])
        self.assertLess(row.cached_at, timezone.now() - timedelta(days=29))  # not re-stamped

    @patch("userdata.recommendations.tmdb_client.get_details_with_cast", side_effect=requests.ConnectionError())
    def test_failed_first_fetch_stores_nothing(self, _):
        self.assertIsNone(_ensure_cached(self._entry()))
        self.assertFalse(TMDBMediaCache.objects.exists())


class BackfillTests(_Base):
    @patch("userdata.tmdb_client._get", return_value=_details())
    def test_fills_genres_language_and_year(self, _):
        entry = self._entry()
        backfill_entries([entry])
        entry.refresh_from_db()
        self.assertEqual(
            (entry.genre_ids, entry.original_language, entry.release_year), ([18, 80], "ja", 2001)
        )
        self.assertFalse(entry_needs_metadata(entry))

    @patch("userdata.tmdb_client._get", return_value=_details())
    def test_two_watched_titles_get_top_genres_in_stats(self, _):
        a, b = self._entry(1), self._entry(2)
        backfill_entries([a, b])  # what the background thread runs
        res = self.client.get("/api/stats/")
        genres = {g["genre"] for g in res.data["topGenres"]}
        self.assertTrue(genres, res.data["topGenres"])

    @patch("userdata.tmdb_client._get", side_effect=_http_error(404))
    def test_not_found_sets_sentinels_and_is_not_refetched(self, get):
        entry = self._entry()
        backfill_entries([entry])
        entry.refresh_from_db()
        self.assertEqual((entry.original_language, entry.release_year), ("??", -1))
        self.assertFalse(entry_needs_metadata(entry))
        backfill_entries([entry])
        self.assertEqual(get.call_count, 1)

    @patch("userdata.tmdb_client._get", return_value=_details(genres=()))
    def test_title_without_genres_is_not_refetched(self, get):
        entry = self._entry()
        backfill_entries([entry])
        backfill_entries([entry])
        self.assertEqual(get.call_count, 1)

    @patch("userdata.tmdb_client._get", side_effect=requests.Timeout())
    def test_transient_failure_backs_off(self, get):
        entry = self._entry()
        backfill_entries([entry])
        backfill_entries([entry])
        self.assertEqual(get.call_count, 1)  # in backoff

        metadata_backfill._failed_at[entry.pk] = time.monotonic() - metadata_backfill.BACKOFF_SECONDS - 1
        backfill_entries([entry])
        self.assertEqual(get.call_count, 2)
        entry.refresh_from_db()
        self.assertIsNone(entry.original_language)  # failure stored nothing


class RequestBackfillTests(_Base):
    @patch("userdata.metadata_backfill.threading.Thread")
    def test_second_request_while_running_is_noop(self, thread):
        request_backfill(self.user.id)
        request_backfill(self.user.id)
        self.assertEqual(thread.call_count, 1)

        metadata_backfill._running.discard(self.user.id)  # first run finished
        request_backfill(self.user.id)
        self.assertEqual(thread.call_count, 2)

    @patch("userdata.stats_views.request_backfill")
    def test_stats_requests_backfill_only_when_needed(self, req):
        entry = self._entry()
        self.client.get("/api/stats/")
        req.assert_called_once_with(self.user.id)

        WatchedEntry.objects.filter(pk=entry.pk).update(genre_ids=[18], original_language="en", release_year=1999)
        req.reset_mock()
        self.client.get("/api/stats/")
        req.assert_not_called()


class WatchedPostMetadataTests(_Base):
    def test_post_keeps_supplied_language_and_year(self):
        res = self.client.post("/api/watched/", {
            "mediaId": 129, "mediaType": "movie", "title": "Spirited Away", "posterPath": None, "voteAverage": 8.5,
            "originalLanguage": "ja", "releaseYear": 2001,
        }, format="json")
        self.assertEqual(res.status_code, 201)
        entry = WatchedEntry.objects.get(user=self.user, media_id=129)
        self.assertEqual((entry.original_language, entry.release_year), ("ja", 2001))
