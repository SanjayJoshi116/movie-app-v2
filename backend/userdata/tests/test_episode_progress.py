from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import EpisodeProgress

URL = "/api/episode-progress/1396/"


class EpisodeProgressTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ed", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_get_without_progress_is_null(self):
        res = self.client.get(URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data)

    def test_post_then_patch_round_trip(self):
        res = self.client.post(URL, {"season": 1, "episode": 3}, format="json")
        self.assertEqual(res.data, {"showId": 1396, "season": 1, "episode": 3})

        self.client.patch(URL, {"season": 2, "episode": 1}, format="json")
        self.assertEqual(self.client.get(URL).data, {"showId": 1396, "season": 2, "episode": 1})
        self.assertEqual(EpisodeProgress.objects.filter(user=self.user).count(), 1)

    def test_delete_clears_progress(self):
        self.client.post(URL, {"season": 1, "episode": 3}, format="json")
        res = self.client.delete(URL)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNone(self.client.get(URL).data)

    def test_progress_is_per_user(self):
        other = User.objects.create_user(username="other", password="Xk9#mQ2vTz8p")
        EpisodeProgress.objects.create(user=other, show_id=1396, season_number=5, episode_number=9)
        self.assertIsNone(self.client.get(URL).data)
        self.client.delete(URL)
        self.assertTrue(EpisodeProgress.objects.filter(user=other).exists())
