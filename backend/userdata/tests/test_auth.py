from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase


class RegisterTests(APITestCase):
    def test_weak_password_rejected(self):
        res = self.client.post("/api/auth/register/", {
            "username": "alice", "email": "alice@test.com", "password": "short",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="alice").exists())

    def test_common_password_rejected(self):
        res = self.client.post("/api/auth/register/", {
            "username": "bob", "email": "bob@test.com", "password": "password123",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_strong_password_accepted(self):
        res = self.client.post("/api/auth/register/", {
            "username": "carol", "email": "carol@test.com", "password": "Xk9#mQ2vTz8p",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="carol").exists())
        self.assertIn("access", res.data)


class DeleteAccountTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="dave", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_missing_password_rejected(self):
        res = self.client.delete("/api/auth/delete-account/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_wrong_password_rejected(self):
        res = self.client.delete("/api/auth/delete-account/", {"password": "nope"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_correct_password_deletes_account(self):
        res = self.client.delete("/api/auth/delete-account/", {"password": "Xk9#mQ2vTz8p"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())


class PasswordResetConfirmTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="erin", password="OldPassw0rd!9")
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.token = default_token_generator.make_token(self.user)

    def test_weak_new_password_rejected(self):
        res = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": self.uid, "token": self.token, "new_password": "short",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPassw0rd!9"))

    def test_strong_new_password_accepted(self):
        res = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": self.uid, "token": self.token, "new_password": "Br4nd#NewPass9",
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Br4nd#NewPass9"))
