import io
import shutil
import tempfile
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage, default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from django.test import override_settings
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

        with self.captureOnCommitCallbacks(execute=True):
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

        with self.captureOnCommitCallbacks(execute=True):
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


class AvatarLifecycleTests(APITestCase):
    """Replaced, removed and orphaned avatar files, against a throwaway MEDIA_ROOT."""

    def setUp(self):
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        override = override_settings(MEDIA_ROOT=media)
        override.enable()
        self.addCleanup(override.disable)
        self.user = User.objects.create_user(username="ivy", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _upload(self, color="red"):
        buf = io.BytesIO()
        Image.new("RGB", (20, 20), color=color).save(buf, format="PNG")
        f = SimpleUploadedFile("avatar.png", buf.getvalue(), content_type="image/png")
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")
        self.user.refresh_from_db()  # drop the cached profile relation (see test_delete_clears_avatar)
        return res

    def _stored_files(self):
        _, files = default_storage.listdir("avatars")
        return files

    def test_same_format_reupload_gets_new_url_and_drops_old_file(self):
        # Three uploads: with a fixed name, storage only suffixes the second
        # (the first still exists then); the third reused the first's URL.
        urls = [self._upload(color).data["avatar_url"] for color in ("red", "green")]
        first_name = Profile.objects.get(user=self.user).avatar.name
        second = self._upload("blue")
        second_name = Profile.objects.get(user=self.user).avatar.name

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        urls.append(second.data["avatar_url"])
        self.assertEqual(len(set(urls)), 3, urls)
        self.assertFalse(default_storage.exists(first_name))
        self.assertTrue(default_storage.exists(second_name))
        self.assertEqual(self._stored_files(), [second_name.rsplit("/", 1)[-1]])

    def test_account_deletion_removes_avatar_file(self):
        self._upload()
        name = Profile.objects.get(user=self.user).avatar.name
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.delete("/api/auth/delete-account/", {"password": "Xk9#mQ2vTz8p"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(default_storage.exists(name))
        self.assertEqual(self._stored_files(), [])

    def _assert_failed_replace_kept(self, old_name):
        self.assertEqual(Profile.objects.get(user=self.user).avatar.name, old_name)
        self.assertEqual(self._stored_files(), [old_name.rsplit("/", 1)[-1]])  # old kept, new not orphaned

    def test_row_save_failure_keeps_old_avatar(self):
        self._upload("red")
        old_name = Profile.objects.get(user=self.user).avatar.name
        self.client.raise_request_exception = False
        with patch.object(Profile, "_do_update", side_effect=DatabaseError("db down")):
            res = self._upload("blue")
        self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self._assert_failed_replace_kept(old_name)

    def test_storage_failure_keeps_old_avatar(self):
        self._upload("red")
        old_name = Profile.objects.get(user=self.user).avatar.name
        self.client.raise_request_exception = False
        with patch.object(FileSystemStorage, "_save", side_effect=OSError("disk full")):
            res = self._upload("blue")
        self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self._assert_failed_replace_kept(old_name)


def make_polyglot_file(name="x.html"):
    # A real PNG with an HTML payload appended — decodes fine, but a browser
    # served it as text/html would run the script.
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color="blue").save(buf, format="PNG")
    payload = buf.getvalue() + b"<html><script>alert(document.domain)</script></html>"
    return SimpleUploadedFile(name, payload, content_type="image/png")


class AvatarTypeFromContentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="gwen", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        self.addCleanup(self._remove_avatar_file)

    def _remove_avatar_file(self):
        profile = Profile.objects.filter(user=self.user).first()
        if profile and profile.avatar:
            profile.avatar.delete(save=False)

    def _upload(self, f):
        return self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")

    def test_png_named_html_stored_as_png(self):
        res = self._upload(make_image_file(name="avatar.html"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(Profile.objects.get(user=self.user).avatar.name.endswith(".png"))

    def test_jpeg_named_png_stored_as_jpg(self):
        res = self._upload(make_image_file(name="a.png", fmt="JPEG", content_type="image/png"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(Profile.objects.get(user=self.user).avatar.name.endswith(".jpg"))

    def test_gif_declared_jpeg_rejected(self):
        res = self._upload(make_image_file(name="a.jpg", fmt="GIF", content_type="image/jpeg"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "Unsupported image type. Use JPEG, PNG, or WebP.")
        self.assertFalse(Profile.objects.get(user=self.user).avatar)

    def test_text_declared_png_rejected(self):
        f = SimpleUploadedFile("a.png", b"just text", content_type="image/png")
        res = self._upload(f)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "File is not a valid image.")

    def test_polyglot_served_as_image(self):
        res = self._upload(make_polyglot_file())
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        name = Profile.objects.get(user=self.user).avatar.name
        self.assertTrue(name.endswith(".png"))
        served = self.client.get(f"/media/{name}")
        self.assertEqual(served.status_code, 200)
        self.assertTrue(served["Content-Type"].startswith("image/"))
        self.assertEqual(served["X-Content-Type-Options"], "nosniff")
        b"".join(served.streaming_content)  # exhaust via the client wrapper; .close() would drop the test DB connection

    def test_upload_path_refuses_unsafe_extension(self):
        from ..models import avatar_upload_path

        profile = Profile(user=self.user)
        self.assertRegex(avatar_upload_path(profile, "a.WEBP"), rf"^avatars/user_{self.user.id}_\d+\.webp$")
        with self.assertRaises(ValueError):
            avatar_upload_path(profile, "a.html")


class LegacyAvatarCleanupMigrationTests(APITestCase):
    def setUp(self):
        import importlib

        from django.core.files.storage import default_storage

        self.migration = importlib.import_module("userdata.migrations.0018_cleanup_unsafe_avatar_extensions")
        self.storage = default_storage
        self.user = User.objects.create_user(username="hal", password="Xk9#mQ2vTz8p")
        self.profile = Profile.objects.create(user=self.user)
        self.addCleanup(self._cleanup)

    def _cleanup(self):
        self.profile.refresh_from_db()
        if self.profile.avatar:
            self.profile.avatar.delete(save=False)

    def _seed(self, content):
        name = self.storage.save(f"avatars/user_{self.user.id}.html", io.BytesIO(content))
        Profile.objects.filter(pk=self.profile.pk).update(avatar=name)
        return name

    def _run(self):
        from django.apps import apps

        self.migration.cleanup_unsafe_avatars(apps, None)
        self.profile.refresh_from_db()

    def test_valid_image_with_html_extension_is_renamed(self):
        old = self._seed(make_polyglot_file().read())
        self._run()
        self.assertTrue(self.profile.avatar.name.endswith(".png"))
        self.assertTrue(self.storage.exists(self.profile.avatar.name))
        self.assertFalse(self.storage.exists(old))

    def test_non_image_with_html_extension_is_cleared(self):
        old = self._seed(b"<script>alert(1)</script>")
        self._run()
        self.assertFalse(self.profile.avatar)
        self.assertFalse(self.storage.exists(old))

    def test_missing_file_is_cleared(self):
        Profile.objects.filter(pk=self.profile.pk).update(avatar=f"avatars/user_{self.user.id}.html")
        self._run()
        self.assertFalse(self.profile.avatar)

    def test_safe_extension_untouched(self):
        name = self.storage.save(f"avatars/user_{self.user.id}.png", io.BytesIO(b"not even decoded"))
        Profile.objects.filter(pk=self.profile.pk).update(avatar=name)
        self._run()
        self.assertEqual(self.profile.avatar.name, name)


class AvatarMetadataTests(APITestCase):
    """Uploads are re-encoded: no EXIF survives, orientation is baked in."""

    def setUp(self):
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        override = override_settings(MEDIA_ROOT=media)
        override.enable()
        self.addCleanup(override.disable)
        self.user = User.objects.create_user(username="exa", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _upload_jpeg(self, exif, size=(40, 20)):
        buf = io.BytesIO()
        Image.new("RGB", size, color="blue").save(buf, format="JPEG", exif=exif)
        f = SimpleUploadedFile("photo.jpg", buf.getvalue(), content_type="image/jpeg")
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        stored = Profile.objects.get(user=self.user).avatar
        with default_storage.open(stored.name, "rb") as fh:
            return Image.open(io.BytesIO(fh.read()))

    def test_gps_exif_is_stripped(self):
        exif = Image.Exif()
        exif[0x010F] = "PhoneMaker"  # Make
        exif[0xA431] = "SERIAL-12345"  # BodySerialNumber
        exif[0x8825] = {2: (51.0, 30.0, 0.0), 1: "N"}  # GPS IFD
        img = self._upload_jpeg(exif)
        self.assertEqual(dict(img.getexif()), {})
        self.assertNotIn("exif", img.info)

    def test_orientation_is_applied_then_dropped(self):
        exif = Image.Exif()
        exif[0x0112] = 6  # rotate 90° clockwise to display
        img = self._upload_jpeg(exif, size=(40, 20))
        self.assertEqual(img.size, (20, 40))
        self.assertNotIn(0x0112, img.getexif())

    def test_png_and_webp_still_upload(self):
        for fmt, ext, ctype in (("PNG", "png", "image/png"), ("WEBP", "webp", "image/webp")):
            with self.subTest(fmt=fmt):
                buf = io.BytesIO()
                Image.new("RGBA", (20, 20), color=(0, 255, 0, 128)).save(buf, format=fmt)
                f = SimpleUploadedFile(f"a.{ext}", buf.getvalue(), content_type=ctype)
                with self.captureOnCommitCallbacks(execute=True):
                    res = self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")
                self.user.refresh_from_db()  # drop the cached profile on the shared force_authenticate user
                self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
                self.assertTrue(Profile.objects.get(user=self.user).avatar.name.endswith(f".{ext}"))

    def test_truncated_image_rejected(self):
        buf = io.BytesIO()
        Image.new("RGB", (200, 200), color="red").save(buf, format="JPEG")
        data = buf.getvalue()[:400]  # header intact, pixel data cut off
        f = SimpleUploadedFile("cut.jpg", data, content_type="image/jpeg")
        res = self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
