from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from userdata import recommendations
from userdata.models import UserRecommendationCache

SECTION = {"key": "trending", "label": "Trending This Week", "items": []}


@patch("userdata.recommendations._spawn_refresh")  # never start a real background thread
class RecommendationEndpointTests(APITestCase):
    def setUp(self):
        recommendations._computing_users.clear()
        recommendations._rerun_users.clear()
        self.user = User.objects.create_user(username="rex", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        recommendations._computing_users.clear()

    def test_cold_cache_is_pending_and_starts_refresh(self, spawn):
        for url in ("/api/recommendations/for-you/", "/api/recommendations/personalized/"):
            with self.subTest(url=url):
                recommendations._computing_users.clear()
                spawn.reset_mock()
                res = self.client.get(url)
                self.assertEqual(res.data, {"status": "pending", "sections": []})
                spawn.assert_called_once_with(self.user.id)

    def test_warm_cache_is_ready_with_sections(self, spawn):
        UserRecommendationCache.objects.create(user=self.user, for_you_json=[SECTION], personalized_json=[SECTION])
        for url in ("/api/recommendations/for-you/", "/api/recommendations/personalized/"):
            with self.subTest(url=url):
                res = self.client.get(url)
                self.assertEqual(res.data, {"status": "ready", "sections": [SECTION]})
        spawn.assert_not_called()

    def test_stale_cache_serves_sections_and_refreshes(self, spawn):
        cache = UserRecommendationCache.objects.create(user=self.user, for_you_json=[SECTION])
        UserRecommendationCache.objects.filter(pk=cache.pk).update(computed_at=timezone.now() - timedelta(days=2))
        res = self.client.get("/api/recommendations/for-you/")
        self.assertEqual(res.data, {"status": "pending", "sections": [SECTION]})
        spawn.assert_called_once_with(self.user.id)
