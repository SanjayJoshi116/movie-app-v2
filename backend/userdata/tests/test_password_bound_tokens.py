from unittest import mock

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from django.contrib.auth.hashers import PBKDF2PasswordHasher
from rest_framework_simplejwt.tokens import RefreshToken

from userdata.tests.test_session_revocation import NEW_PASSWORD, PASSWORD, SessionTestCase


class PasswordBoundTokenTests(SessionTestCase):
    def _api(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        try:
            return self.client.get("/api/watchlist/")
        finally:
            self.client.credentials()

    def _change_password(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        try:
            res = self.client.patch(
                "/api/auth/profile/",
                {"current_password": PASSWORD, "new_password": NEW_PASSWORD},
                format="json",
            )
        finally:
            self.client.credentials()
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        return res.data

    def _reset_password(self):
        self.user.refresh_from_db()  # a sign-in sets last_login, part of the reset token
        res = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": urlsafe_base64_encode(force_bytes(self.user.pk)),
            "token": default_token_generator.make_token(self.user),
            "new_password": NEW_PASSWORD,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_refresh_racing_a_password_change_does_not_survive(self):
        access, r1 = self._login()
        # Another device's refresh, split around the change exactly as
        # TokenRefreshSerializer.validate() runs it: R1 is validated before the
        # change, and the rotated R2 is recorded after the revoke snapshot.
        in_flight = RefreshToken(r1)
        in_flight.blacklist()
        self._change_password(access)
        in_flight.set_jti()
        in_flight.set_exp()
        in_flight.set_iat()
        in_flight.outstand()
        r2, r2_access = str(in_flight), str(in_flight.access_token)

        self.assertEqual(self._refresh(r2).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._api(r2_access).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_change_ends_other_access_tokens_at_once(self):
        access, _ = self._login()
        other_access, _ = self._login()
        self.assertEqual(self._api(other_access).status_code, status.HTTP_200_OK)

        body = self._change_password(access)

        self.assertEqual(self._api(other_access).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._api(access).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._api(body["access"]).status_code, status.HTTP_200_OK)
        rotated = self._refresh(body["refresh"])
        self.assertEqual(rotated.status_code, status.HTTP_200_OK)
        self.assertEqual(self._api(rotated.data["access"]).status_code, status.HTTP_200_OK)

    def test_reset_ends_all_pre_reset_tokens(self):
        access, refresh = self._login()
        self._reset_password()
        self.assertEqual(self._refresh(refresh).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._api(access).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_without_password_claim_is_rejected(self):
        # Shape of every token issued before CHECK_REVOKE_TOKEN was turned on.
        legacy = RefreshToken.for_user(self.user)
        del legacy["hash_password"]
        self.assertEqual(self._refresh(str(legacy)).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self._api(str(legacy.access_token)).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_name_only_edit_keeps_existing_tokens(self):
        access, refresh = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        try:
            res = self.client.patch("/api/auth/profile/", {"first_name": "Max"}, format="json")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertNotIn("access", res.data)
        finally:
            self.client.credentials()
        self.assertEqual(self._api(access).status_code, status.HTTP_200_OK)
        self.assertEqual(self._refresh(refresh).status_code, status.HTTP_200_OK)

    def _upgradable_hash_session(self):
        """A hash made under other hasher parameters (e.g. Django 6.0's iteration
        count) and a session minted for it: verifying it could upgrade the hash."""
        hasher = PBKDF2PasswordHasher()
        self.user.password = hasher.encode(PASSWORD, hasher.salt(), iterations=hasher.iterations + 1)
        self.user.save(update_fields=["password"])
        return RefreshToken.for_user(self.user), self.user.password

    def _patch(self, access, body):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        try:
            return self.client.patch("/api/auth/profile/", body, format="json")
        finally:
            self.client.credentials()

    def test_email_change_checks_the_password_without_rehashing(self):
        stale, old_hash = self._upgradable_hash_session()
        res = self._patch(stale.access_token, {"email": "max2@example.com", "current_password": PASSWORD})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertNotIn("access", res.data)  # no claim change, so no new tokens needed
        self.user.refresh_from_db()
        self.assertEqual(self.user.password, old_hash)
        self.assertEqual(self._api(stale.access_token).status_code, status.HTTP_200_OK)
        self.assertEqual(self._refresh(str(stale)).status_code, status.HTTP_200_OK)

    def test_failed_update_with_the_right_password_keeps_the_session(self):
        stale, old_hash = self._upgradable_hash_session()
        res = self._patch(
            stale.access_token,
            {"email": "max2@example.com", "current_password": PASSWORD, "new_password": "short"},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.password, old_hash)
        self.assertEqual(self._api(stale.access_token).status_code, status.HTTP_200_OK)
        self.assertEqual(self._refresh(str(stale)).status_code, status.HTTP_200_OK)

    def test_profile_edit_in_flight_keeps_a_concurrent_reset(self):
        # The edit's user row is read at authentication, before the reset commits.
        access = RefreshToken.for_user(self.user).access_token
        real_save = User.save

        def reset_then_save(user, *args, **kwargs):
            if kwargs.get("update_fields") == ["first_name"]:
                fresh = User.objects.get(pk=user.pk)
                fresh.set_password(NEW_PASSWORD)
                fresh.save(update_fields=["password"])
            return real_save(user, *args, **kwargs)

        with mock.patch.object(User, "save", reset_then_save):
            res = self._patch(access, {"first_name": "Max"})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Max")
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        self.assertFalse(self.user.check_password(PASSWORD))

    def test_several_gated_fields_verify_the_password_once(self):
        from userdata import serializers

        access = RefreshToken.for_user(self.user).access_token
        with mock.patch.object(serializers, "check_password", wraps=serializers.check_password) as check:
            res = self._patch(access, {
                "email": "max2@example.com", "username": "max2",
                "current_password": PASSWORD, "new_password": NEW_PASSWORD,
            })
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(check.call_count, 1)

    def test_failed_account_deletion_keeps_the_hash_and_session(self):
        from django.db import DatabaseError

        stale, old_hash = self._upgradable_hash_session()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {stale.access_token}")
        try:
            with mock.patch.object(User, "delete", side_effect=DatabaseError("down")), \
                    self.assertRaises(DatabaseError):
                self.client.delete("/api/auth/delete-account/", {"password": PASSWORD}, format="json")
        finally:
            self.client.credentials()
        self.user.refresh_from_db()
        self.assertEqual(self.user.password, old_hash)
        self.assertEqual(self._api(stale.access_token).status_code, status.HTTP_200_OK)
