"""harden-account-input-2: renaming needs the current password and notifies
the account's address; passwords can't resemble the account's details; the
per-username failure limit matches usernames exactly."""
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import LoginFailure

PASSWORD = "Xk9#mQ2vTz8p"
PROFILE = "/api/auth/profile/"


def _inline_mail():
    return patch("userdata.auth_views._in_background", side_effect=lambda send: send())


class RenameRequiresPasswordTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="ivy", email="ivy@example.com", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    def _username(self):
        self.user.refresh_from_db()
        return self.user.username

    def test_rename_without_password_is_rejected(self):
        res = self.client.patch(PROFILE, {"username": "ivy2"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", res.data)
        self.assertEqual(self._username(), "ivy")

    def test_rename_with_wrong_password_counts_toward_the_limit(self):
        res = self.client.patch(PROFILE, {"username": "ivy2", "current_password": "nope-nope-1"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["current_password"], ["Incorrect password."])
        self.assertEqual(self._username(), "ivy")
        self.assertEqual(LoginFailure.objects.get().count, 1)

    def test_case_only_change_is_a_rename(self):
        res = self.client.patch(PROFILE, {"username": "Ivy"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._username(), "ivy")

    def test_rename_with_password_succeeds_and_notifies_the_address(self):
        with _inline_mail(), self.captureOnCommitCallbacks(execute=True):
            res = self.client.patch(PROFILE, {"username": "ivy2", "current_password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(self._username(), "ivy2")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ivy@example.com"])
        self.assertIn("username", mail.outbox[0].subject.lower())
        self.assertIn("ivy2", mail.outbox[0].body)

    def test_rename_and_email_change_both_go_to_the_old_address(self):
        with _inline_mail(), self.captureOnCommitCallbacks(execute=True):
            res = self.client.patch(PROFILE, {
                "username": "ivy2", "email": "new@example.com", "current_password": PASSWORD,
            }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ["ivy@example.com", "ivy@example.com"])

    def test_notice_waits_for_commit_and_mail_failure_doesnt_fail_the_rename(self):
        with patch("userdata.auth_views._in_background") as background, \
                self.captureOnCommitCallbacks(execute=False) as callbacks:
            res = self.client.patch(PROFILE, {"username": "ivy2", "current_password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        background.assert_not_called()  # nothing sent before commit
        self.assertEqual(len(callbacks), 1)
        with patch("django.core.mail.send_mail", side_effect=OSError("smtp down")), _inline_mail(), \
                self.assertLogs("userdata.auth_views", level="ERROR"):
            callbacks[0]()
        self.assertEqual(self._username(), "ivy2")

    def test_account_without_email_gets_no_notice(self):
        self.user.email = ""
        self.user.save(update_fields=["email"])
        with _inline_mail(), self.captureOnCommitCallbacks(execute=True):
            res = self.client.patch(PROFILE, {"username": "ivy2", "current_password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(mail.outbox, [])

    def test_unchanged_username_resubmitted_needs_no_password(self):
        res = self.client.patch(PROFILE, {"username": "ivy", "first_name": "Ivy"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)


class PasswordSimilarityTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_register_with_the_username_in_the_password_is_rejected(self):
        res = self.client.post("/api/auth/register/", {
            "username": "alice", "email": "", "password": "alice2024",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("similar", " ".join(res.data["password"]).lower())
        self.assertFalse(User.objects.filter(username="alice").exists())

    def test_doubled_username_is_below_djangos_threshold(self):
        # UserAttributeSimilarityValidator's default (0.7) is kept: "alicealice"
        # scores about 0.67 against "alice" and is accepted. Pinned so a change
        # of threshold is a decision, not an accident.
        res = self.client.post("/api/auth/register/", {
            "username": "alice", "email": "", "password": "alicealice",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_register_with_an_unrelated_password_still_works(self):
        res = self.client.post("/api/auth/register/", {
            "username": "alice", "email": "alice@example.com", "password": PASSWORD,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_profile_change_to_an_email_like_password_is_rejected(self):
        user = User.objects.create_user(username="bsmith", email="bob.smith@example.com", password=PASSWORD)
        self.client.force_authenticate(user=user)
        res = self.client.patch(PROFILE, {"current_password": PASSWORD, "new_password": "bobsmith123"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", res.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password(PASSWORD))

    def test_profile_checks_against_the_new_username(self):
        user = User.objects.create_user(username="oldname", password=PASSWORD)
        self.client.force_authenticate(user=user)
        res = self.client.patch(PROFILE, {
            "username": "zebrastripes", "current_password": PASSWORD, "new_password": "zebrastripes1",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", res.data)

    def test_reset_to_username_plus_digits_is_rejected_and_link_stays_usable(self):
        user = User.objects.create_user(username="carolina", email="c@example.com", password=PASSWORD)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        url = "/api/auth/password-reset/confirm/"
        res = self.client.post(url, {"uid": uid, "token": token, "new_password": "carolina2024"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("similar", res.data["detail"].lower())
        res = self.client.post(url, {"uid": uid, "token": token, "new_password": "Vq7#Lp2!wR9z"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class CaseExactLimitTests(APITestCase):
    def setUp(self):
        cache.clear()
        User.objects.create_user(username="alice", password=PASSWORD)
        User.objects.create_user(username="Alice", password=PASSWORD)

    def _login(self, username, password, ip):
        return self.client.post(
            "/api/auth/login/", {"username": username, "password": password}, format="json", REMOTE_ADDR=ip,
        )

    def test_usernames_that_differ_by_case_are_separate(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            for i in range(3):
                self.assertEqual(self._login("Alice", "wrong-pass", f"10.0.0.{i + 1}").status_code, 401)
            self.assertEqual(self._login("Alice", PASSWORD, "10.9.9.9").status_code, 429)
            self.assertEqual(self._login("alice", PASSWORD, "10.9.9.8").status_code, 200)
