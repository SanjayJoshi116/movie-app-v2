from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
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
        finally:
            self.client.credentials()
        self.assertEqual(self._api(access).status_code, status.HTTP_200_OK)
        self.assertEqual(self._refresh(refresh).status_code, status.HTTP_200_OK)
