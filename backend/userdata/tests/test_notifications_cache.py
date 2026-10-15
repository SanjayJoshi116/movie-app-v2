"""notifications-cache-hygiene and follow-crew-credits: person credits in
their own cache alias (acting and crew, no talk/news), polls reading recent
summaries only, and unread meaning "not seen at the last mark-seen"."""
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
from userdata.notifications_views import MAX_SEEN_ITEMS
from userdata.social_views import _credits_key, _recent_key, credits_cache

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
            credits_cache().set(_credits_key(i), [], 60)
        self.assertEqual(caches["default"].get("throttle_user_1"), [1, 2, 3])
        self.assertEqual(caches["tmdb"].get("tmdbproxy:x"), {"a": 1})


class RecentSummaryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sum", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.create(user=self.user, person_id=1, name="Some Actor")
        NotificationCheckpoint.objects.create(user=self.user, last_seen_at=timezone.now() - timedelta(days=60))

    @patch("userdata.tmdb_client._get")
    def test_fetch_writes_new_work_and_a_recent_summary(self, mock_get):
        today = timezone.now().date()
        mock_get.return_value = {"cast": [
            _credit(1, today - timedelta(days=3)),
            _credit(2, today - timedelta(days=400)),
            _credit(3, today + timedelta(days=1)),
            _credit(5, today - timedelta(days=900)),
            {"id": 4, "media_type": "movie", "title": "Undated"},
        ]}
        self.client.get(NEW_RELEASES)
        new = credits_cache().get(_credits_key(1))
        recent = credits_cache().get(_recent_key(1))
        self.assertEqual({c["id"] for c in new}, {1, 2, 3})  # last two years or ahead, dated
        self.assertEqual({c["id"] for c in recent}, {1, 3})

    @patch("userdata.tmdb_client._get")
    def test_entries_cached_under_the_old_keys_are_not_read(self, mock_get):
        today = timezone.now().date()
        credits_cache().set("person_recent:1", [_credit(9, today, "Stale cast-only")], 600)
        mock_get.return_value = {"cast": [_credit(1, today - timedelta(days=1), "Fresh")]}
        res = self.client.get(NEW_RELEASES)
        mock_get.assert_called_once()
        self.assertEqual([i["title"] for i in res.data["items"]], ["Fresh"])

    @patch("userdata.tmdb_client._get")
    def test_poll_reads_only_summaries(self, mock_get):
        today = timezone.now().date()
        credits_cache().set(_recent_key(1), [_credit(1, today - timedelta(days=2), "Recent")], 600)
        credits_cache().set(_credits_key(1), [_credit(9, today - timedelta(days=2), "Only in new")], 600)
        res = self.client.get(NEW_RELEASES)
        mock_get.assert_not_called()
        self.assertEqual([i["title"] for i in res.data["items"]], ["Recent"])

    @patch("userdata.tmdb_client._get")
    def test_recommendations_read_new_work_lists(self, mock_get):
        today = timezone.now().date()
        classic = {**_credit(5, today - timedelta(days=900), "Classic"), "vote_average": 8}
        fresh = {**_credit(6, today - timedelta(days=100), "Fresh"), "vote_average": 3}
        credits_cache().set(_credits_key(1), [classic, fresh], 600)
        credits_cache().set(_recent_key(1), [], 600)
        sections = self.client.get("/api/recommendations/followed-people/").data
        mock_get.assert_not_called()
        titles = [i["title"] for s in sections for i in s["items"]]
        self.assertEqual(titles, ["Fresh"])  # read filters by date too; no rating floor

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
        self.assertEqual(credits_cache().get(_credits_key(1)), [])
        self.assertEqual(credits_cache().get(_recent_key(1)), [])

    def test_summary_window_bounds(self):
        today = datetime(2026, 10, 7).date()
        cast = [_credit(i, today + timedelta(days=d)) for i, d in enumerate((-33, -32, 0, 2, 3))]
        self.assertEqual([c["id"] for c in social_views._recent_summary(cast, today)], [1, 2, 3])


