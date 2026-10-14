"""account-security: an email address belongs to one account, even when two
requests claim it at once. auth_user.email has no unique index, so the views
re-check under a per-address advisory lock (auth_views._email_taken_under_lock).
"""
import threading
import time
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TransactionTestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from userdata import auth_views
from userdata.serializers import RegisterSerializer, UserProfileUpdateSerializer

PASSWORD = "Xk9#mQ2vTz8p"


def _no_serializer_check(self, value):
    """Both racing requests pass the serializer's check before either commits."""
    return value


class EmailRecheckTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ana", email="ana@example.com", password=PASSWORD)
        User.objects.create_user(username="ben", email="Taken@Example.com", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    @patch.object(UserProfileUpdateSerializer, "validate_email", _no_serializer_check)
    def test_profile_change_to_a_taken_address_is_rejected_under_the_lock(self):
        res = self.client.patch("/api/auth/profile/", {
            "email": "taken@example.com", "current_password": PASSWORD,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "ana@example.com")

    @patch.object(RegisterSerializer, "validate_email", _no_serializer_check)
    def test_register_with_a_taken_address_is_rejected_under_the_lock(self):
        self.client.force_authenticate(user=None)
        res = self.client.post("/api/auth/register/", {
            "username": "cal", "email": "TAKEN@example.com", "password": PASSWORD,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)
        self.assertFalse(User.objects.filter(username="cal").exists())

    def test_unchanged_email_resubmit_still_saves(self):
        res = self.client.patch("/api/auth/profile/", {"email": "ANA@example.com", "first_name": "Ana"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class ConcurrentEmailChangeTests(TransactionTestCase):
    """Real commits on separate connections: exactly one of two simultaneous
    switches to the same address wins."""

    def test_two_users_switch_to_one_address_at_once(self):
        users = [
            User.objects.create_user(username=f"u{i}", email=f"u{i}@example.com", password=PASSWORD)
            for i in range(2)
        ]
        barrier = threading.Barrier(2)
        codes = []

        def switch(user):
            try:
                client = APIClient()
                client.force_authenticate(user=user)
                barrier.wait()
                res = client.patch("/api/auth/profile/", {
                    "email": "same@example.com", "current_password": PASSWORD,
                }, format="json")
                codes.append(res.status_code)
            finally:
                connection.close()

        real_check = auth_views._email_taken_under_lock

        def slow_check(email, exclude_pk=None):
            # Hold the transaction (and the lock) open after the check, so
            # without the lock both requests would pass it before either saves.
            taken = real_check(email, exclude_pk)
            time.sleep(0.5)
            return taken

        with patch.object(UserProfileUpdateSerializer, "validate_email", _no_serializer_check), \
                patch.object(auth_views, "_email_taken_under_lock", slow_check):
            threads = [threading.Thread(target=switch, args=(u,)) for u in users]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=30)

        self.assertEqual(sorted(codes), [200, 400])
        self.assertEqual(User.objects.filter(email__iexact="same@example.com").count(), 1)


class LockFoldTests(APITestCase):
    """The advisory lock must fold case the way the check (email__iexact,
    UPPER() on PostgreSQL) does, or two addresses the check calls equal can take
    different locks and race. Which pairs fold together depends on the
    database's collation; this dev DB folds none of these, Docker's glibc one
    may fold some. Either way: equal under iexact means the same lock key."""

    PAIRS = (
        ("\u017fam@example.com", "sam@example.com"),  # long s: upper is S, lower stays
        ("\u212aim@example.com", "kim@example.com"),  # Kelvin sign: lower is k
        ("stra\u00dfe@example.com", "STRASSE@example.com"),
        ("Ana@Example.com", "ana@example.com"),
    )

    def test_equal_under_iexact_means_same_lock(self):
        for a, b in self.PAIRS:
            User.objects.all().delete()
            User.objects.create_user(username="x", email=a, password=PASSWORD)
            same_to_check = User.objects.filter(email__iexact=b).exists()
            with connection.cursor() as cursor:
                cursor.execute("SELECT hashtext(upper(%s)) = hashtext(upper(%s))", [a, b])
                same_lock = cursor.fetchone()[0]
            if same_to_check:
                self.assertTrue(same_lock, (a, b))

    def test_lock_uses_upper(self):
        from django.db import transaction
        from django.test.utils import CaptureQueriesContext

        with transaction.atomic(), CaptureQueriesContext(connection) as ctx:
            auth_views._email_taken_under_lock("ana@example.com")
        self.assertIn("hashtext(upper(", ctx.captured_queries[0]["sql"])
