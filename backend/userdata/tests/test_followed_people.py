import re
import threading
import time
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from userdata import social_views
from userdata.models import FollowedPerson


class FollowedPeopleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="fern", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _follow(self, person_id=287, name="Brad Pitt"):
        return self.client.post("/api/followed-people/", {"personId": person_id, "name": name}, format="json")

    def test_follow_then_refollow_is_idempotent(self):
        first = self._follow()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual((first.data["personId"], first.data["name"]), (287, "Brad Pitt"))
        again = self._follow()
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(FollowedPerson.objects.filter(user=self.user).count(), 1)

    def test_list_is_paginated_newest_first(self):
        self._follow(1, "First")
        self._follow(2, "Second")
        res = self.client.get("/api/followed-people/")
        self.assertEqual(res.data["count"], 2)
        self.assertEqual([p["personId"] for p in res.data["results"]], [2, 1])

    def test_unfollow_and_unfollow_missing(self):
        self._follow()
        res = self.client.delete("/api/followed-people/287/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(FollowedPerson.objects.filter(user=self.user).exists())
        res = self.client.delete("/api/followed-people/287/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_unfollow_never_touches_another_users_follow(self):
        other = User.objects.create_user(username="other", password="Xk9#mQ2vTz8p")
        FollowedPerson.objects.create(user=other, person_id=287, name="Brad Pitt")
        self.client.delete("/api/followed-people/287/")
        self.assertTrue(FollowedPerson.objects.filter(user=other).exists())


class FollowedPeopleRecommendationsBudgetTests(APITestCase):
    def setUp(self):
        cache.clear()  # per-person credits are cached across requests
        self.user = User.objects.create_user(username="fenn", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.bulk_create([
            FollowedPerson(user=self.user, person_id=i, name=f"P{i}") for i in range(1, 7)
        ])

    @patch("userdata.social_views.FOLLOWED_RECS_BUDGET_SECONDS", 0.5)
    @patch("userdata.tmdb_client._get")
    def test_slow_tmdb_returns_within_budget_with_what_arrived(self, mock_get):
        release = threading.Event()
        self.addCleanup(release.set)  # let abandoned worker threads finish

        def get(path, *args, **kwargs):
            person_id = int(re.fullmatch(r"/person/(\d+)/combined_credits", path).group(1))
            if person_id != 6:
                release.wait(10)  # far past the budget
            return {"cast": [{"id": 100 + person_id, "media_type": "movie", "title": f"T{person_id}",
                              "vote_average": 7, "popularity": 10}]}
        mock_get.side_effect = get

        started = time.monotonic()
        res = self.client.get("/api/recommendations/followed-people/")
        elapsed = time.monotonic() - started

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertLess(elapsed, 0.5 + 2)
        self.assertIsNotNone(cache.get("tmdb:person_credits:6"))  # arrived in time: cached
        self.assertIsNone(cache.get("tmdb:person_credits:5"))

    def test_budget_fits_under_gunicorn_timeout(self):
        entrypoint = (Path(__file__).resolve().parents[2] / "docker-entrypoint.sh").read_text()
        match = re.search(r"gunicorn .*--timeout (\d+)", entrypoint)
        self.assertIsNotNone(match, "docker-entrypoint.sh must set gunicorn --timeout explicitly")
        self.assertLessEqual(social_views.FOLLOWED_RECS_BUDGET_SECONDS, int(match.group(1)) - 10)


class FollowedRecsSameIdTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="fizz", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.create(user=self.user, person_id=1, name="P1")

    @patch("userdata.tmdb_client._get")
    def test_movie_and_show_sharing_an_id_both_stay(self, mock_get):
        mock_get.return_value = {"cast": [
            {"id": 1399, "media_type": "movie", "title": "A Film", "vote_average": 7.5, "popularity": 10},
            {"id": 1399, "media_type": "tv", "name": "A Show", "vote_average": 8.5, "popularity": 10},
            {"id": 1399, "media_type": "tv", "name": "A Show", "vote_average": 8.5, "popularity": 10},
        ]}
        res = self.client.get("/api/recommendations/followed-people/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data[0]["items"]
        self.assertEqual(sorted((i["id"], i["type"]) for i in items), [(1399, "movie"), (1399, "tv")])


class FollowedPeopleBulkTests(APITestCase):
    """data-backup v3: follows restore create-only and keep their followed time."""

    def setUp(self):
        self.user = User.objects.create_user(username="fol", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def bulk(self, entries):
        return self.client.post("/api/followed-people/bulk/", {"entries": entries}, format="json")

    def test_restore_keeps_followed_time_and_order(self):
        res = self.bulk([
            {"personId": 7, "name": "Greta Gerwig", "profilePath": "/g.jpg", "followedAt": "2024-01-02T10:00:00Z"},
            {"personId": 287, "name": "Brad Pitt", "followedAt": "2024-05-01T10:00:00Z"},
        ])
        self.assertEqual(res.data, {"added": 2, "skipped": 0})
        listed = self.client.get("/api/followed-people/").data["results"]
        self.assertEqual([p["personId"] for p in listed], [287, 7])
        self.assertEqual(listed[1]["followedAt"].isoformat().replace("+00:00", "Z"), "2024-01-02T10:00:00Z")
        self.assertEqual(listed[1]["profilePath"], "/g.jpg")

    def test_existing_follow_is_skipped(self):
        FollowedPerson.objects.create(user=self.user, person_id=7, name="Greta Gerwig")
        res = self.bulk([{"personId": 7, "name": "Someone Else"}, {"personId": 8, "name": "New"}])
        self.assertEqual(res.data, {"added": 1, "skipped": 1})
        self.assertEqual(FollowedPerson.objects.get(user=self.user, person_id=7).name, "Greta Gerwig")

    def test_future_followed_time_is_rejected(self):
        res = self.bulk([{"personId": 7, "name": "G", "followedAt": "2999-01-01T00:00:00Z"}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(FollowedPerson.objects.filter(user=self.user).exists())

    def test_list_and_follow_responses_carry_followed_at(self):
        res = self.client.post("/api/followed-people/", {"personId": 9, "name": "N"}, format="json")
        self.assertIn("followedAt", res.data)


class FollowedRecsThrottleTests(APITestCase):
    """endpoint-time-budgets: followed-people recommendations are rate limited
    per user, and a throttled call never reaches TMDB."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.alice = User.objects.create_user(username="alice", password="Xk9#mQ2vTz8p")
        self.bob = User.objects.create_user(username="bob", password="Xk9#mQ2vTz8p")
        for user in (self.alice, self.bob):
            FollowedPerson.objects.create(user=user, person_id=287, name="Brad Pitt")

    def _get(self, user):
        self.client.force_authenticate(user=user)
        return self.client.get("/api/recommendations/followed-people/")

    @patch("userdata.social_views.FollowedRecsThrottle.get_rate", return_value="2/min")
    @patch("userdata.social_views._fetch_followed_people_credits", return_value=[])
    def test_over_limit_is_429_without_tmdb(self, fetch, _rate):
        self.assertEqual(self._get(self.alice).status_code, 200)
        self.assertEqual(self._get(self.alice).status_code, 200)
        self.assertEqual(fetch.call_count, 2)
        res = self._get(self.alice)
        self.assertEqual(res.status_code, 429)
        self.assertEqual(fetch.call_count, 2)  # throttled before any TMDB work
        self.assertEqual(self._get(self.bob).status_code, 200)

    def test_rate_is_configured(self):
        from django.conf import settings
        self.assertEqual(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["followed_recs"], "30/min")
