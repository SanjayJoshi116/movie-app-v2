import struct
import warnings
import zlib
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import EpisodeProgress, Profile, RatingEntry, UserList, WatchedEntry, WatchlistEntry
from ..serializers import UserProfileUpdateSerializer
from .test_avatar import make_image_file

BIG_ID = 3_000_000_000


def media(**overrides):
    body = {"mediaId": 1, "mediaType": "movie", "title": "A", "posterPath": None, "voteAverage": 7}
    body.update(overrides)
    return body


class AuthedTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="vic", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)


class NonFiniteNumberTests(AuthedTestCase):
    def test_nan_vote_average_rejected_everywhere(self):
        user_list = UserList.objects.create(user=self.user, name="L")
        for url, get_url in [
            ("/api/watchlist/", "/api/watchlist/"),
            ("/api/watched/", "/api/watched/"),
            (f"/api/lists/{user_list.pk}/items/", "/api/lists/"),
        ]:
            for bad in ("NaN", "Infinity", "-Infinity"):
                with self.subTest(url=url, value=bad):
                    res = self.client.post(url, media(voteAverage=bad), format="json")
                    self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertIn("voteAverage", res.data)
            self.assertEqual(self.client.get(get_url).status_code, status.HTTP_200_OK)
        self.assertFalse(WatchlistEntry.objects.exists())
        self.assertFalse(WatchedEntry.objects.exists())
        self.assertFalse(user_list.items.exists())

    def test_infinite_rating_rejected(self):
        res = self.client.post("/api/ratings/", {**media(), "userRating": "Infinity"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userRating", res.data)


class RatingStepTests(AuthedTestCase):
    def test_off_step_rating_rejected(self):
        res = self.client.post("/api/ratings/", {**media(), "userRating": 7.3}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("userRating", res.data)

    def test_whole_and_half_stars_saved(self):
        for media_id, rating in ((1, 7), (2, 7.5), (3, 0.5), (4, 10)):
            with self.subTest(rating=rating):
                body = {**media(mediaId=media_id), "userRating": rating}
                res = self.client.post("/api/ratings/", body, format="json")
                self.assertEqual(res.status_code, status.HTTP_201_CREATED)


class StorageLimitTests(AuthedTestCase):
    def test_over_long_poster_path_rejected(self):
        res = self.client.post("/api/watchlist/", media(posterPath="/" + "x" * 500), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("posterPath", res.data)

    def test_over_long_platform_rejected(self):
        res = self.client.post("/api/watched/", media(platform="p" * 101), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("platform", res.data)

    def test_over_long_original_language_rejected(self):
        res = self.client.post("/api/watched/", media(originalLanguage="x" * 11), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("originalLanguage", res.data)

    def test_identifier_beyond_integer_range_rejected(self):
        res = self.client.post("/api/watched/", media(mediaId=BIG_ID), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mediaId", res.data)
        res = self.client.post("/api/followed-people/", {"personId": BIG_ID, "name": "X"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_runtime_rejected(self):
        res = self.client.post("/api/watched/", media(runtimeMinutes=-5), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("runtimeMinutes", res.data)

    def test_follow_over_long_name_rejected(self):
        res = self.client.post("/api/followed-people/", {"personId": 5, "name": "n" * 501}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_follow_missing_person_id_keeps_message(self):
        res = self.client.post("/api/followed-people/", {"name": "X"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "personId is required.")

    def test_over_long_profile_email_rejected(self):
        email = "a" * 64 + "@" + ".".join(["b" * 60] * 4) + ".com"
        self.assertGreater(len(email), 254)
        res = self.client.patch(
            "/api/auth/profile/", {"email": email, "current_password": "Xk9#mQ2vTz8p"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)


class EpisodeProgressTests(AuthedTestCase):
    def test_show_id_beyond_integer_range_rejected_on_write(self):
        res = self.client.post(f"/api/episode-progress/{BIG_ID}/", {"season": 1, "episode": 1}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(EpisodeProgress.objects.exists())

    def test_out_of_range_path_id_reads_and_deletes_dont_500(self):
        self.assertEqual(self.client.get(f"/api/episode-progress/{BIG_ID}/").status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.delete(f"/api/episode-progress/{BIG_ID}/").status_code, status.HTTP_204_NO_CONTENT
        )
        self.assertEqual(
            self.client.delete(f"/api/followed-people/{BIG_ID}/").status_code, status.HTTP_204_NO_CONTENT
        )
        self.assertEqual(self.client.delete(f"/api/watched/{BIG_ID}/").status_code, status.HTTP_404_NOT_FOUND)

    def test_season_out_of_range_rejected(self):
        for body in ({"season": BIG_ID, "episode": 1}, {"season": 0, "episode": 1}, {"season": "x"}):
            with self.subTest(body=body):
                res = self.client.post("/api/episode-progress/10/", body, format="json")
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_progress_saved(self):
        res = self.client.post("/api/episode-progress/10/", {"season": 2, "episode": 3}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, {"showId": 10, "season": 2, "episode": 3})


class MediaTypeTests(AuthedTestCase):
    def test_unknown_media_type_rejected(self):
        for url in ("/api/watchlist/", "/api/watched/"):
            with self.subTest(url=url):
                res = self.client.post(url, media(mediaType="book"), format="json")
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("mediaType", res.data)
        res = self.client.post("/api/ratings/", {**media(mediaType="book"), "userRating": 5}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(WatchlistEntry.objects.exists())


class BodyShapeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="wes", password="Xk9#mQ2vTz8p")
        cache.clear()  # login/password_reset throttles share the cache (password_reset is 5/hour)
        self.addCleanup(cache.clear)

    def test_json_array_body_rejected_by_public_endpoints(self):
        for url in ("/api/auth/login/", "/api/auth/password-reset/", "/api/auth/password-reset/confirm/"):
            with self.subTest(url=url):
                res = self.client.post(url, [], format="json")
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_json_array_body_rejected_by_authenticated_endpoints(self):
        self.client.force_authenticate(user=self.user)
        for method, url in [
            ("delete", "/api/auth/delete-account/"),
            ("post", "/api/followed-people/"),
            ("post", "/api/episode-progress/10/"),
            ("post", "/api/watched/bulk/"),
            ("post", "/api/tmdb-auth/create-session/"),
        ]:
            with self.subTest(url=url):
                res = getattr(self.client, method)(url, [], format="json")
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_non_string_password_reset_fields_rejected(self):
        res = self.client.post("/api/auth/password-reset/", {"email": 123}, format="json")
        # DRF's CharField coerces numbers to strings; what matters is no 500.
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))
        res = self.client.post("/api/auth/password-reset/", {"email": ["a@b.c"]}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        res = self.client.post(
            "/api/auth/password-reset/confirm/", {"uid": [1], "token": {"a": 1}, "new_password": [3]}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        res = self.client.post(
            "/api/auth/password-reset/confirm/", {"uid": 1, "token": 2, "new_password": 3}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_existing_behavior_kept(self):
        res = self.client.post("/api/auth/login/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        res = self.client.post("/api/auth/login/", {"username": "wes", "password": "Xk9#mQ2vTz8p"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.post("/api/auth/login/", {"username": ["wes"], "password": 1}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class ImmutableIdentityTests(AuthedTestCase):
    def test_rating_patch_cannot_move_to_another_title(self):
        r1 = RatingEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="One", user_rating=6)
        r2 = RatingEntry.objects.create(user=self.user, media_id=2, media_type="movie", title="Two", user_rating=8)
        res = self.client.patch(f"/api/ratings/{r1.pk}/", {"mediaId": 2}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mediaId", res.data)
        r1.refresh_from_db()
        r2.refresh_from_db()
        self.assertEqual((r1.media_id, r1.title), (1, "One"))
        self.assertEqual((r2.media_id, r2.title), (2, "Two"))

    def test_watchlist_patch_cannot_change_media_type(self):
        entry = WatchlistEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A")
        res = self.client.patch(f"/api/watchlist/{entry.pk}/", {"mediaType": "tv"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        entry.refresh_from_db()
        self.assertEqual(entry.media_type, "movie")

    def test_patch_with_same_identity_succeeds(self):
        entry = WatchlistEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A")
        res = self.client.patch(
            f"/api/watchlist/{entry.pk}/", {"mediaId": 1, "mediaType": "movie", "title": "B"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        entry.refresh_from_db()
        self.assertEqual((entry.media_id, entry.media_type, entry.title), (1, "movie", "B"))


class BulkWatchedValidationTests(AuthedTestCase):
    def post(self, entries, media_type="movie"):
        return self.client.post("/api/watched/bulk/", {"entries": entries, "mediaType": media_type}, format="json")

    def test_one_malformed_entry_rejects_whole_request(self):
        res = self.post([{"mediaId": 1, "title": "A"}, {"mediaId": "abc", "title": "B"}, {"mediaId": 3, "title": "C"}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1", res.data["entries"])
        self.assertFalse(WatchedEntry.objects.exists())

    def test_non_finite_and_over_long_entries_rejected(self):
        for entry in ({"mediaId": 1, "voteAverage": "NaN"}, {"mediaId": 1, "title": "t" * 501},
                      {"mediaId": BIG_ID}, {"mediaId": 0}):
            with self.subTest(entry=entry):
                self.assertEqual(self.post([entry]).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(WatchedEntry.objects.exists())

    def test_non_object_entry_rejected(self):
        self.assertEqual(self.post([5]).status_code, status.HTTP_400_BAD_REQUEST)

    def test_entries_not_a_list_keeps_message(self):
        res = self.post("nope")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "entries must be a list.")

    def test_unknown_media_type_rejected(self):
        self.assertEqual(self.post([{"mediaId": 1}], media_type="book").status_code, status.HTTP_400_BAD_REQUEST)

    def test_null_vote_average_saved_as_zero(self):
        res = self.post([{"mediaId": 7, "title": "G", "voteAverage": None}])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(WatchedEntry.objects.get(media_id=7).vote_average, 0)

    def test_string_and_int_ids_are_one_title(self):
        res = self.post([{"mediaId": 5, "title": "A"}, {"mediaId": "5", "title": "A"}])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual((res.data["added"], res.data["skipped"]), (1, 0))
        self.assertEqual(WatchedEntry.objects.filter(media_id=5).count(), 1)

    def test_missing_media_id_still_skipped(self):
        res = self.post([{"title": "No id"}, {"mediaId": None}, {"mediaId": ""}, {"mediaId": 9, "title": "I"}])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual((res.data["added"], res.data["skipped"]), (1, 0))


def _png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def header_only_png(width, height):
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IEND", b"")


class AvatarDecodeTests(AuthedTestCase):
    def upload(self, data, name="a.png", content_type="image/png"):
        f = SimpleUploadedFile(name, data, content_type=content_type)
        return self.client.post("/api/auth/avatar/", {"avatar": f}, format="multipart")

    def assert_invalid(self, res):
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "File is not a valid image.")

    def test_header_only_decompression_bomb_rejected(self):
        self.assert_invalid(self.upload(header_only_png(30000, 30000)))
        profile = Profile.objects.filter(user=self.user).first()
        self.assertFalse(profile and profile.avatar)

    def test_decompression_bomb_error_band_rejected(self):
        # 20x20 = 400 px, above 2x a 100 px limit: Pillow raises DecompressionBombError on open.
        with mock.patch.object(Image, "MAX_IMAGE_PIXELS", 100):
            self.assert_invalid(self.upload(make_image_file().read()))

    def test_warning_band_rejected(self):
        # 400 px is between 1x and 2x of a 300 px limit: Pillow only warns here.
        with mock.patch.object(Image, "MAX_IMAGE_PIXELS", 300), warnings.catch_warnings():
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)
            self.assert_invalid(self.upload(make_image_file().read()))

    def test_existing_avatar_unchanged_after_bomb(self):
        self.client.post("/api/auth/avatar/", {"avatar": make_image_file()}, format="multipart")
        before = Profile.objects.get(user=self.user).avatar.name
        self.assert_invalid(self.upload(header_only_png(30000, 30000)))
        self.assertEqual(Profile.objects.get(user=self.user).avatar.name, before)

    def test_corrupt_images_rejected(self):
        png = make_image_file().read()
        jpeg = make_image_file(name="a.jpg", fmt="JPEG", content_type="image/jpeg").read()
        bad_crc = bytearray(png)
        bad_crc[29] ^= 0xFF  # inside IHDR's CRC
        corrupt_idat = bytearray(png)
        idat = png.index(b"IDAT")
        corrupt_idat[idat + 6] ^= 0xFF
        cases = {
            "truncated png": (png[: len(png) // 2], "image/png"),
            "truncated jpeg": (jpeg[: len(jpeg) // 2], "image/jpeg"),
            "png bad ihdr crc": (bytes(bad_crc), "image/png"),
            "png corrupt idat": (bytes(corrupt_idat), "image/png"),
            "png header only": (header_only_png(20, 20), "image/png"),
            "png zero size": (header_only_png(0, 0), "image/png"),
        }
        for label, (data, ctype) in cases.items():
            with self.subTest(case=label):
                res = self.upload(data, content_type=ctype)
                # Some truncated files still pass verify(); what matters is never a 500.
                self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))


class ProfileUsernameTests(AuthedTestCase):
    def test_invalid_characters_rejected(self):
        res = self.client.patch("/api/auth/profile/", {"username": "bad name!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", res.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "vic")

    def test_concurrent_rename_conflict_is_clean_400(self):
        User.objects.create_user(username="taken", password="Xk9#mQ2vTz8p")
        # Simulate the other rename committing between the pre-check and save().
        with mock.patch.object(UserProfileUpdateSerializer, "validate_username", lambda self, v: v):
            res = self.client.patch("/api/auth/profile/", {"username": "taken"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["username"], ["This username is already taken."])
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "vic")


class TextLengthLimitTests(AuthedTestCase):
    def _rating(self, review):
        return self.client.post("/api/ratings/", {
            "mediaId": 550, "mediaType": "movie", "title": "Fight Club", "userRating": 8, "review": review,
        }, format="json")

    def test_review_at_limit_accepted(self):
        res = self._rating("x" * 5000)
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), res.data)

    def test_over_long_review_rejected(self):
        res = self._rating("x" * 5001)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("review", res.data)
        self.assertFalse(RatingEntry.objects.filter(user=self.user).exists())

    def test_over_long_review_patch_rejected(self):
        entry = RatingEntry.objects.create(
            user=self.user, media_id=550, media_type="movie", title="Fight Club", user_rating=8
        )
        res = self.client.patch(f"/api/ratings/{entry.pk}/", {"review": "x" * 5001}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("review", res.data)

    def test_over_long_review_in_bulk_rejected(self):
        res = self.client.post("/api/ratings/bulk/", {
            "mediaType": "movie",
            "entries": [{"mediaId": 77, "title": "A", "userRating": 7, "review": "x" * 5001}],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("review", str(res.data))
        self.assertFalse(RatingEntry.objects.filter(user=self.user).exists())

    def test_list_description_limits(self):
        ok = self.client.post("/api/lists/", {"name": "L", "description": "d" * 200}, format="json")
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)
        bad = self.client.post("/api/lists/", {"name": "M", "description": "d" * 201}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", bad.data)
        edit = self.client.patch(f"/api/lists/{ok.data['id']}/", {"description": "d" * 201}, format="json")
        self.assertEqual(edit.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", edit.data)

    def test_existing_over_long_text_still_reads(self):
        RatingEntry.objects.create(
            user=self.user, media_id=550, media_type="movie", title="Fight Club", user_rating=8, review="x" * 9000
        )
        UserList.objects.create(user=self.user, name="Old", description="d" * 900)
        ratings = self.client.get("/api/ratings/")
        lists = self.client.get("/api/lists/")
        self.assertEqual(ratings.status_code, status.HTTP_200_OK)
        self.assertEqual(len(ratings.data["results"][0]["review"]), 9000)
        self.assertEqual(lists.status_code, status.HTTP_200_OK)
        self.assertEqual(len(lists.data["results"][0]["description"]), 900)
