import re
import threading
import time
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import requests
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from userdata import notifications_views
from userdata.models import FollowedPerson, NotificationCheckpoint


class NewReleaseNotificationsTests(APITestCase):
    def setUp(self):
        cache.clear()  # per-person credits are cached across requests
        self.user = User.objects.create_user(username="nia", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.create(user=self.user, person_id=1, name="Some Actor")

    @patch("userdata.tmdb_client._get")
    def test_only_recent_releases_are_returned_and_unread(self, mock_get):
        recent_date = (timezone.now().date() - timedelta(days=5)).isoformat()
        old_date = (timezone.now().date() - timedelta(days=90)).isoformat()
        mock_get.return_value = {
            "cast": [
                {"id": 1, "media_type": "movie", "title": "New Movie",
                 "poster_path": "/p.jpg", "release_date": recent_date},
                {"id": 2, "media_type": "movie", "title": "Old Movie",
                 "poster_path": None, "release_date": old_date},
            ]
        }
        # Checkpoint predates the "recent" release so it counts as unread —
        # a checkpoint lazily created at now() (no prior check) would never
        # mark anything unread, since nothing releases in the future.
        NotificationCheckpoint.objects.create(
            user=self.user, last_seen_at=timezone.now() - timedelta(days=10)
        )

        res = self.client.get("/api/notifications/new-releases/")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["items"]), 1)
        self.assertEqual(res.data["items"][0]["title"], "New Movie")
        self.assertEqual(res.data["unreadCount"], 1)
        self.assertTrue(res.data["items"][0]["isUnread"])

    @patch("userdata.tmdb_client._get")
    def test_items_before_last_seen_are_not_unread(self, mock_get):
        recent_date = (timezone.now().date() - timedelta(days=5)).isoformat()
        mock_get.return_value = {
            "cast": [{"id": 1, "media_type": "movie", "title": "New Movie",
                      "poster_path": None, "release_date": recent_date}]
        }
        NotificationCheckpoint.objects.create(user=self.user, last_seen_at=timezone.now())

        res = self.client.get("/api/notifications/new-releases/")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["items"]), 1)
        self.assertEqual(res.data["unreadCount"], 0)
        self.assertFalse(res.data["items"][0]["isUnread"])


def _cast(title, days_ago):
    date = (timezone.now().date() - timedelta(days=days_ago)).isoformat()
    return {"cast": [{"id": abs(hash(title)) % 100000, "media_type": "movie", "title": title,
                      "poster_path": None, "release_date": date, "extra": "x" * 50}]}


class NotificationCoverageAndCacheTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="nico", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        NotificationCheckpoint.objects.create(user=self.user, last_seen_at=timezone.now() - timedelta(days=60))

    def _follow(self, n):
        for i in range(1, n + 1):
            FollowedPerson.objects.create(user=self.user, person_id=i, name=f"P{i}")

    @patch("userdata.tmdb_client._get")
    def test_oldest_follow_of_15_is_covered(self, mock_get):
        self._follow(15)  # person 1 is followed first, so it's the oldest
        mock_get.side_effect = lambda path, *a, **k: (
            _cast("Early Follow Release", 3) if path == "/person/1/combined_credits" else {"cast": []}
        )

        res = self.client.get("/api/notifications/new-releases/")

        self.assertEqual([i["title"] for i in res.data["items"]], ["Early Follow Release"])
        self.assertEqual(mock_get.call_count, 15)

    @patch("userdata.tmdb_client._get")
    def test_second_poll_uses_cache(self, mock_get):
        self._follow(3)
        mock_get.return_value = _cast("Cached", 2)

        self.client.get("/api/notifications/new-releases/")
        self.assertEqual(mock_get.call_count, 3)
        res = self.client.get("/api/notifications/new-releases/")
        self.assertEqual(mock_get.call_count, 3)
        self.assertEqual(len(res.data["items"]), 1)
        self.assertNotIn("extra", cache.get("tmdb:person_credits:1")[0])  # trimmed

    @patch("userdata.tmdb_client._get")
    def test_failed_person_is_retried_next_poll(self, mock_get):
        self._follow(2)
        def person_2_fails(path, *args, **kwargs):
            if path == "/person/2/combined_credits":
                raise requests.ConnectionError()
            return {"cast": []}
        mock_get.side_effect = person_2_fails
        self.client.get("/api/notifications/new-releases/")
        self.assertIsNone(cache.get("tmdb:person_credits:2"))

        mock_get.reset_mock(side_effect=True)
        mock_get.return_value = _cast("Now Works", 1)
        res = self.client.get("/api/notifications/new-releases/")
        self.assertEqual(mock_get.call_count, 1)  # only person 2; person 1 was cached
        self.assertEqual([i["title"] for i in res.data["items"]], ["Now Works"])


