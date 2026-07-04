from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import WatchlistEntry


class WatchlistPaginationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="pat", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        WatchlistEntry.objects.bulk_create([
            WatchlistEntry(user=self.user, media_id=i, media_type="movie", title=f"Movie {i}")
            for i in range(150)
        ])

    def test_first_page_returns_paginated_shape(self):
        res = self.client.get("/api/watchlist/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 150)
        self.assertEqual(len(res.data["results"]), 100)
        self.assertIsNotNone(res.data["next"])

    def test_second_page_returns_remainder(self):
        res = self.client.get("/api/watchlist/", {"page": 2})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["results"]), 50)
        self.assertIsNone(res.data["next"])

    def test_only_returns_own_entries(self):
        other = User.objects.create_user(username="quinn", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=other)
        res = self.client.get("/api/watchlist/")
        self.assertEqual(res.data["count"], 0)
