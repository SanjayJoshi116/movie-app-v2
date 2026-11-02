"""library-limits, plus the bulk count and deleted-account rules (data-backup)."""

import threading
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection, transaction
from rest_framework import status
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from userdata import library_limits, watched_views
from userdata.models import (
    EpisodeProgress, FollowedPerson, RatingEntry, UserList, UserListItem, WatchedEntry, WatchlistEntry,
)

PASSWORD = "Xk9#mQ2vTz8p"


def _limits(**overrides):
    """LIMITS with lowered caps, so a test needs a handful of rows, not 20,000."""
    return patch.dict(library_limits.LIMITS, {
        name: (overrides[name], library_limits.LIMITS[name][1]) for name in overrides
    })


def _item(media_id, **extra):
    return {"mediaId": media_id, "mediaType": "movie", "title": f"T{media_id}", **extra}


class SingleAddLimitTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lim", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    def _fill(self, model, n, **fields):
        model.objects.bulk_create([model(media_id=i, media_type="movie", title="x", **fields) for i in range(1, n + 1)])

    def test_add_under_limit_saved(self):
        self._fill(WatchedEntry, 1, user=self.user)
        with _limits(watched=2):
            res = self.client.post("/api/watched/", _item(99), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_each_collection_refuses_past_its_limit(self):
        user_list = UserList.objects.create(user=self.user, name="L")
        self._fill(WatchedEntry, 2, user=self.user)
        self._fill(WatchlistEntry, 2, user=self.user)
        self._fill(RatingEntry, 2, user=self.user, user_rating=7)
        self._fill(UserListItem, 2, user_list=user_list)
        UserList.objects.create(user=self.user, name="M")
        cases = [
            ("/api/watched/", _item(99), "watched history is limited to 2 titles"),
            ("/api/watchlist/", _item(99), "watchlist is limited to 2 titles"),
            ("/api/ratings/", _item(99, userRating=8), "ratings are limited to 2 titles"),
            (f"/api/lists/{user_list.pk}/items/", _item(99), "list is limited to 2 titles"),
            ("/api/lists/", {"name": "N"}, "at most 2 lists"),
        ]
        with _limits(watched=2, watchlist=2, ratings=2, lists=2, list_items=2):
            for url, body, message in cases:
                with self.subTest(url=url):
                    res = self.client.post(url, body, format="json")
                    self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertIn(message, res.data["detail"])
        self.assertEqual(WatchedEntry.objects.count(), 2)
        self.assertEqual(UserList.objects.count(), 2)

    def test_updating_an_existing_entry_at_the_limit_is_allowed(self):
        self._fill(RatingEntry, 2, user=self.user, user_rating=7)
        self._fill(WatchedEntry, 2, user=self.user)
        with _limits(ratings=2, watched=2):
            rerate = self.client.post("/api/ratings/", _item(1, userRating=9), format="json")
            rewatch = self.client.post("/api/watched/", _item(1), format="json")
        self.assertEqual(rerate.status_code, status.HTTP_200_OK)
        self.assertEqual(RatingEntry.objects.get(media_id=1).user_rating, 9)
        self.assertEqual(rewatch.status_code, status.HTTP_200_OK)

    def test_rows_above_a_lowered_limit_stay_readable_and_removable(self):
        self._fill(WatchlistEntry, 3, user=self.user)
        with _limits(watchlist=2):
            listed = self.client.get("/api/watchlist/")
            removed = self.client.delete(f"/api/watchlist/{WatchlistEntry.objects.first().pk}/")
        self.assertEqual(listed.data["count"], 3)
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)


class FollowAndProgressLimitTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="fol", password=PASSWORD)
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.bulk_create([FollowedPerson(user=self.user, person_id=i, name="P") for i in (1, 2)])
        EpisodeProgress.objects.bulk_create([
            EpisodeProgress(user=self.user, show_id=i, season_number=1, episode_number=1) for i in (1, 2)
        ])

    def test_single_adds_past_the_limit_are_refused(self):
        with _limits(followed=2, episode_progress=2):
            follow = self.client.post("/api/followed-people/", {"personId": 3, "name": "C"}, format="json")
            progress = self.client.post("/api/episode-progress/3/", {"season": 1, "episode": 1}, format="json")
        self.assertEqual(follow.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("follow at most 2 people", follow.data["detail"])
        self.assertEqual(progress.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("limited to 2 shows", progress.data["detail"])
        self.assertEqual((FollowedPerson.objects.count(), EpisodeProgress.objects.count()), (2, 2))

    def test_refollow_and_progress_on_a_tracked_show_are_saved_at_the_limit(self):
        with _limits(followed=2, episode_progress=2):
            follow = self.client.post("/api/followed-people/", {"personId": 1, "name": "P"}, format="json")
            progress = self.client.post("/api/episode-progress/1/", {"season": 2, "episode": 5}, format="json")
        self.assertEqual(follow.status_code, status.HTTP_200_OK)
        self.assertEqual(progress.data, {"showId": 1, "season": 2, "episode": 5})
        self.assertEqual(EpisodeProgress.objects.get(user=self.user, show_id=1).season_number, 2)

    def test_bulk_restores_fill_to_the_limit(self):
        with _limits(followed=3, episode_progress=3):
            follows = self.client.post("/api/followed-people/bulk/", {"entries": [
                {"personId": 10 + i, "name": "N"} for i in range(3)
            ]}, format="json")
            progress = self.client.post("/api/episode-progress/bulk/", {"entries": [
                {"showId": 10 + i, "season": 1, "episode": 1} for i in range(3)
            ]}, format="json")
        self.assertEqual((follows.data["added"], follows.data["overLimit"]), (1, 2))
        self.assertEqual((progress.data["added"], progress.data["overLimit"]), (1, 2))


class BulkLimitAndCountTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="bulk", password=PASSWORD)
        self.client.force_authenticate(user=self.user)

    def _post(self, url, entries):
        return self.client.post(url, {"mediaType": "movie", "entries": entries}, format="json")

    def test_bulk_fills_to_the_limit_and_reports_the_rest(self):
        WatchedEntry.objects.bulk_create([
            WatchedEntry(user=self.user, media_id=i, media_type="movie", title="x") for i in range(1, 9)
        ])
        with _limits(watched=10):
            res = self._post("/api/watched/bulk/", [_item(100 + i) for i in range(5)])
        self.assertEqual(res.data, {"added": 2, "skipped": 0, "ignored": 0, "overLimit": 3})
        # Request order: the file's first rows win.
        self.assertEqual(
            set(WatchedEntry.objects.filter(media_id__gte=100).values_list("media_id", flat=True)), {100, 101}
        )

    def test_list_items_bulk_uses_the_per_list_limit(self):
        user_list = UserList.objects.create(user=self.user, name="L")
        with _limits(list_items=1):
            res = self._post(f"/api/lists/{user_list.pk}/items/bulk/", [_item(1), _item(2)])
        self.assertEqual((res.data["added"], res.data["overLimit"]), (1, 1))

    def test_counts_add_up_to_the_entries_sent(self):
        entries = [_item(i) for i in range(1, 471)]
        entries += [{"title": "no id"} for _ in range(20)]
        entries += [_item(i, title="repeat") for i in range(1, 11)]
        res = self._post("/api/watched/bulk/", entries)
        self.assertEqual(res.data, {"added": 470, "skipped": 10, "ignored": 20, "overLimit": 0})


class ConcurrentLimitTests(APITransactionTestCase):
    def test_two_adds_racing_at_the_edge_store_exactly_one(self):
        user = User.objects.create_user(username="race", password=PASSWORD)
        barrier = threading.Barrier(2)
        statuses = []

        def add(media_id):
            client = APIClient()
            client.force_authenticate(user=user)
            try:
                barrier.wait()
                statuses.append(client.post("/api/watchlist/", _item(media_id), format="json").status_code)
            finally:
                connection.close()  # each thread has its own connection

        with _limits(watchlist=1):
            threads = [threading.Thread(target=add, args=(i,)) for i in (1, 2)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=30)
        self.assertEqual(sorted(statuses), [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])
        self.assertEqual(WatchlistEntry.objects.count(), 1)

    def test_an_import_into_one_collection_does_not_hold_up_adds_to_another(self):
        user = User.objects.create_user(username="busy", password=PASSWORD)
        locked, release = threading.Event(), threading.Event()
        statuses = []

        def hold_watched_lock():
            # Stands in for a long Watched import: its limit lock, held open.
            try:
                with transaction.atomic():
                    library_limits.room("watched", user.id, WatchedEntry.objects.filter(user=user))
                    locked.set()
                    release.wait(timeout=30)
            finally:
                connection.close()

        def add_to_watchlist():
            client = APIClient()
            client.force_authenticate(user=user)
            try:
                statuses.append(client.post("/api/watchlist/", _item(1), format="json").status_code)
            finally:
                connection.close()

        holder = threading.Thread(target=hold_watched_lock)
        holder.start()
        try:
            self.assertTrue(locked.wait(timeout=10))
            adder = threading.Thread(target=add_to_watchlist)
            adder.start()
            adder.join(timeout=10)
            self.assertFalse(adder.is_alive(), "the watchlist add waited for the watched lock")
        finally:
            release.set()
            holder.join(timeout=30)
        self.assertEqual(statuses, [status.HTTP_201_CREATED])


class DeletedAccountImportTests(APITransactionTestCase):
    def test_account_deleted_mid_import_is_a_401_and_stores_nothing(self):
        user = User.objects.create_user(username="gone", password=PASSWORD)
        self.client.force_authenticate(user=user)
        real_timestamp = watched_views.timestamp_or_now

        def timestamp_then_delete(value):
            # The account deletion commits on its own connection while the
            # import's transaction is open and before its insert.
            def delete():
                try:
                    User.objects.filter(pk=user.pk).delete()
                finally:
                    connection.close()

            thread = threading.Thread(target=delete)
            thread.start()
            thread.join(timeout=10)
            return real_timestamp(value)

        with patch.object(watched_views, "timestamp_or_now", timestamp_then_delete):
            res = self.client.post(
                "/api/watched/bulk/", {"mediaType": "movie", "entries": [_item(1)]}, format="json"
            )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(WatchedEntry.objects.exists())
