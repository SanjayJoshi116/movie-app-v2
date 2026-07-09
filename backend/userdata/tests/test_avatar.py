import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import Profile


def make_image_file(name="avatar.png", fmt="PNG", content_type="image/png", size=(20, 20)):
    buf = io.BytesIO()
    Image.new("RGB", size, color="red").save(buf, format=fmt)
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type=content_type)


class AvatarUploadTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="frank", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_upload_valid_image_succeeds(self):
        res = self.client.post("/api/auth/avatar/", {"avatar": make_image_file()}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res.data["avatar_url"])
        self.assertTrue(Profile.objects.filter(user=self.user).exists())

    def test_no_file_rejected(self):
        res = self.client.post("/api/auth/avatar/", {}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_file_rejected(self):
        big = SimpleUploadedFile("big.png", b"0" * (5 * 1024 * 1024 + 1), content_type="image/png")
        res = self.client.post("/api/auth/avatar/", {"avatar": big}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_wrong_content_type_rejected(self):
        f = SimpleUploadedFile("notes.txt", b"just some text", content_type="text/plain")
        res = self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_spoofed_content_type_rejected(self):
        f = SimpleUploadedFile("fake.png", b"not actually an image", content_type="image/png")
        res = self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_clears_avatar(self):
        self.client.post("/api/auth/avatar/", {"avatar": make_image_file()}, format="multipart")
        profile = Profile.objects.get(user=self.user)
        old_name = profile.avatar.name
        self.assertTrue(profile.avatar.storage.exists(old_name))

        # force_authenticate reuses the same `self.user` instance across requests within a
        # test, unlike real traffic (fresh request.user per JWT-authenticated request). The
        # first POST's response serialization caches the "profile" reverse relation on that
        # shared instance; refresh it here so this call sees the up-to-date relation.
        self.user.refresh_from_db()
        self.client.force_authenticate(user=self.user)

        res = self.client.delete("/api/auth/avatar/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data["avatar_url"])
        profile.refresh_from_db()
        self.assertFalse(profile.avatar)
        self.assertFalse(profile.avatar.storage.exists(old_name))

    def test_reupload_replaces_without_orphaning(self):
        self.client.post("/api/auth/avatar/", {"avatar": make_image_file(name="first.png")}, format="multipart")
        profile = Profile.objects.get(user=self.user)
        first_name = profile.avatar.name
        storage = profile.avatar.storage

        self.client.post(
            "/api/auth/avatar/",
            {"avatar": make_image_file(name="second.jpg", fmt="JPEG", content_type="image/jpeg")},
            format="multipart",
        )
        profile.refresh_from_db()
        second_name = profile.avatar.name

        self.assertNotEqual(first_name, second_name)
        self.assertFalse(storage.exists(first_name))
        self.assertTrue(storage.exists(second_name))
