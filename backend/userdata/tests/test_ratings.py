from datetime import timedelta
from unittest.mock import patch

import requests
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

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
