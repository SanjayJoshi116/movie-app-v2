import ipaddress

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

LOGIN_LIMIT = 10  # settings: "login": "10/min"


def _ip(n):
    """Synthetic client address; the tests only need distinct values per n."""
    return str(ipaddress.IPv4Address(n + 1))


# Real client as nginx appends it, vs. values a client could make up itself.
REAL_CLIENT = _ip(1000)
OTHER_REAL_CLIENT = _ip(2000)
SPOOFED = [_ip(i) for i in range(LOGIN_LIMIT + 1)]


def _rest_framework(num_proxies):
    return {**settings.REST_FRAMEWORK, "NUM_PROXIES": num_proxies}


class ThrottleIdentityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def _login(self, xff):
        return self.client.post(
            "/api/auth/login/",
            {"username": "nobody", "password": "wrong"},
            format="json",
            HTTP_X_FORWARDED_FOR=xff,
        )

    @override_settings(REST_FRAMEWORK=_rest_framework(0))
    def test_spoofed_xff_does_not_mint_new_buckets(self):
        for ip in SPOOFED[:LOGIN_LIMIT]:
            self.assertNotEqual(self._login(ip).status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(self._login(SPOOFED[LOGIN_LIMIT]).status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(REST_FRAMEWORK=_rest_framework(1))
    def test_spoofed_left_entries_ignored_behind_one_proxy(self):
        # nginx appends the real address last; whatever the client put before it is ignored.
        for ip in SPOOFED[:LOGIN_LIMIT]:
            self._login(f"{ip}, {REAL_CLIENT}")
        res = self._login(f"{SPOOFED[LOGIN_LIMIT]}, {REAL_CLIENT}")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(REST_FRAMEWORK=_rest_framework(1), CACHES={"default": settings.PRODUCTION_CACHE})
    def test_counters_survive_many_active_clients_in_production_cache(self):
        call_command("createcachetable", verbosity=0)
        for _ in range(LOGIN_LIMIT):
            self._login(REAL_CLIENT)
        # 350 other clients' counters, sorting after ours so a default-sized
        # (300) DatabaseCache would cull ours first.
        for i in range(350):
            cache.set(f"throttle_login_zz-client-{i}", [0.0], 60)
        self.assertEqual(self._login(REAL_CLIENT).status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(REST_FRAMEWORK=_rest_framework(1))
    def test_distinct_real_clients_have_separate_allowances(self):
        for _ in range(LOGIN_LIMIT):
            self._login(REAL_CLIENT)
        self.assertEqual(self._login(REAL_CLIENT).status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertNotEqual(self._login(OTHER_REAL_CLIENT).status_code, status.HTTP_429_TOO_MANY_REQUESTS)
