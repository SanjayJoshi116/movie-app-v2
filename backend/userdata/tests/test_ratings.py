import re
import threading
import time
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import requests
from django.contrib.auth.models import User
from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from userdata import ratings_views, tmdb_client
from userdata.models import RatingEntry, TMDBProfile


class RatingsPaginationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="uma", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        RatingEntry.objects.bulk_create([
            RatingEntry(user=self.user, media_id=i, media_type="movie", title=f"Movie {i}", user_rating=7)
            for i in range(110)
        ])

    def test_paginated_response_shape(self):
        res = self.client.get("/api/ratings/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 110)
        self.assertEqual(len(res.data["results"]), 100)
        self.assertIsNotNone(res.data["next"])


class RatingWriteTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rho", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        TMDBProfile.objects.create(user=self.user, session_id="sess")
        self.old = timezone.now() - timedelta(days=200)
        self.entry = RatingEntry.objects.create(
            user=self.user, media_id=550, media_type="movie", title="Fight Club",
            user_rating=6, review="ok", rated_at=self.old,
        )

    def _patch(self, body):
        return self.client.patch(f"/api/ratings/{self.entry.pk}/", body, format="json")

    @patch("userdata.tmdb_client.post_rating")
    def test_patch_score_syncs_to_tmdb_and_bumps_rated_at(self, post):
        res = self._patch({"userRating": 8})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        post.assert_called_once_with("movie", 550, "sess", 8)
        self.entry.refresh_from_db()
        self.assertGreater(self.entry.rated_at, self.old)

    @patch("userdata.tmdb_client.post_rating")
    def test_review_only_patch_bumps_rated_at_without_tmdb(self, post):
        self._patch({"review": "better on rewatch"})
        post.assert_not_called()
        self.entry.refresh_from_db()
        self.assertGreater(self.entry.rated_at, self.old)

    @patch("userdata.tmdb_client.post_rating")
    def test_unchanged_patch_keeps_rated_at(self, post):
        self._patch({"userRating": 6})
        post.assert_not_called()
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.rated_at, self.old)

    @patch("userdata.tmdb_client.post_rating", side_effect=requests.ConnectionError())
    def test_tmdb_failure_still_saves(self, _):
        res = self._patch({"userRating": 9})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.user_rating, 9)

    def _post(self, rating, review=""):
        return self.client.post("/api/ratings/", {
            "mediaId": 550, "mediaType": "movie", "title": "Fight Club", "userRating": rating, "review": review,
        }, format="json")

    @patch("userdata.tmdb_client.post_rating")
    def test_post_review_only_change_skips_tmdb_but_bumps_rated_at(self, post):
        # The dialog always POSTs; a review edit there must not resend the score.
        res = self._post(6, review="better on rewatch")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        post.assert_not_called()
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.review, "better on rewatch")
        self.assertGreater(self.entry.rated_at, self.old)

    @patch("userdata.tmdb_client.post_rating")
    def test_post_score_change_and_new_rating_sync(self, post):
        self._post(8)
        post.assert_called_once_with("movie", 550, "sess", 8)
        post.reset_mock()
        self.client.post("/api/ratings/", {
            "mediaId": 13, "mediaType": "movie", "title": "Forrest Gump", "userRating": 7, "review": "",
        }, format="json")
        post.assert_called_once_with("movie", 13, "sess", 7)

    @patch("userdata.tmdb_client.post_rating")
    def test_rerate_via_post_moves_to_top(self, _):
        # Rated yesterday: newer than the 200-day-old rating, older than a re-rate
        # now (an explicit time avoids a same-tick tie on coarse clocks).
        RatingEntry.objects.create(
            user=self.user, media_id=13, media_type="movie", title="Newer", user_rating=7,
            rated_at=timezone.now() - timedelta(days=1),
        )
        self.client.post("/api/ratings/", {
            "mediaId": 550, "mediaType": "movie", "title": "Fight Club", "userRating": 9, "review": "",
        }, format="json")
        res = self.client.get("/api/ratings/")
        self.assertEqual(res.data["results"][0]["mediaId"], 550)

    def test_bulk_restore_keeps_supplied_rated_at(self):
        res = self.client.post("/api/ratings/bulk/", {
            "mediaType": "movie",
            "entries": [
                {"mediaId": 77, "title": "Old", "userRating": 7, "review": "", "ratedAt": "2020-05-01T00:00:00Z"},
            ],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(RatingEntry.objects.get(user=self.user, media_id=77).rated_at.year, 2020)


SECRET_SESSION = "sess-9c8b7a6f5e4d"


def _sync_error(*args, **kwargs):
    # requests' raise_for_status() message carries the full URL, session_id included.
    raise requests.HTTPError(
        f"401 Client Error: Unauthorized for url: https://api.tmdb.org/3/movie/550/rating?session_id={SECRET_SESSION}"
    )


class RatingSyncLoggingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sig", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _rate(self):
        return self.client.post("/api/ratings/", {
            "mediaId": 550, "mediaType": "movie", "title": "Fight Club", "userRating": 8, "review": "",
        }, format="json")

    @patch("userdata.tmdb_client.post_rating")
    def test_user_without_tmdb_link_logs_nothing(self, post):
        with self.assertNoLogs("userdata", level="WARNING"):
            res = self._rate()
            entry_id = res.data["id"]
            self.client.delete(f"/api/ratings/{entry_id}/")
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        post.assert_not_called()

    @patch("userdata.tmdb_client.post_rating", side_effect=_sync_error)
    def test_sync_failure_logs_one_warning_without_session(self, _):
        TMDBProfile.objects.create(user=self.user, session_id=SECRET_SESSION)
        with self.assertLogs("userdata.ratings_views", level="WARNING") as cm:
            res = self._rate()
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertEqual(len(cm.records), 1)
        self.assertEqual(cm.records[0].levelname, "WARNING")
        self.assertIsNone(cm.records[0].exc_info)
        self.assertIn("HTTPError", cm.output[0])
        self.assertNotIn(SECRET_SESSION, cm.output[0])

    @patch("userdata.tmdb_client.delete_rating", side_effect=_sync_error)
    def test_delete_sync_failure_logs_without_session(self, _):
        TMDBProfile.objects.create(user=self.user, session_id=SECRET_SESSION)
        entry = RatingEntry.objects.create(
            user=self.user, media_id=550, media_type="movie", title="Fight Club", user_rating=8,
        )
        with self.assertLogs("userdata.ratings_views", level="WARNING") as cm:
            res = self.client.delete(f"/api/ratings/{entry.pk}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertNotIn(SECRET_SESSION, "\n".join(cm.output))


class RatingSyncBoundsTests(APITestCase):
    """ratings: TMDB sync runs after the local change, bounded, in order."""

    def setUp(self):
        self.user = User.objects.create_user(username="sig", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        TMDBProfile.objects.create(user=self.user, session_id="sess")
        self.release = threading.Event()
        self.addCleanup(self.release.set)  # never leave a pool thread blocked
        self.client.get("/api/ratings/")  # warm up: the first request loads the URLconf

    def _post(self, rating):
        return self.client.post("/api/ratings/", {
            "mediaId": 550, "mediaType": "movie", "title": "Fight Club", "userRating": rating,
        }, format="json")

    def _hang(self, *args):
        self.release.wait(10)
        return {}

    @patch("userdata.tmdb_client.TMDB_CALL_DEADLINE", 0.3)
    def test_tmdb_hanging_never_holds_a_rating_write(self):
        with patch("userdata.tmdb_client.post_rating", side_effect=self._hang), \
                patch("userdata.tmdb_client.delete_rating", side_effect=self._hang):
            def url():
                return f"/api/ratings/{RatingEntry.objects.get().pk}/"

            for send in (
                lambda: self._post(8),
                lambda: self.client.patch(url(), {"userRating": 9}, format="json"),
                lambda: self.client.delete(url()),
            ):
                started = time.monotonic()
                with self.assertLogs("userdata.ratings_views", level="WARNING"):
                    res = send()
                self.assertLess(time.monotonic() - started, 2)
                self.assertLess(res.status_code, 300)
        self.assertFalse(RatingEntry.objects.exists())

    def test_delete_removes_the_row_even_when_the_sync_fails(self):
        entry = RatingEntry.objects.create(user=self.user, media_id=550, media_type="movie", title="T", user_rating=7)
        order = []
        real_delete = RatingEntry.delete

        def tracked_delete(instance, *args, **kwargs):
            order.append("local delete")
            return real_delete(instance, *args, **kwargs)

        def fail(*args):
            # Runs on the TMDB pool thread: no DB access here (worker-thread rule).
            order.append("tmdb sync")
            raise requests.ConnectionError("down")

        with patch.object(RatingEntry, "delete", tracked_delete), \
                patch("userdata.tmdb_client.delete_rating", side_effect=fail), \
                self.assertLogs("userdata.ratings_views", level="WARNING"):
            res = self.client.delete(f"/api/ratings/{entry.pk}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(RatingEntry.objects.filter(pk=entry.pk).exists())
        self.assertEqual(order, ["local delete", "tmdb sync"])

    def test_rate_then_delete_reaches_tmdb_in_order(self):
        calls = []
        with patch("userdata.tmdb_client.post_rating", side_effect=lambda *a: calls.append(("post", a))), \
                patch("userdata.tmdb_client.delete_rating", side_effect=lambda *a: calls.append(("delete", a))):
            self._post(8)
            self.client.delete(f"/api/ratings/{RatingEntry.objects.get().pk}/")
        self.assertEqual(calls, [("post", ("movie", 550, "sess", 8)), ("delete", ("movie", 550, "sess"))])

    def test_rating_endpoints_fit_under_gunicorn_timeout(self):
        entrypoint = (Path(__file__).resolve().parents[2] / "docker-entrypoint.sh").read_text()
        timeout = int(re.search(r"gunicorn .*--timeout (\d+)", entrypoint).group(1))
        # One bounded TMDB call per rating write, plus, for a second write to the
        # same title, the wait for the first one's sync under the rating lock.
        self.assertLessEqual(2 * tmdb_client.TMDB_CALL_DEADLINE, timeout - 10)



class RatingReviewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rev", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _post(self, **extra):
        return self.client.post("/api/ratings/", {
            "mediaId": 550, "mediaType": "movie", "title": "Fight Club", **extra,
        }, format="json")

    def test_rerate_without_review_keeps_it(self):
        self._post(userRating=7, review="Loved it")
        res = self._post(userRating=9)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        entry = RatingEntry.objects.get()
        self.assertEqual((entry.user_rating, entry.review), (9, "Loved it"))

    def test_new_rating_without_review_starts_empty(self):
        self.assertEqual(self._post(userRating=7).status_code, status.HTTP_201_CREATED)
        self.assertEqual(RatingEntry.objects.get().review, "")

    def test_restored_review_saved_unchanged_keeps_rated_at(self):
        self.client.post("/api/ratings/bulk/", {"mediaType": "movie", "entries": [
            {"mediaId": 550, "title": "FC", "userRating": 8, "review": "Great ", "ratedAt": "2024-01-01T00:00:00Z"},
        ]}, format="json")
        entry = RatingEntry.objects.get()
        self.assertEqual(entry.review, "Great")
        self.client.patch(f"/api/ratings/{entry.pk}/", {"review": "Great "}, format="json")
        entry.refresh_from_db()
        self.assertEqual((entry.review, entry.rated_at.year), ("Great", 2024))


class RatingConcurrencyTests(APITransactionTestCase):
    """ratings: same-title writes at the same moment are applied one after another."""

    def setUp(self):
        self.user = User.objects.create_user(username="two", password="Xk9#mQ2vTz8p")
        TMDBProfile.objects.create(user=self.user, session_id="sess")
        RatingEntry.objects.create(user=self.user, media_id=550, media_type="movie", title="FC", user_rating=7)

    def test_two_tabs_rating_at_once_leave_tmdb_matching_the_app(self):
        synced = []
        first_sync_started = threading.Event()

        def post_rating(media_type, media_id, session_id, value):
            # The first sync (the 8) is slow: the 7 arrives while it runs.
            if not first_sync_started.is_set():
                first_sync_started.set()
                time.sleep(0.5)
            synced.append(value)
            return {}

        def rate(score):
            client = APIClient()
            client.force_authenticate(user=self.user)
            try:
                client.post("/api/ratings/", {
                    "mediaId": 550, "mediaType": "movie", "title": "FC", "userRating": score,
                }, format="json")
            finally:
                connection.close()

        with patch("userdata.tmdb_client.post_rating", side_effect=post_rating):
            first = threading.Thread(target=rate, args=(8,))
            first.start()
            self.assertTrue(first_sync_started.wait(10))
            second = threading.Thread(target=rate, args=(7,))
            second.start()
            first.join(timeout=30)
            second.join(timeout=30)
        # Unserialized, the 7 synced first and the slow 8 landed last at TMDB.
        self.assertEqual(synced, [8, 7])
        self.assertEqual(RatingEntry.objects.get().user_rating, 7)

    def test_lock_is_released_when_the_write_fails(self):
        with self.assertRaises(RuntimeError), ratings_views._rating_lock(self.user.id, "movie", 550):
            raise RuntimeError("boom")
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND classid = %s",
                [ratings_views.RATING_LOCK_NAMESPACE],
            )
            self.assertEqual(cursor.fetchone()[0], 0)
