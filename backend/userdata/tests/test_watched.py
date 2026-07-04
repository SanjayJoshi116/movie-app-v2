from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import WatchedEntry
from userdata.watched_views import MAX_BULK_ENTRIES


class WatchedPaginationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sam", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        WatchedEntry.objects.bulk_create([
            WatchedEntry(user=self.user, media_id=i, media_type="movie", title=f"Movie {i}")
            for i in range(120)
        ])

    def test_paginated_response_shape(self):
        res = self.client.get("/api/watched/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 120)
        self.assertEqual(len(res.data["results"]), 100)


class BulkWatchedTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tina", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_bulk_add_new_entries(self):
        res = self.client.post("/api/watched/bulk/", {
            "mediaType": "movie",
            "entries": [
                {"mediaId": 1, "title": "A"},
                {"mediaId": 2, "title": "B"},
            ],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["added"], 2)
        self.assertEqual(res.data["skipped"], 0)
        self.assertEqual(WatchedEntry.objects.filter(user=self.user).count(), 2)

    def test_bulk_skips_already_watched(self):
        WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A")
        res = self.client.post("/api/watched/bulk/", {
            "mediaType": "movie",
            "entries": [{"mediaId": 1, "title": "A"}, {"mediaId": 2, "title": "B"}],
        }, format="json")
        self.assertEqual(res.data["added"], 1)
        self.assertEqual(res.data["skipped"], 1)

    def test_bulk_dedupes_within_same_payload(self):
        res = self.client.post("/api/watched/bulk/", {
            "mediaType": "movie",
            "entries": [{"mediaId": 1, "title": "A"}, {"mediaId": 1, "title": "A dup"}],
        }, format="json")
        self.assertEqual(res.data["added"], 1)
        self.assertEqual(res.data["skipped"], 0)
        self.assertEqual(WatchedEntry.objects.filter(user=self.user, media_id=1).count(), 1)

    def test_bulk_rejects_over_max_entries(self):
        entries = [{"mediaId": i, "title": "A"} for i in range(MAX_BULK_ENTRIES + 1)]
        res = self.client.post("/api/watched/bulk/", {
            "mediaType": "movie", "entries": entries,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WatchedEntry.objects.filter(user=self.user).count(), 0)

    def test_bulk_rejects_invalid_media_type(self):
        res = self.client.post("/api/watched/bulk/", {
            "mediaType": "bogus", "entries": [{"mediaId": 1, "title": "A"}],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
