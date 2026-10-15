import threading
import time
from datetime import datetime, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core import mail
from django.core.cache import cache
from django.db import connection
from django.db.models import F
from django.test import override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from userdata.models import LoginFailure

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

    def _patch_committed(self, **data):
        """PATCH and run its on-commit callbacks, with the background send inline."""
        with patch("userdata.auth_views._in_background", side_effect=lambda send: send()), \
                self.captureOnCommitCallbacks(execute=True):
            return self._patch(**data)

    def test_old_address_notified(self):
        self._patch_committed(email="new@example.com", current_password=PASSWORD)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ivy@example.com"])
        self.assertIn("changed", mail.outbox[0].subject.lower())

    def test_notice_waits_for_commit(self):
        with patch("userdata.auth_views._in_background") as background, \
                self.captureOnCommitCallbacks(execute=False) as callbacks:
            self._patch(email="new@example.com", current_password=PASSWORD)
        background.assert_not_called()
        self.assertEqual(len(callbacks), 1)

    def test_mail_failure_does_not_fail_update(self):
        with patch("django.core.mail.send_mail", side_effect=OSError("smtp down")), \
                self.assertLogs("userdata.auth_views", level="ERROR"):
            res = self._patch_committed(email="new@example.com", current_password=PASSWORD)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._email(), "new@example.com")

    def test_stalled_mail_server_does_not_hold_the_response(self):
        # The mail server accepts but never answers: send_mail blocks until
        # released. The response, the revoke and the fresh tokens must not wait.
        release = threading.Event()
        self.addCleanup(release.set)
        other_session = RefreshToken.for_user(self.user)
        started = time.monotonic()
        with patch("django.core.mail.send_mail", side_effect=lambda *a, **k: release.wait(30)), \
                self.captureOnCommitCallbacks(execute=True):
            res = self._patch(email="new@example.com", current_password=PASSWORD, new_password="N3w#Passw0rd!x")
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=other_session["jti"]).exists())

    def test_email_timeout_configured(self):
        from django.conf import settings
        self.assertEqual(settings.EMAIL_TIMEOUT, 10)


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

    def test_reset_link_built_on_frontend_url(self):
        # settings strips FRONTEND_URL's trailing slash (test_settings_fail_closed);
        # this pins the link built on the stripped value: no "//reset-password".
        with override_settings(FRONTEND_URL="https://cinedb.example.com"), \
                patch("userdata.auth_views._in_background", side_effect=lambda send: send()):
            self.client.post("/api/auth/password-reset/", {"email": "lee@example.com"}, format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f"\nhttps://cinedb.example.com/reset-password/{self.uid}/", mail.outbox[0].body)


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
            res = self._login("alice", PASSWORD, "10.9.9.9")
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
            _age_window("alice", seconds=3601)
            res = self._login("alice", PASSWORD, "10.9.9.9")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_limit_outlasts_default_cache_timeout(self):
        # DatabaseCache's incr reset the expiry to 300 s, so the lock lapsed
        # after 5 minutes in production. 10 minutes on, it must still hold.
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            self._fail("alice", 3)
            _age_window("alice", seconds=600)
            res = self._login("alice", PASSWORD, "10.9.9.9")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertTrue(2990 <= int(res["Retry-After"]) <= 3000, res["Retry-After"])

    def test_window_runs_from_first_failure(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            self._fail("alice", 1)
            _age_window("alice", seconds=3000)
            self._fail("alice", 2)  # later failures don't move the window
            self.assertEqual(self._login("alice", PASSWORD, "10.9.9.9").status_code, 429)
            _age_window("alice", seconds=601)  # first failure now 3601 s ago
            res = self._login("alice", PASSWORD, "10.9.9.9")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_failure_after_window_starts_new_one(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            self._fail("alice", 2)
            _age_window("alice", seconds=3601)
            self._fail("alice", 1)
            row = LoginFailure.objects.get(key=_failure_key("alice"))
        self.assertEqual(row.count, 1)
        self.assertLess(timezone.now() - row.window_start, timedelta(seconds=60))

    def test_expired_rows_are_removed(self):
        self._fail("bob", 1)
        _age_window("bob", seconds=3601)
        self._fail("alice", 1)
        self.assertFalse(LoginFailure.objects.filter(key=_failure_key("bob")).exists())

    def test_window_set_from_settings(self):
        with self.settings(LOGIN_FAILURE_LIMIT=1, LOGIN_FAILURE_WINDOW_SECONDS=1234):
            self._fail("alice", 1)
            res = self._login("alice", PASSWORD, "10.9.9.9")
        self.assertTrue(1220 <= int(res["Retry-After"]) <= 1234, res["Retry-After"])

    def test_default_limit_is_twenty(self):
        from django.conf import settings
        self.assertEqual((settings.LOGIN_FAILURE_LIMIT, settings.LOGIN_FAILURE_WINDOW_SECONDS), (20, 3600))


class PasswordGatedActionLimitTests(APITestCase):
    """Profile password checks and account deletion share login's per-username
    limit, so a stolen session can't guess the password without bound."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = User.objects.create_user(username="alice", email="alice@example.com", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    def _patch(self, **data):
        return self.client.patch("/api/auth/profile/", data, format="json")

    def _change_password(self, current):
        return self._patch(current_password=current, new_password="N3w#Passw0rd!x")

    def test_wrong_current_passwords_trip_every_gate(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            for _ in range(3):
                self.assertEqual(self._change_password("wrong-pass").status_code, 400)
            self.assertEqual(self._change_password(PASSWORD).status_code, 429)
            delete = self.client.delete("/api/auth/delete-account/", {"password": PASSWORD}, format="json")
            self.client.force_authenticate(user=None)
            login = self.client.post("/api/auth/login/", {"username": "alice", "password": PASSWORD}, format="json")
        self.assertEqual(delete.status_code, 429)
        self.assertEqual(login.status_code, 429)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_wrong_password_response_unchanged(self):
        res = self._change_password("wrong-pass")
        self.assertEqual(res.data, {"current_password": ["Incorrect password."]})

    def test_missing_current_password_is_not_a_failure(self):
        self._patch(new_password="N3w#Passw0rd!x")
        self.assertFalse(LoginFailure.objects.exists())

    def test_wrong_delete_password_counts(self):
        with self.settings(LOGIN_FAILURE_LIMIT=2):
            for _ in range(2):
                res = self.client.delete("/api/auth/delete-account/", {"password": "nope"}, format="json")
                self.assertEqual(res.status_code, 400)
            res = self.client.delete("/api/auth/delete-account/", {"password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 429)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_name_only_edit_while_limited(self):
        with self.settings(LOGIN_FAILURE_LIMIT=1):
            self._change_password("wrong-pass")
            res = self._patch(first_name="Alice", email="alice@example.com")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["first_name"], "Alice")


class PasswordResetClearsLimitTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = User.objects.create_user(username="alice", email="alice@example.com", password=PASSWORD)
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))

    def _confirm(self, new_password):
        return self.client.post("/api/auth/password-reset/confirm/", {
            "uid": self.uid, "token": default_token_generator.make_token(self.user), "new_password": new_password,
        }, format="json")

    def test_reset_clears_lockout(self):
        with self.settings(LOGIN_FAILURE_LIMIT=3):
            for i in range(3):
                self.client.post("/api/auth/login/", {"username": "alice", "password": "wrong"},
                                 format="json", REMOTE_ADDR=f"10.0.0.{i + 1}")
            self.assertEqual(self._confirm("N3w#Passw0rd!x").status_code, 200)
            res = self.client.post("/api/auth/login/", {"username": "alice", "password": "N3w#Passw0rd!x"},
                                   format="json", REMOTE_ADDR="10.9.9.9")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_confirm_has_its_own_rate_limit(self):
        with patch("userdata.auth_views._in_background"):
            for _ in range(2):
                res = self.client.post("/api/auth/password-reset/", {"email": "alice@example.com"}, format="json")
                self.assertEqual(res.status_code, 200)
        for _ in range(3):
            self.assertEqual(self._confirm("short").status_code, 400)
        self.assertEqual(self._confirm("N3w#Passw0rd!x").status_code, 200)

    def test_confirm_rate_is_configured(self):
        from django.conf import settings
        self.assertEqual(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["password_reset_confirm"], "10/hour")


def _failure_key(username):
    from userdata.auth_views import _login_failure_key
    return _login_failure_key(username)


def _age_window(username, seconds):
    """Move username's failure window `seconds` into the past, as time passing would."""
    LoginFailure.objects.filter(key=_failure_key(username)).update(
        window_start=F("window_start") - timedelta(seconds=seconds)
    )


def _parallel_failures(key, n):
    """Record n failures for key from n threads released at the same moment."""
    from userdata.auth_views import _record_login_failure

    barrier = threading.Barrier(n)

    def fail():
        try:
            barrier.wait()
            _record_login_failure(key)
        finally:
            connection.close()  # each thread has its own connection

    threads = [threading.Thread(target=fail) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


class LoginFailureConcurrencyTests(APITransactionTestCase):
    """The counter on the real database with real concurrent writers. The old
    cache counter's get + set lost most of a parallel burst."""

    def test_parallel_failures_all_count(self):
        from userdata.auth_views import _login_failures

        _parallel_failures(_failure_key("alice"), 20)
        self.assertEqual(_login_failures(_failure_key("alice")), 20)

    def test_parallel_burst_trips_limit(self):
        User.objects.create_user(username="alice", password=PASSWORD)
        _parallel_failures(_failure_key("alice"), 20)
        res = self.client.post("/api/auth/login/", {"username": "alice", "password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
