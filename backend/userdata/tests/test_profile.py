from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="pat", email="pat@example.com", password="Xk9#mQ2vTz8p", first_name="Pat"
        )
        self.client.force_authenticate(user=self.user)

    def test_get_own_profile(self):
        res = self.client.get("/api/auth/profile/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {k: res.data[k] for k in ("id", "username", "email", "first_name")},
            {"id": self.user.id, "username": "pat", "email": "pat@example.com", "first_name": "Pat"},
        )
        self.assertNotIn("password", res.data)

    def test_patch_names(self):
        res = self.client.patch("/api/auth/profile/", {"first_name": "Patricia", "last_name": "Lee"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual((self.user.first_name, self.user.last_name), ("Patricia", "Lee"))

    def test_username_collision_is_400(self):
        User.objects.create_user(username="taken", password="Xk9#mQ2vTz8p")
        res = self.client.patch("/api/auth/profile/", {"username": "taken"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", res.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "pat")

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/auth/profile/").status_code, status.HTTP_401_UNAUTHORIZED)


class BlankEmailProfileTests(APITestCase):
    """Registration allows an account without an email; the profile form always
    resubmits the email, so a blank one must be accepted (fix-account-edges)."""

    PASSWORD = "Xk9#mQ2vTz8p"

    def setUp(self):
        self.user = User.objects.create_user(username="noemail", email="", password=self.PASSWORD)
        self.client.force_authenticate(user=self.user)

    def patch(self, body):
        return self.client.patch("/api/auth/profile/", body, format="json")

    def test_no_email_user_saves_names(self):
        res = self.patch({"first_name": "Nora", "email": ""})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.user.refresh_from_db()
        self.assertEqual((self.user.first_name, self.user.email), ("Nora", ""))

    def test_no_email_user_changes_password(self):
        res = self.patch({"email": "", "current_password": self.PASSWORD, "new_password": "Zq7!pLm4Rt2w"})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Zq7!pLm4Rt2w"))

    def test_clearing_email_needs_current_password(self):
        self.user.email = "nora@example.com"
        self.user.save()
        res = self.patch({"email": ""})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", res.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "nora@example.com")

        res = self.patch({"email": "", "current_password": self.PASSWORD})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "")

    def test_two_accounts_without_email_dont_conflict(self):
        User.objects.create_user(username="other", email="", password=self.PASSWORD)
        self.user.email = "nora@example.com"
        self.user.save()
        res = self.patch({"email": "", "current_password": self.PASSWORD})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
