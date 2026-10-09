from datetime import datetime, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core import mail
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

PASSWORD = "Xk9#mQ2vTz8p"


class EmailChangeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ivy", email="ivy@example.com", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    def _patch(self, **data):
        return self.client.patch("/api/auth/profile/", data, format="json")

    def _email(self):
        self.user.refresh_from_db()
        return self.user.email

    def test_change_without_password_rejected(self):
        res = self._patch(email="new@example.com")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", res.data)
        self.assertEqual(self._email(), "ivy@example.com")

    def test_change_with_wrong_password_rejected(self):
        res = self._patch(email="new@example.com", current_password="wrong")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(res.data["current_password"][0]), "Incorrect password.")
        self.assertEqual(self._email(), "ivy@example.com")

    def test_change_with_correct_password_succeeds(self):
        res = self._patch(email="new@example.com", current_password=PASSWORD)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._email(), "new@example.com")

    def test_unchanged_email_any_case_needs_no_password(self):
        res = self._patch(first_name="Ivy", email="IVY@Example.com")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Ivy")
        self.assertEqual(len(mail.outbox), 0)

    def test_duplicate_email_any_case_rejected(self):
        User.objects.create_user(username="jo", email="jo@example.com", password=PASSWORD)
        res = self._patch(email="JO@example.com", current_password=PASSWORD)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(res.data["email"][0]), "An account with this email already exists.")
        self.assertEqual(self._email(), "ivy@example.com")

    def test_legacy_shared_email_can_still_save_profile(self):
        # Pre-uniqueness duplicate: resubmitting your own (shared) email must not block edits.
        User.objects.create_user(username="twin", email="ivy@example.com", password=PASSWORD)
        res = self._patch(first_name="Ivy", email="ivy@example.com")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_old_address_notified(self):
        self._patch(email="new@example.com", current_password=PASSWORD)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ivy@example.com"])
        self.assertIn("changed", mail.outbox[0].subject.lower())

    def test_mail_failure_does_not_fail_update(self):
        with patch("django.core.mail.send_mail", side_effect=OSError("smtp down")), \
                self.assertLogs("userdata.auth_views", level="ERROR"):
            res = self._patch(email="new@example.com", current_password=PASSWORD)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._email(), "new@example.com")


class PasswordResetExpiryTests(APITestCase):
    def setUp(self):
        cache.clear()  # password_reset throttle is 5/hour
        self.addCleanup(cache.clear)
        self.user = User.objects.create_user(username="lee", email="lee@example.com", password=PASSWORD)
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.issued = datetime.now()
        with patch.object(PasswordResetTokenGenerator, "_now", return_value=self.issued):
            self.token = default_token_generator.make_token(self.user)

    def _confirm_at(self, delta):
        with patch.object(PasswordResetTokenGenerator, "_now", return_value=self.issued + delta):
            return self.client.post("/api/auth/password-reset/confirm/", {
                "uid": self.uid, "token": self.token, "new_password": "N3w#Passw0rd!x",
            }, format="json")

    def test_link_valid_within_hour(self):
        res = self._confirm_at(timedelta(minutes=30))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_link_rejected_after_hour(self):
        res = self._confirm_at(timedelta(minutes=61))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "Reset link is invalid or has expired.")

    def test_reset_email_states_one_hour(self):
        with patch("userdata.auth_views._in_background", side_effect=lambda send: send()):
            self.client.post("/api/auth/password-reset/", {"email": "lee@example.com"}, format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("expires in 1 hour.", mail.outbox[0].body)


class PasswordResetTimingTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        User.objects.create_user(username="ren", email="ren@example.com", password=PASSWORD)

    def test_reset_does_not_wait_for_mail_server(self):
        import time

        from userdata import auth_views

        threads = []

        def capture(target):
            thread = auth_views.threading.Thread(target=target, daemon=True)
            threads.append(thread)
            thread.start()
            return thread

        def slow_send(*args, **kwargs):
            time.sleep(2)
            return 1

        with patch("userdata.auth_views._in_background", side_effect=capture), \
                patch("django.core.mail.send_mail", side_effect=slow_send) as send:
            start = time.monotonic()
            known = self.client.post("/api/auth/password-reset/", {"email": "ren@example.com"}, format="json")
            elapsed = time.monotonic() - start
            unknown = self.client.post("/api/auth/password-reset/", {"email": "nobody@example.com"}, format="json")
            for thread in threads:
                thread.join(5)
        self.assertLess(elapsed, 1.5)
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.data, unknown.data)
        send.assert_called_once()
        self.assertEqual(send.call_args.kwargs["recipient_list"], ["ren@example.com"])

    def test_mail_failure_is_logged_not_raised(self):
        with patch("userdata.auth_views._in_background", side_effect=lambda send: send()), \
                patch("django.core.mail.send_mail", side_effect=OSError("smtp down")), \
                self.assertLogs("userdata.auth_views", level="ERROR"):
            res = self.client.post("/api/auth/password-reset/", {"email": "ren@example.com"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class LoginFailureLimitTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        User.objects.create_user(username="alice", password=PASSWORD)
        User.objects.create_user(username="bob", password=PASSWORD)

    def _login(self, username, password, ip):
        # REMOTE_ADDR varies the per-IP throttle key, as distinct clients would.
        return self.client.post(
            "/api/auth/login/", {"username": username, "password": password}, format="json", REMOTE_ADDR=ip
        )

    def _fail(self, username, times):
        for i in range(times):
            self.assertEqual(self._login(username, "wrong-pass", f"10.0.{i // 250}.{i % 250 + 1}").status_code, 401)

    def test_distributed_guessing_is_limited(self):
        with self.settings(LOGIN_FAILURE_LIMIT=5):
            self._fail("alice", 5)
            res = self._login("ALICE", PASSWORD, "10.9.9.9")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", res)

    def test_unknown_username_limited_the_same_way(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            self._fail("ghost", 3)
            res = self._login("ghost", "anything", "10.9.9.9")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_other_users_unaffected(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            self._fail("alice", 3)
            res = self._login("bob", PASSWORD, "10.0.0.1")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_limit_clears_after_window(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            self._fail("alice", 3)
            self.assertEqual(self._login("alice", PASSWORD, "10.9.9.9").status_code, 429)
            cache.delete(_failure_key("alice"))  # what the window's expiry does
            res = self._login("alice", PASSWORD, "10.9.9.9")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_window_set_from_settings(self):
        with self.settings(LOGIN_FAILURE_WINDOW_SECONDS=1234), patch("userdata.auth_views.cache.add") as add:
            self._login("alice", "wrong-pass", "10.0.0.1")
        add.assert_any_call(_failure_key("alice"), 0, 1234)

    def test_default_limit_is_twenty(self):
        from django.conf import settings
        self.assertEqual((settings.LOGIN_FAILURE_LIMIT, settings.LOGIN_FAILURE_WINDOW_SECONDS), (20, 3600))


def _failure_key(username):
    from userdata.auth_views import _login_failure_key
    return _login_failure_key(username)
