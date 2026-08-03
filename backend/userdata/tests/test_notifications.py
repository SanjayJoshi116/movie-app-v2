from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import FollowedPerson, NotificationCheckpoint


class NewReleaseNotificationsTests(APITestCase):
    def setUp(self):
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
