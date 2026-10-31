from datetime import datetime, timedelta, UTC
from unittest import mock

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import RatingEntry, TMDBProfile, UserList, UserListItem, WatchedEntry, WatchlistEntry

PAST = "2024-03-01T20:00:00Z"
PAST_DT = datetime(2024, 3, 1, 20, 0, tzinfo=UTC)


def future_iso():
    return (timezone.now() + timedelta(days=1)).isoformat()


class BulkTestCase(APITestCase):
    url = ""

    def setUp(self):
        self.user = User.objects.create_user(username="bea", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def post(self, entries, media_type="movie"):
        return self.client.post(self.url, {"entries": entries, "mediaType": media_type}, format="json")


class BulkWatchedTests(BulkTestCase):
    url = "/api/watched/bulk/"

    def test_watched_at_runtime_and_platform_stored(self):
        res = self.post([{"mediaId": 1, "title": "A", "watchedAt": PAST, "runtimeMinutes": 139, "platform": "Netflix"}])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        entry = WatchedEntry.objects.get(media_id=1)
        self.assertEqual(entry.watched_at, PAST_DT)
        self.assertEqual((entry.runtime_minutes, entry.platform), (139, "Netflix"))

    def test_missing_watched_at_uses_now(self):
        before = timezone.now()
        self.post([{"mediaId": 1, "title": "A"}])
        self.assertGreaterEqual(WatchedEntry.objects.get(media_id=1).watched_at, before)

    def test_future_watched_at_rejected(self):
        res = self.post([{"mediaId": 1, "title": "A"}, {"mediaId": 2, "watchedAt": future_iso()}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1", res.data["entries"])
        self.assertFalse(WatchedEntry.objects.exists())

    def test_unparseable_watched_at_rejected(self):
        res = self.post([{"mediaId": 1, "watchedAt": "yesterday-ish"}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_per_entry_media_type_overrides_default(self):
        res = self.post([{"mediaId": 1, "mediaType": "tv"}, {"mediaId": 2}], media_type="movie")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(WatchedEntry.objects.get(media_id=1).media_type, "tv")
        self.assertEqual(WatchedEntry.objects.get(media_id=2).media_type, "movie")

    def test_same_id_different_types_are_two_titles(self):
        res = self.post([{"mediaId": 1, "mediaType": "tv"}, {"mediaId": 1, "mediaType": "movie"}])
        self.assertEqual((res.data["added"], res.data["skipped"]), (2, 0))

    def test_counts_with_existing_entries(self):
        WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A")
        WatchedEntry.objects.create(user=self.user, media_id=2, media_type="tv", title="B")
        res = self.post([{"mediaId": 1}, {"mediaId": 2}, {"mediaId": 3}])
        self.assertEqual((res.data["added"], res.data["skipped"]), (2, 1))
        self.assertTrue(WatchedEntry.objects.filter(media_id=2, media_type="movie").exists())

    def test_existing_entry_not_overwritten(self):
        WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="Old", platform="Hulu")
        self.post([{"mediaId": 1, "title": "New", "platform": "Netflix", "watchedAt": PAST}])
        entry = WatchedEntry.objects.get(media_id=1)
        self.assertEqual((entry.title, entry.platform), ("Old", "Hulu"))

    def test_refresh_scheduled_once_when_something_added(self):
        with (
            mock.patch("userdata.recommendations.request_refresh") as refresh,
            self.captureOnCommitCallbacks(execute=True),
        ):
            res = self.post([{"mediaId": 1}, {"mediaId": 2}, {"mediaId": 3}])
        self.assertEqual(res.data["added"], 3)
        refresh.assert_called_once_with(self.user.id, rerun_if_running=True)

    def test_no_refresh_when_everything_skipped(self):
        WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A")
        with (
            mock.patch("userdata.recommendations.request_refresh") as refresh,
            self.captureOnCommitCallbacks(execute=True),
        ):
            res = self.post([{"mediaId": 1}])
        self.assertEqual(res.data["added"], 0)
        refresh.assert_not_called()


class BulkWatchlistTests(BulkTestCase):
    url = "/api/watchlist/bulk/"

    def test_create_only_with_added_at(self):
        WatchlistEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="Old")
        res = self.post([
            {"mediaId": 1, "title": "New", "addedAt": PAST},
            {"mediaId": 2, "title": "B", "addedAt": PAST, "posterPath": "/b.jpg", "voteAverage": 7.5},
        ])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual((res.data["added"], res.data["skipped"]), (1, 1))
        self.assertEqual(WatchlistEntry.objects.get(media_id=1).title, "Old")
        new = WatchlistEntry.objects.get(media_id=2)
        self.assertEqual((new.added_at, new.poster_path, new.vote_average), (PAST_DT, "/b.jpg", 7.5))

    def test_validation_errors(self):
        for entry in ({"mediaId": 1, "voteAverage": "NaN"}, {"mediaId": 1, "mediaType": "book"},
                      {"mediaId": 1, "addedAt": future_iso()}, {"mediaId": 1, "posterPath": "x" * 501}):
            with self.subTest(entry=entry):
                self.assertEqual(self.post([entry]).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(WatchlistEntry.objects.exists())

    def test_cap_enforced(self):
        res = self.post([{"mediaId": i} for i in range(1, 502)])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class BulkRatingsTests(BulkTestCase):
    url = "/api/ratings/bulk/"

    def test_existing_rating_unchanged(self):
        RatingEntry.objects.create(
            user=self.user, media_id=550, media_type="movie", title="FC", user_rating=9, review="Mine"
        )
        res = self.post([{"mediaId": 550, "title": "FC", "userRating": 6, "review": "Backup"}])
        self.assertEqual((res.data["added"], res.data["skipped"]), (0, 1))
        rating = RatingEntry.objects.get(media_id=550)
        self.assertEqual((rating.user_rating, rating.review), (9, "Mine"))

    def test_review_and_rated_at_stored(self):
        review = 'Great, "must" see,\nreally  '
        res = self.post([{"mediaId": 550, "title": "FC", "userRating": 8, "review": review, "ratedAt": PAST}])
        self.assertEqual(res.data["added"], 1)
        rating = RatingEntry.objects.get(media_id=550)
        # Inner newlines and quotes kept; the ends trimmed, as a single write trims.
        self.assertEqual((rating.review, rating.rated_at, rating.user_rating), (review.strip(), PAST_DT, 8))

    def test_off_step_rating_names_entry(self):
        res = self.post([{"mediaId": 1, "userRating": 7}, {"mediaId": 2, "userRating": 7.3}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1", res.data["entries"])
        self.assertFalse(RatingEntry.objects.exists())

    def test_missing_rating_rejected(self):
        self.assertEqual(self.post([{"mediaId": 1}]).status_code, status.HTTP_400_BAD_REQUEST)

    def test_never_pushed_to_tmdb(self):
        TMDBProfile.objects.create(user=self.user, session_id="sess")
        with mock.patch("userdata.ratings_views.tmdb_client.post_rating") as post_rating:
            res = self.post([{"mediaId": 550, "userRating": 8}])
        self.assertEqual(res.data["added"], 1)
        post_rating.assert_not_called()


class PaginationWithTiedTimestampsTests(BulkTestCase):
    """A bulk import gives many rows the same timestamp; paging must still
    return every row exactly once."""

    def assert_pages_cover_all(self, url, expected):
        ids, page = [], 1
        while True:
            data = self.client.get(url, {"page": page}).data
            ids += [row["id"] for row in data["results"]]
            if not data["next"]:
                break
            page += 1
        self.assertEqual(len(ids), expected)
        self.assertEqual(len(set(ids)), expected)

    def test_tied_timestamps_page_without_duplicates(self):
        ts = timezone.now() - timedelta(days=1)
        n = 250
        WatchedEntry.objects.bulk_create(
            [
                WatchedEntry(user=self.user, media_id=i, media_type="movie", title="t", watched_at=ts)
                for i in range(1, n + 1)
            ]
        )
        WatchlistEntry.objects.bulk_create(
            [
                WatchlistEntry(user=self.user, media_id=i, media_type="movie", title="t", added_at=ts)
                for i in range(1, n + 1)
            ]
        )
        RatingEntry.objects.bulk_create(
            [RatingEntry(user=self.user, media_id=i, media_type="movie", title="t", user_rating=5, rated_at=ts)
             for i in range(1, n + 1)]
        )
        for url in ("/api/watched/", "/api/watchlist/", "/api/ratings/"):
            with self.subTest(url=url):
                self.assert_pages_cover_all(url, n)


class SingleCreateIgnoresTimestampsTests(BulkTestCase):
    def test_single_posts_ignore_client_timestamps(self):
        before = timezone.now()
        body = {"mediaId": 1, "mediaType": "movie", "title": "A", "posterPath": None, "voteAverage": 7}
        self.client.post("/api/watched/", {**body, "watchedAt": PAST}, format="json")
        self.client.post("/api/watchlist/", {**body, "addedAt": PAST}, format="json")
        with mock.patch("userdata.ratings_views.tmdb_client.post_rating"):
            self.client.post("/api/ratings/", {**body, "userRating": 8, "ratedAt": PAST}, format="json")
        self.assertGreaterEqual(WatchedEntry.objects.get().watched_at, before)
        self.assertGreaterEqual(WatchlistEntry.objects.get().added_at, before)
        self.assertGreaterEqual(RatingEntry.objects.get().rated_at, before)


YEAR_ONE = "0001-01-01T00:00:00Z"


class BulkTimestampLowerBoundTests(BulkTestCase):
    """Near year 1 a time can't be shown in a zone behind UTC, which made
    /api/stats/ 500 for good. Imports reject anything before 1900."""

    CASES = (
        ("/api/watched/bulk/", {"mediaId": 2, "watchedAt": YEAR_ONE}, WatchedEntry),
        ("/api/watchlist/bulk/", {"mediaId": 2, "addedAt": YEAR_ONE}, WatchlistEntry),
        ("/api/ratings/bulk/", {"mediaId": 2, "userRating": 8, "ratedAt": YEAR_ONE}, RatingEntry),
    )

    def test_year_one_rejected_and_nothing_written(self):
        for url, entry, model in self.CASES:
            with self.subTest(url=url):
                self.url = url
                first = {"mediaId": 1, "title": "A", "userRating": 7} if model is RatingEntry else {"mediaId": 1}
                res = self.post([first, entry])
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("1", res.data["entries"])
                self.assertFalse(model.objects.exists())

    def test_1900_itself_accepted(self):
        self.url = "/api/watched/bulk/"
        res = self.post([{"mediaId": 1, "watchedAt": "1900-01-01T00:00:00Z"}])
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)


class BulkListItemsTests(BulkTestCase):
    def setUp(self):
        super().setUp()
        self.user_list = UserList.objects.create(user=self.user, name="L")
        self.url = f"/api/lists/{self.user_list.id}/items/bulk/"

    def items(self):
        return list(self.user_list.items.order_by("media_id"))

    def test_keeps_added_at_and_skips_existing(self):
        res = self.post([{"mediaId": 1, "title": "A", "addedAt": PAST}, {"mediaId": 2, "title": "B"}])
        self.assertEqual(res.data, {"added": 2, "skipped": 0, "ignored": 0, "overLimit": 0})
        self.assertEqual(self.items()[0].added_at, PAST_DT)
        res = self.post([{"mediaId": 1, "title": "A"}, {"mediaId": 3, "title": "C"}])
        self.assertEqual(res.data, {"added": 1, "skipped": 1, "ignored": 0, "overLimit": 0})

    def test_malformed_entry_writes_nothing(self):
        res = self.post([{"mediaId": 1, "title": "A"}, {"mediaId": "abc"}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1", res.data["entries"])
        self.assertEqual(self.items(), [])

    def test_future_added_at_rejected(self):
        res = self.post([{"mediaId": 1, "title": "A", "addedAt": future_iso()}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_another_users_list_is_404(self):
        other = User.objects.create_user(username="otto", password="Xk9#mQ2vTz8p")
        theirs = UserList.objects.create(user=other, name="Theirs")
        res = self.client.post(
            f"/api/lists/{theirs.id}/items/bulk/", {"entries": [{"mediaId": 1, "title": "A"}], "mediaType": "movie"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(theirs.items.exists())

    def test_over_500_entries_rejected(self):
        res = self.post([{"mediaId": i, "title": "x"} for i in range(1, 502)])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.items(), [])

    def test_items_read_newest_first_by_added_at(self):
        self.post([
            {"mediaId": 1, "title": "Old", "addedAt": "2023-01-01T00:00:00Z"},
            {"mediaId": 2, "title": "New", "addedAt": "2024-01-01T00:00:00Z"},
        ])
        res = self.client.get("/api/lists/")
        self.assertEqual([i["title"] for i in res.data["results"][0]["items"]], ["New", "Old"])


    def test_undated_rows_sent_in_reverse_read_in_file_order(self):
        # The client sends a file's A, B, C as C, B, A (orderForImport).
        self.post([{"mediaId": 3, "title": "C"}, {"mediaId": 2, "title": "B"}, {"mediaId": 1, "title": "A"}])
        res = self.client.get("/api/lists/")
        self.assertEqual([i["title"] for i in res.data["results"][0]["items"]], ["A", "B", "C"])


class ListCreatedAtTests(BulkTestCase):
    def test_create_keeps_a_past_created_at(self):
        res = self.client.post("/api/lists/", {"name": "L", "createdAt": PAST}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["createdAt"], PAST)

    def test_future_created_at_rejected(self):
        res = self.client.post("/api/lists/", {"name": "L", "createdAt": future_iso()}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("createdAt", res.data)

    def test_without_created_at_uses_now(self):
        before = timezone.now()
        res = self.client.post("/api/lists/", {"name": "L"}, format="json")
        self.assertGreaterEqual(UserList.objects.get(pk=res.data["id"]).created_at, before)

    def test_update_cannot_change_created_at(self):
        res = self.client.post("/api/lists/", {"name": "L", "createdAt": PAST}, format="json")
        self.client.patch(
            f"/api/lists/{res.data['id']}/", {"name": "M", "createdAt": "2020-01-01T00:00:00Z"}, format="json",
        )
        lst = UserList.objects.get(pk=res.data["id"])
        self.assertEqual((lst.name, lst.created_at), ("M", PAST_DT))


class ExactCountTests(BulkTestCase):
    """data-backup: counts match what the database actually inserted, even
    when another request created the same entry after the pre-check."""

    def _race(self, model, url, existing_kwargs, entries):
        """Create the row, but hide it from bulk_import's pre-check, as if a
        concurrent request committed it between the check and the insert."""
        model.objects.create(**existing_kwargs)
        real_filter = model.objects.filter
        with mock.patch.object(type(model.objects), "filter",
                               lambda self_, *a, **k: real_filter(*a, **k).none()):
            res = self.client.post(url, {"entries": entries, "mediaType": "movie"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        return res.data

    def test_watchlist_row_created_concurrently_counts_as_skipped(self):
        data = self._race(WatchlistEntry, "/api/watchlist/bulk/",
                          {"user": self.user, "media_id": 550, "media_type": "movie", "title": "Fight Club"},
                          [{"mediaId": 550, "title": "Fight Club"}, {"mediaId": 603, "title": "The Matrix"}])
        self.assertEqual(data, {"added": 1, "skipped": 1, "ignored": 0, "overLimit": 0})
        self.assertEqual(WatchlistEntry.objects.filter(user=self.user).count(), 2)

    def test_counts_are_exact_for_every_media_bulk_endpoint(self):
        user_list = UserList.objects.create(user=self.user, name="L")
        cases = [
            (WatchedEntry, "/api/watched/bulk/",
             {"user": self.user, "media_id": 1, "media_type": "movie", "title": "A"}),
            (RatingEntry, "/api/ratings/bulk/",
             {"user": self.user, "media_id": 1, "media_type": "movie", "title": "A", "user_rating": 7}),
            (UserListItem, f"/api/lists/{user_list.id}/items/bulk/",
             {"user_list": user_list, "media_id": 1, "media_type": "movie", "title": "A"}),
        ]
        for model, url, existing in cases:
            with self.subTest(model=model.__name__):
                entry = {"mediaId": 1, "title": "A", "userRating": 7, "review": ""}
                data = self._race(model, url, existing, [entry, {**entry, "mediaId": 2, "title": "B"}])
                self.assertEqual(data, {"added": 1, "skipped": 1, "ignored": 0, "overLimit": 0})

    def test_json_and_timestamps_round_trip_through_the_insert(self):
        self.url = "/api/watched/bulk/"
        res = self.post([{"mediaId": 7, "title": "G", "watchedAt": PAST, "watchedTz": "Asia/Kolkata",
                          "runtimeMinutes": 90, "platform": "Netflix"}])
        self.assertEqual(res.data, {"added": 1, "skipped": 0, "ignored": 0, "overLimit": 0})
        entry = WatchedEntry.objects.get(user=self.user, media_id=7)
        self.assertEqual(entry.watched_at, PAST_DT)
        self.assertEqual(entry.genre_ids, [])
        self.assertEqual((entry.watched_tz, entry.runtime_minutes, entry.platform), ("Asia/Kolkata", 90, "Netflix"))
