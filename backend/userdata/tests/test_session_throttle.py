from unittest.mock import patch

from django.conf import settings
from rest_framework import status
from rest_framework.throttling import SimpleRateThrottle

from userdata.auth_views import SafeTokenRefreshView, TokenSessionThrottle
from userdata.tests.test_session_revocation import SessionTestCase


def _rates(**overrides):
    # SimpleRateThrottle binds THROTTLE_RATES at import, so override_settings
    # wouldn't reach it; patch the class attribute instead.
    return patch.object(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {**settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], **overrides},
    )


class TokenSessionThrottleTests(SessionTestCase):
    def test_refresh_and_logout_ignore_exhausted_anon_and_user_buckets(self):
        _, refresh = self._login()
        with _rates(anon="0/day", user="0/day"):
            res = self._refresh(refresh)
            self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
            self.assertEqual(self._logout(res.data["refresh"]).status_code, status.HTTP_200_OK)

    def test_refresh_flood_is_limited(self):
        _, refresh = self._login()
        with _rates(token_refresh="3/min"):
            for _ in range(3):
                res = self._refresh(refresh)
                self.assertNotEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
                refresh = res.data.get("refresh", refresh)
            self.assertEqual(self._refresh(refresh).status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_rate_covers_many_users_behind_one_address(self):
        # 50 users refreshing hourly all day from one NAT address.
        num, per_seconds = TokenSessionThrottle().parse_rate(
            settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["token_refresh"]
        )
        self.assertGreaterEqual(num * 86400 / per_seconds, 50 * 24)
        # ...and the scope isn't stacked on top of the per-IP daily defaults.
        self.assertEqual(tuple(SafeTokenRefreshView.throttle_classes), (TokenSessionThrottle,))
