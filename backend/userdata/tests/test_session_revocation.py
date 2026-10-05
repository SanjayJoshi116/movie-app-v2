from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from userdata.auth_views import _revoke_all_refresh_tokens

PASSWORD = "Xk9#mQ2vTz8p"
NEW_PASSWORD = "N3w#Passw0rd!x"


class SessionTestCase(APITestCase):
    def setUp(self):
        cache.clear()  # anon/login/password_reset throttles share the cache
        self.addCleanup(cache.clear)
        self.user = User.objects.create_user(username="max", email="max@example.com", password=PASSWORD)

    def _login(self, password=PASSWORD):
        res = self.client.post("/api/auth/login/", {"username": "max", "password": password}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        return res.data["access"], res.data["refresh"]

    def _refresh(self, token):
        return self.client.post("/api/auth/token/refresh/", {"refresh": token}, format="json")

    def _logout(self, token):
        return self.client.post("/api/auth/logout/", {"refresh": token}, format="json")


class LogoutTests(SessionTestCase):
    def test_logged_out_token_cannot_refresh(self):
        _, refresh = self._login()
        res = self._logout(refresh)  # no Authorization header at all
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._refresh(refresh).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_malformed_token_is_client_error(self):
        res = self._logout("not-a-jwt")
        self.assertGreaterEqual(res.status_code, 400)
        self.assertLess(res.status_code, 500)

    def test_already_blacklisted_token_is_client_error(self):
        _, refresh = self._login()
        self._logout(refresh)
        res = self._logout(refresh)
        self.assertGreaterEqual(res.status_code, 400)
        self.assertLess(res.status_code, 500)

    def test_deleted_user_token_is_not_server_error(self):
        _, refresh = self._login()
        self.user.delete()
        res = self._logout(refresh)
        self.assertLess(res.status_code, 500)


class PasswordResetRevocationTests(SessionTestCase):
    def test_reset_revokes_original_and_rotated_tokens(self):
        _, first = self._login()
        rotated = self._refresh(first).data["refresh"]  # rotation blacklists `first`, issues `rotated`
        _, other_device = self._login()

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        res = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid, "token": token, "new_password": NEW_PASSWORD,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        for t in (rotated, other_device):
            self.assertEqual(self._refresh(t).status_code, status.HTTP_401_UNAUTHORIZED)


class ProfilePasswordChangeTests(SessionTestCase):
    def _patch(self, access, **data):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        try:
            return self.client.patch("/api/auth/profile/", data, format="json")
        finally:
            self.client.credentials()

    def test_change_returns_working_pair_and_revokes_others(self):
        access, refresh = self._login()
        _, other_device = self._login()
        res = self._patch(access, current_password=PASSWORD, new_password=NEW_PASSWORD)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["username"], "max")
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

        self.assertEqual(self._refresh(refresh).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._refresh(other_device).status_code, status.HTTP_401_UNAUTHORIZED)
        new = self._refresh(res.data["refresh"])
        self.assertEqual(new.status_code, status.HTTP_200_OK)
        # ...and keeps working across further rotations.
        self.assertEqual(self._refresh(new.data["refresh"]).status_code, status.HTTP_200_OK)

    def test_name_only_change_issues_no_tokens_and_revokes_nothing(self):
        access, refresh = self._login()
        res = self._patch(access, first_name="Max")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn("access", res.data)
        self.assertNotIn("refresh", res.data)
        self.assertEqual(self._refresh(refresh).status_code, status.HTTP_200_OK)


class RevokeAllCostTests(SessionTestCase):
    def test_constant_queries_and_only_live_tokens_blacklisted(self):
        past = timezone.now() - timedelta(days=1)
        OutstandingToken.objects.bulk_create([
            OutstandingToken(user=self.user, jti=f"old-{i}", token=f"old-{i}", expires_at=past)
            for i in range(200)
        ])
        _, live_a = self._login()
        _, live_b = self._login()
        self._logout(live_b)  # already blacklisted: must not conflict

        with self.assertNumQueries(2):
            _revoke_all_refresh_tokens(self.user)

        for token in (live_a, live_b):
            self.assertEqual(self._refresh(token).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(BlacklistedToken.objects.filter(token__jti__startswith="old-").exists())


class SafeTokenRefreshRegressionTests(SessionTestCase):
    def test_deleted_user_refresh_is_401_not_500(self):
        _, refresh = self._login()
        self.user.delete()
        self.assertEqual(self._refresh(refresh).status_code, status.HTTP_401_UNAUTHORIZED)