def _person_id(path):
    return int(re.fullmatch(r"/person/(\d+)/combined_credits", path).group(1))


class NotificationPollBudgetTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="nell", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        NotificationCheckpoint.objects.create(user=self.user, last_seen_at=timezone.now() - timedelta(days=60))

    def _follow(self, n):
        FollowedPerson.objects.bulk_create([
            FollowedPerson(user=self.user, person_id=i, name=f"P{i}") for i in range(1, n + 1)
        ])

    @patch("userdata.tmdb_client._get")
    def test_cold_follows_are_covered_over_consecutive_polls(self, mock_get):
        self._follow(100)
        mock_get.return_value = {"cast": []}
        per_poll = []
        for _ in range(4):
            mock_get.reset_mock()
            res = self.client.get("/api/notifications/new-releases/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            per_poll.append({_person_id(c.args[0]) for c in mock_get.call_args_list})

        self.assertEqual([len(p) for p in per_poll], [40, 40, 20, 0])
        self.assertEqual(per_poll[0] | per_poll[1] | per_poll[2], set(range(1, 101)))

    @patch("userdata.notifications_views.NOTIFICATIONS_BUDGET_SECONDS", 0.5)
    @patch("userdata.tmdb_client._get")
    def test_slow_tmdb_returns_within_budget_and_keeps_what_arrived(self, mock_get):
        self._follow(6)
        release = threading.Event()
        self.addCleanup(release.set)  # let abandoned worker threads finish

        def get(path, *args, **kwargs):
            if _person_id(path) != 6:  # the newest follow, so first in the queue
                release.wait(10)  # far past the budget
            return {"cast": []}
        mock_get.side_effect = get

        started = time.monotonic()
        res = self.client.get("/api/notifications/new-releases/")
        elapsed = time.monotonic() - started

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertLess(elapsed, 0.5 + 2)
        self.assertEqual(cache.get("tmdb:person_credits:6"), [])  # arrived in time: cached
        self.assertIsNone(cache.get("tmdb:person_credits:5"))

        release.set()
        mock_get.reset_mock(side_effect=True)
        mock_get.return_value = {"cast": []}
        self.client.get("/api/notifications/new-releases/")
        self.assertEqual({_person_id(c.args[0]) for c in mock_get.call_args_list}, {1, 2, 3, 4, 5})

    def test_budget_fits_under_gunicorn_timeout(self):
        entrypoint = (Path(__file__).resolve().parents[2] / "docker-entrypoint.sh").read_text()
        match = re.search(r"gunicorn .*--timeout (\d+)", entrypoint)
        self.assertIsNotNone(match, "docker-entrypoint.sh must set gunicorn --timeout explicitly")
        # Headroom for the DB work after the fetch and the response itself.
        self.assertLessEqual(notifications_views.NOTIFICATIONS_BUDGET_SECONDS, int(match.group(1)) - 10)


class MarkNotificationsSeenTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="niaseen", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_creates_checkpoint_if_missing(self):
        self.assertFalse(NotificationCheckpoint.objects.filter(user=self.user).exists())

        res = self.client.post("/api/notifications/mark-seen/")

        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        checkpoint = NotificationCheckpoint.objects.get(user=self.user)
        self.assertLess((timezone.now() - checkpoint.last_seen_at).total_seconds(), 5)

    def test_updates_existing_checkpoint(self):
        stale = timezone.now() - timedelta(days=30)
        NotificationCheckpoint.objects.create(user=self.user, last_seen_at=stale)

        res = self.client.post("/api/notifications/mark-seen/")

        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        checkpoint = NotificationCheckpoint.objects.get(user=self.user)
        self.assertGreater(checkpoint.last_seen_at, stale)
