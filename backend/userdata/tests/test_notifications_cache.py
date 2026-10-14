"""notifications-cache-hygiene: person credits in their own cache alias, polls
reading recent summaries only, and same-day releases that appear after
mark-seen showing as unread."""
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import requests

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import caches
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from userdata import social_views
from userdata.models import FollowedPerson, NotificationCheckpoint
from userdata.social_views import credits_cache

NEW_RELEASES = "/api/notifications/new-releases/"
MARK_SEEN = "/api/notifications/mark-seen/"


def _credit(cid, day, title=None):
    return {"id": cid, "media_type": "movie", "title": title or f"T{cid}", "poster_path": None,
            "release_date": day.isoformat()}


class CreditsCacheAliasTests(SimpleTestCase):
    def test_alias_is_separate_in_both_modes(self):
        for alias in ("default", "tmdb"):
            self.assertNotEqual(
                settings.PERSON_CREDITS_CACHE_PRODUCTION["LOCATION"],
                (settings.PRODUCTION_CACHE if alias == "default" else settings.TMDB_CACHE_PRODUCTION)["LOCATION"],
            )
        self.assertNotEqual(settings.PERSON_CREDITS_CACHE_DEV["LOCATION"], settings.TMDB_CACHE_DEV["LOCATION"])
        dev, prod = settings.PERSON_CREDITS_CACHE_DEV, settings.PERSON_CREDITS_CACHE_PRODUCTION
        self.assertNotEqual(dev["LOCATION"], settings.CACHES["default"].get("LOCATION", ""))
        self.assertEqual(prod["BACKEND"], "django.core.cache.backends.db.DatabaseCache")
        self.assertTrue(settings.PERSON_CREDITS_CACHE_PRODUCTION["OPTIONS"]["MAX_ENTRIES"])

    def test_filling_it_never_evicts_throttle_counters_or_proxy_entries(self):
        caches["default"].set("throttle_user_1", [1, 2, 3], 300)
        caches["tmdb"].set("tmdbproxy:x", {"a": 1}, 300)
        self.addCleanup(caches["default"].delete, "throttle_user_1")
        limit = settings.CACHES["person_credits"]["OPTIONS"]["MAX_ENTRIES"]
        for i in range(limit + 50):
            credits_cache().set(f"person_credits:{i}", [], 60)
        self.assertEqual(caches["default"].get("throttle_user_1"), [1, 2, 3])
        self.assertEqual(caches["tmdb"].get("tmdbproxy:x"), {"a": 1})


class RecentSummaryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sum", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.create(user=self.user, person_id=1, name="Some Actor")
        NotificationCheckpoint.objects.create(user=self.user, last_seen_at=timezone.now() - timedelta(days=60))

    @patch("userdata.tmdb_client._get")
    def test_fetch_writes_full_list_and_a_recent_summary(self, mock_get):
        today = timezone.now().date()
        mock_get.return_value = {"cast": [
            _credit(1, today - timedelta(days=3)),
            _credit(2, today - timedelta(days=400)),
            _credit(3, today + timedelta(days=1)),
            {"id": 4, "media_type": "movie", "title": "Undated"},
        ]}
        self.client.get(NEW_RELEASES)
        full = credits_cache().get("person_credits:1")
        recent = credits_cache().get("person_recent:1")
        self.assertEqual({c["id"] for c in full}, {1, 2, 3, 4})
        self.assertEqual({c["id"] for c in recent}, {1, 3})

    @patch("userdata.tmdb_client._get")
    def test_poll_reads_only_summaries(self, mock_get):
        today = timezone.now().date()
        credits_cache().set("person_recent:1", [_credit(1, today - timedelta(days=2), "Recent")], 600)
        credits_cache().set("person_credits:1", [_credit(9, today - timedelta(days=2), "Only in full")], 600)
        res = self.client.get(NEW_RELEASES)
        mock_get.assert_not_called()
        self.assertEqual([i["title"] for i in res.data["items"]], ["Recent"])

    @patch("userdata.tmdb_client._get")
    def test_recommendations_still_read_full_lists(self, mock_get):
        today = timezone.now().date()
        classic = {**_credit(5, today - timedelta(days=900), "Classic"), "vote_average": 8}
        credits_cache().set("person_credits:1", [classic], 600)
        credits_cache().set("person_recent:1", [], 600)
        sections = self.client.get("/api/recommendations/followed-people/").data
        mock_get.assert_not_called()
        self.assertIn("Classic", [i["title"] for s in sections for i in s["items"]])

    @patch("userdata.tmdb_client._get")
    def test_title_dated_tomorrow_shows_the_next_day_within_the_cache_lifetime(self, mock_get):
        fetched_at = datetime(2026, 10, 7, 20, 0, tzinfo=UTC)
        mock_get.return_value = {"cast": [_credit(7, datetime(2026, 10, 8).date(), "Tomorrow")]}
        with patch("django.utils.timezone.now", return_value=fetched_at):
            first = self.client.get(NEW_RELEASES).data
        self.assertEqual(first["items"], [])
        with patch("django.utils.timezone.now", return_value=fetched_at + timedelta(hours=5)):
            second = self.client.get(NEW_RELEASES).data
        self.assertEqual(mock_get.call_count, 1)  # served from the summary
        self.assertEqual([i["title"] for i in second["items"]], ["Tomorrow"])

    @patch("userdata.tmdb_client._get")
    def test_not_found_caches_no_credits_in_both_keys(self, mock_get):
        resp = requests.Response()
        resp.status_code = 404
        mock_get.side_effect = requests.HTTPError(response=resp)
        self.client.get(NEW_RELEASES)
        self.assertEqual(credits_cache().get("person_credits:1"), [])
        self.assertEqual(credits_cache().get("person_recent:1"), [])

    def test_summary_window_bounds(self):
        today = datetime(2026, 10, 7).date()
        cast = [_credit(i, today + timedelta(days=d)) for i, d in enumerate((-33, -32, 0, 2, 3))]
        self.assertEqual([c["id"] for c in social_views._recent_summary(cast, today)], [1, 2, 3])


class SameDaySeenTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sd", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.create(user=self.user, person_id=1, name="Some Actor")

    def _poll(self, now):
        with patch("django.utils.timezone.now", return_value=now):
            return self.client.get(NEW_RELEASES).data

    def test_same_day_release_that_appears_after_mark_seen_is_unread(self):
        morning = datetime(2026, 10, 7, 8, 0, tzinfo=UTC)
        today = morning.date()
        older = _credit(2, today - timedelta(days=3), "Older")
        credits_cache().set("person_recent:1", [_credit(1, today, "Had it"), older], 3600)
        with patch("django.utils.timezone.now", return_value=morning):
            self.client.post(MARK_SEEN)
        self.assertEqual(NotificationCheckpoint.objects.get(user=self.user).seen_same_day, [[1, "movie"]])

        # Later that day the person's credits gain another title dated today.
        credits_cache().set(
            "person_recent:1",
            [_credit(1, today, "Had it"), _credit(3, today, "New today"), older],
            3600,
        )
        data = self._poll(morning + timedelta(hours=6))
        unread = {i["title"]: i["isUnread"] for i in data["items"]}
        self.assertEqual(unread, {"Had it": False, "New today": True, "Older": False})
        self.assertEqual(data["unreadCount"], 1)

    def test_mark_seen_makes_no_tmdb_call_and_caps_the_list(self):
        morning = datetime(2026, 10, 7, 8, 0, tzinfo=UTC)
        credits_cache().set("person_recent:1", [_credit(i, morning.date()) for i in range(150)], 3600)
        with (
            patch("userdata.tmdb_client._get") as mock_get,
            patch("django.utils.timezone.now", return_value=morning),
        ):
            self.client.post(MARK_SEEN)
        mock_get.assert_not_called()
        self.assertEqual(len(NotificationCheckpoint.objects.get(user=self.user).seen_same_day), 100)