class CrewCreditsTests(SimpleTestCase):
    @patch("userdata.tmdb_client._get")
    def test_crew_counts_once_per_title_and_talk_shows_dont(self, mock_get):
        mock_get.return_value = {
            "cast": [
                {"id": 1, "media_type": "movie", "title": "Acted", "release_date": "2026-01-01"},
                {"id": 50, "media_type": "tv", "name": "Late Show", "genre_ids": [10767, 35],
                 "first_air_date": "2015-09-08"},
                {"id": 51, "media_type": "tv", "name": "Evening News", "genre_ids": [10763]},
            ],
            "crew": [
                {"id": 2, "media_type": "movie", "title": "Directed", "job": "Director", "release_date": "2026-07-15"},
                {"id": 2, "media_type": "movie", "title": "Directed", "job": "Writer", "release_date": "2026-07-15"},
                {"id": 2, "media_type": "tv", "name": "Same id, a show", "job": "Creator"},
                {"id": 1, "media_type": "movie", "title": "Acted", "job": "Producer", "release_date": "2026-01-01"},
            ],
        }
        credits = social_views._fetch_person_credits(525)
        self.assertEqual([(c["id"], c["media_type"]) for c in credits], [(1, "movie"), (2, "movie"), (2, "tv")])
        self.assertNotIn("genre_ids", credits[0])  # trimmed


class SeenItemsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sd", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.create(user=self.user, person_id=1, name="Some Actor")
        self.morning = datetime(2026, 10, 7, 8, 0, tzinfo=UTC)
        self.today = self.morning.date()

    def _poll(self, now):
        with patch("django.utils.timezone.now", return_value=now):
            return self.client.get(NEW_RELEASES).data

    def _mark_seen(self, now):
        with patch("django.utils.timezone.now", return_value=now):
            self.client.post(MARK_SEEN)

    def _unread(self, data):
        return {i["title"]: i["isUnread"] for i in data["items"]}

    def _seen_items(self):
        return NotificationCheckpoint.objects.get(user=self.user).seen_items

    def test_same_day_release_that_appears_after_mark_seen_is_unread(self):
        older = _credit(2, self.today - timedelta(days=3), "Older")
        credits_cache().set(_recent_key(1), [_credit(1, self.today, "Had it"), older], 3600)
        self._mark_seen(self.morning)
        self.assertEqual(self._seen_items(), [[1, "movie"], [2, "movie"]])

        # Later that day the person's credits gain another title dated today.
        later = [_credit(1, self.today, "Had it"), _credit(3, self.today, "New today"), older]
        credits_cache().set(_recent_key(1), later, 3600)
        data = self._poll(self.morning + timedelta(hours=6))
        self.assertEqual(self._unread(data), {"Had it": False, "New today": True, "Older": False})
        self.assertEqual(data["unreadCount"], 1)

    def test_title_added_late_with_a_past_date_is_unread(self):
        seen = _credit(1, self.today - timedelta(days=1), "Seen")
        credits_cache().set(_recent_key(1), [seen], 3600)
        self._mark_seen(self.morning)
        # Next day TMDB adds a film released five days before mark-seen.
        late = _credit(4, self.today - timedelta(days=5), "Added late")
        credits_cache().set(_recent_key(1), [seen, late], 3600)
        data = self._poll(self.morning + timedelta(days=1))
        self.assertEqual(self._unread(data), {"Seen": False, "Added late": True})

    def test_seen_item_stays_read(self):
        credits_cache().set(_recent_key(1), [_credit(1, self.today, "Seen")], 3600)
        self._mark_seen(self.morning)
        for days in (0, 3, 10):
            data = self._poll(self.morning + timedelta(days=days, hours=1))
            self.assertEqual(self._unread(data), {"Seen": False})

    def test_first_poll_shows_everything_unread(self):
        credits_cache().set(_recent_key(1), [_credit(1, self.today - timedelta(days=14), "Two weeks old")], 3600)
        data = self._poll(self.morning)
        self.assertEqual(self._unread(data), {"Two weeks old": True})
        self.assertEqual(self._seen_items(), [])

    def test_checkpoint_from_before_keeps_the_date_rule(self):
        NotificationCheckpoint.objects.create(
            user=self.user, last_seen_at=self.morning - timedelta(days=2), seen_items=None,
        )
        credits_cache().set(_recent_key(1), [
            _credit(1, self.today - timedelta(days=5), "Before"),
            _credit(2, self.today - timedelta(days=1), "After"),
        ], 3600)
        self.assertEqual(self._unread(self._poll(self.morning)), {"Before": False, "After": True})
        # The next mark-seen switches it to the seen set.
        self._mark_seen(self.morning)
        self.assertEqual(self._seen_items(), [[2, "movie"], [1, "movie"]])

    def test_mark_seen_makes_no_tmdb_call_and_caps_the_list(self):
        credits = [_credit(i, self.today) for i in range(MAX_SEEN_ITEMS + 100)]
        credits_cache().set(_recent_key(1), credits, 3600)
        with patch("userdata.tmdb_client._get") as mock_get:
            self._mark_seen(self.morning)
        mock_get.assert_not_called()
        self.assertEqual(len(self._seen_items()), MAX_SEEN_ITEMS)
