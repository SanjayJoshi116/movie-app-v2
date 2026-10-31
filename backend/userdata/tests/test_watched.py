from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import WatchedEntry
from userdata.bulk_import import MAX_BULK_ENTRIES


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
        self.assertEqual(res.data["skipped"], 1)  # a repeat in the request counts as skipped
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


class WatchedClearTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="clr", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        other = User.objects.create_user(username="oth", password="Xk9#mQ2vTz8p")
        WatchedEntry.objects.bulk_create(
            [WatchedEntry(user=self.user, media_id=i, media_type="movie", title="x") for i in range(1, 51)]
            + [WatchedEntry(user=other, media_id=1, media_type="movie", title="x")]
        )

    def test_clear_deletes_in_one_statement_and_schedules_one_refresh(self):
        with patch("userdata.watched_views.schedule_refresh") as refresh, \
                CaptureQueriesContext(connection) as queries:
            res = self.client.delete("/api/watched/clear/")
        self.assertEqual(res.data, {"deleted": 50})
        refresh.assert_called_once_with(self.user.id)
        self.assertFalse(any(q["sql"].lstrip().upper().startswith("SELECT") and "watchedentry" in q["sql"].lower()
                             for q in queries.captured_queries))
        self.assertEqual(WatchedEntry.objects.count(), 1)  # the other user's row stays

    def test_nothing_references_watched_entries(self):
        # watched_clear's raw delete skips cascades; a model pointing at
        # WatchedEntry would need .delete() back.
        relations = [f for f in WatchedEntry._meta.get_fields() if f.auto_created and not f.concrete]
        self.assertEqual(relations, [])
