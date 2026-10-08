from unittest.mock import patch

from django.core.cache import cache
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory, APITestCase
from rest_framework.throttling import AnonRateThrottle

# SimpleRateThrottle binds THROTTLE_RATES at class definition, so
# override_settings wouldn't reach it — patch the class attribute instead.
TIGHT_RATES = {**api_settings.DEFAULT_THROTTLE_RATES, "anon": "2/day"}


@patch.object(AnonRateThrottle, "THROTTLE_RATES", TIGHT_RATES)
class HealthThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_health_never_throttled(self):
        for _ in range(10):
            res = self.client.get("/api/health/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data, {"status": "ok"})

    def test_health_does_not_consume_anon_allowance(self):
        for _ in range(10):
            self.client.get("/api/health/")
        # No AllowAny endpoint is left on the default anon throttle (token refresh
        # and logout moved to their own scope), so check the anon counter itself:
        # the key the default AnonRateThrottle would use for this test client.
        request = Request(APIRequestFactory().get("/api/health/"))
        key = AnonRateThrottle().get_cache_key(request, view=None)
        self.assertIsNotNone(key)
        self.assertIsNone(cache.get(key))
