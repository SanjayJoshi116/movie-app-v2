"""input-validation: inputs that reached arithmetic unchecked (voteAverage),
episode progress that needs both fields, and adding to a list that is deleted
while the request runs."""
import threading
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase

from userdata import lists_views
from userdata.models import EpisodeProgress, UserList, UserListItem, WatchedEntry, WatchlistEntry
from userdata.serializers import UserListItemSerializer

PASSWORD = "Xk9#mQ2vTz8p"


def _item(**extra):
    return {"mediaId": 550, "mediaType": "movie", "title": "Fight Club", "posterPath": None, **extra}


class VoteAverageBoundsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="vic", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    def test_single_adds_reject_out_of_range(self):
        user_list = UserList.objects.create(user=self.user, name="Faves")
        for url, model in (
            ("/api/watched/", WatchedEntry),
            ("/api/watchlist/", WatchlistEntry),
            (f"/api/lists/{user_list.pk}/items/", UserListItem),
        ):
            for value in (1e27, -3, 10.5):
                with self.subTest(url=url, value=value):
                    res = self.client.post(url, _item(voteAverage=value), format="json")
                    self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertIn("voteAverage", res.data)
            self.assertFalse(model.objects.exists())

    def test_bounds_inclusive(self):
        for value in (0, 10):
            res = self.client.post("/api/watchlist/", _item(mediaId=int(value) + 1, voteAverage=value), format="json")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_bulk_rejects_negative_and_imports_nothing(self):
        res = self.client.post("/api/watched/bulk/", {"mediaType": "movie", "entries": [
            {"mediaId": 1, "title": "A", "voteAverage": 7},
            {"mediaId": 2, "title": "B", "voteAverage": -3},
        ]}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("voteAverage", res.data["entries"]["1"])
        self.assertFalse(WatchedEntry.objects.exists())

    def test_bulk_null_still_allowed(self):
        res = self.client.post("/api/watched/bulk/", {"mediaType": "movie", "entries": [
            {"mediaId": 1, "title": "A", "voteAverage": None},
        ]}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)


@patch("userdata.stats_views.request_backfill")
@patch("userdata.stats_views._get_cached_genre_names", return_value={})
class StoredOutOfRangeVoteTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="vic", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    def test_huge_stored_vote_is_left_out_of_stats(self, *_):
        # Written before inputs were bounded; it made round_half_up raise.
        WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A", vote_average=1e27)
        WatchedEntry.objects.create(user=self.user, media_id=2, media_type="movie", title="B", vote_average=8)
        res = self.client.get("/api/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["avgTmdbRating"], 8)


class EpisodeProgressInputTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="eve", password=PASSWORD)
        self.client.force_authenticate(user=self.user)
        EpisodeProgress.objects.create(user=self.user, show_id=1399, season_number=3, episode_number=2)
        self.url = "/api/episode-progress/1399/"

    def _progress(self):
        prog = EpisodeProgress.objects.get(user=self.user, show_id=1399)
        return prog.season_number, prog.episode_number

    def test_episode_only_is_rejected(self):
        res = self.client.post(self.url, {"episode": 5}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("season", res.data)
        self.assertEqual(self._progress(), (3, 2))

    def test_season_only_is_rejected(self):
        res = self.client.post(self.url, {"season": 4}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("episode", res.data)

    def test_patch_not_allowed(self):
        res = self.client.patch(self.url, {"episode": 5}, format="json")
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self._progress(), (3, 2))

    def test_post_with_both_sets_progress(self):
        res = self.client.post(self.url, {"season": 4, "episode": 1}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._progress(), (4, 1))


class ListDeletedMidAddTests(APITransactionTestCase):
    """Real commits, so the deferred list FK is checked as in production."""

    def setUp(self):
        self.user = User.objects.create_user(username="lin", password=PASSWORD)
        self.client.force_authenticate(user=self.user)
        self.user_list = UserList.objects.create(user=self.user, name="Faves")

    def _delete_list(self):
        UserList.objects.filter(pk=self.user_list.pk).delete()

    def test_single_add(self):
        real_is_valid = UserListItemSerializer.is_valid

        def is_valid_then_delete(serializer, *args, **kwargs):
            result = real_is_valid(serializer, *args, **kwargs)
            self._delete_list()  # after the view's list lookup, before the insert
            return result

        with patch.object(UserListItemSerializer, "is_valid", is_valid_then_delete):
            res = self.client.post(f"/api/lists/{self.user_list.pk}/items/", _item(voteAverage=8), format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_bulk_add(self):
        real_timestamp = lists_views.timestamp_or_now

        def timestamp_then_delete(value):
            # Another request's delete, committed on its own connection while
            # bulk_import's transaction is open and before its insert.
            def delete():
                try:
                    self._delete_list()
                finally:
                    connection.close()

            thread = threading.Thread(target=delete)
            thread.start()
            thread.join(timeout=10)
            return real_timestamp(value)

        with patch.object(lists_views, "timestamp_or_now", timestamp_then_delete):
            res = self.client.post(f"/api/lists/{self.user_list.pk}/items/bulk/", {
                "mediaType": "movie", "entries": [{"mediaId": 1, "title": "A"}],
            }, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(UserListItem.objects.exists())

    def test_other_integrity_errors_still_raise(self):
        from django.db import IntegrityError

        with patch.object(UserListItem.objects, "get_or_create", side_effect=IntegrityError("boom")), \
                self.assertRaises(IntegrityError):
            self.client.post(f"/api/lists/{self.user_list.pk}/items/", _item(voteAverage=8), format="json")
