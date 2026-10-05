from unittest.mock import patch

from django.core.cache import cache
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.test import APITestCase
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
        # token refresh is AllowAny with the default AnonRateThrottle; a bogus
        # body gets 401/400, but not 429 since health used none of the budget.
        for _ in range(2):
            res = self.client.post("/api/auth/token/refresh/", {"refresh": "x"}, format="json")
            self.assertNotEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        # Sanity: the tight rate really applies to that endpoint.
        res = self.client.post("/api/auth/token/refresh/", {"refresh": "x"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
