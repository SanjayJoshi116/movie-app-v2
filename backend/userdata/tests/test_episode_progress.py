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


class EpisodeProgressListAndBulkTests(APITestCase):
    """data-backup v3: progress can be listed for export and restored create-only."""

    def setUp(self):
        self.user = User.objects.create_user(username="eve", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_list_pages_every_show_once(self):
        for show_id in range(1, 131):
            EpisodeProgress.objects.create(user=self.user, show_id=show_id, season_number=1, episode_number=2)
        seen, page = [], 1
        while True:
            res = self.client.get(f"/api/episode-progress/?page={page}")
            self.assertEqual(res.status_code, 200)
            seen += [r["showId"] for r in res.data["results"]]
            if not res.data["next"]:
                break
            page += 1
        self.assertEqual(sorted(seen), list(range(1, 131)))
        self.assertEqual(set(res.data["results"][0]), {"showId", "season", "episode", "updatedAt"})

    def test_bulk_is_create_only(self):
        EpisodeProgress.objects.create(user=self.user, show_id=1396, season_number=3, episode_number=1)
        res = self.client.post("/api/episode-progress/bulk/", {"entries": [
            {"showId": 1396, "season": 2, "episode": 5},
            {"showId": 1399, "season": 1, "episode": 4},
        ]}, format="json")
        self.assertEqual(res.data, {"added": 1, "skipped": 1})
        kept = EpisodeProgress.objects.get(user=self.user, show_id=1396)
        self.assertEqual((kept.season_number, kept.episode_number), (3, 1))
        self.assertTrue(EpisodeProgress.objects.filter(user=self.user, show_id=1399, episode_number=4).exists())

    def test_bulk_rejects_bad_entries_and_oversized_bodies(self):
        bad = self.client.post("/api/episode-progress/bulk/", {"entries": [{"showId": 1, "season": 0, "episode": 1}]},
                               format="json")
        self.assertEqual(bad.status_code, 400)
        big = self.client.post("/api/episode-progress/bulk/", {"entries": [
            {"showId": i, "season": 1, "episode": 1} for i in range(1, 502)
        ]}, format="json")
        self.assertEqual(big.status_code, 400)
        self.assertFalse(EpisodeProgress.objects.filter(user=self.user).exists())
