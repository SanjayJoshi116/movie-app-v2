"""watch-stats (rating-hot-takes): the user's ratings against TMDB's stored score."""
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from userdata.models import RatingEntry, WatchedEntry
from userdata.stats_views import HOT_TAKES_LIMIT, HOT_TAKES_MIN, rating_habits


class _Entry:
    """A WatchedEntry stand-in: rating_habits reads only these fields."""

    def __init__(self, media_id, vote, title=None, media_type="movie"):
        self.media_id, self.media_type, self.vote_average = media_id, media_type, vote
        self.title = f"T{media_id}" if title is None else title
        self.poster_path = None


def habits(rows):
    """rows: (media_id, tmdb score, user rating or None[, title])."""
    entries = [_Entry(r[0], r[1], *(r[3:] or [])) for r in rows]
    ratings = {(r[0], "movie"): r[2] for r in rows if r[2] is not None}
    return rating_habits(entries, ratings)


class RatingHabitsTests(APITestCase):
    def test_below_the_minimum_gives_count_and_nothing_else(self):
        result = habits([(i, 7.0, 9) for i in range(1, 4)])
        self.assertEqual(result, {
            "count": 3, "minCount": HOT_TAKES_MIN, "unratedCount": 0, "avgOffset": None, "contrarianScore": None,
            "guiltyPleasures": [], "notForYou": [],
        })

    def test_unrated_count_tells_whether_rating_more_helps(self):
        # Two rated without a TMDB score (can never count), one unrated.
        rows = [(1, 7.0, 8), (2, 0, 9), (3, 0, 9), (4, 7.0, None)]
        result = habits(rows)
        self.assertEqual((result["count"], result["unratedCount"]), (1, 1))

    def test_cutoff_uses_the_gap_as_shown(self):
        # 8 against 6.54 shows as "TMDB 6.5", a 1.5 gap: listed, though the exact gap is 1.46.
        result = habits([(1, 6.54, 8)] + [(i, 7.0, 7) for i in range(2, 6)])
        listed = [(i["mediaId"], i["tmdbRating"], i["gap"]) for i in result["guiltyPleasures"]]
        self.assertEqual(listed, [(1, 6.5, 1.5)])

    def test_spec_example(self):
        # Gaps +2, +1, +1.5, 0, +2.5 -> average 1.4, distance 1.4.
        result = habits([(1, 7.0, 9), (2, 7.0, 8), (3, 6.5, 8), (4, 8.0, 8), (5, 6.5, 9)])
        self.assertEqual((result["count"], result["avgOffset"], result["contrarianScore"]), (5, 1.4, 1.4))
        self.assertEqual([i["mediaId"] for i in result["guiltyPleasures"]], [5, 1, 3])  # 1.5 included
        self.assertEqual(result["notForYou"], [])

    def test_mixed_gaps_and_item_shape(self):
        result = habits([(1, 5.2, 9), (2, 8.1, 4), (3, 7.0, 7), (4, 7.0, 7.5), (5, 7.0, 6.5)])
        self.assertEqual(result["avgOffset"], -0.1)  # gaps 3.8, -4.1, 0, 0.5, -0.5
        self.assertEqual(result["contrarianScore"], 1.8)
        self.assertEqual(result["guiltyPleasures"], [{
            "mediaId": 1, "mediaType": "movie", "title": "T1", "posterPath": None,
            "userRating": 9, "tmdbRating": 5.2, "gap": 3.8,
        }])
        self.assertEqual([(i["mediaId"], i["gap"]) for i in result["notForYou"]], [(2, -4.1)])

    def test_unknown_or_out_of_range_scores_and_unrated_titles_dont_count(self):
        rows = [(i, 7.0, 7) for i in range(1, 5)] + [(10, 0, 9), (11, 11.0, 9), (12, 7.0, None)]
        self.assertEqual(habits(rows)["count"], 4)

    def test_lists_are_capped_and_ties_ordered_by_title(self):
        rows = [(i, 5.0, 9, f"Title {chr(ord('Z') - i)}") for i in range(1, 8)]
        result = habits(rows)
        self.assertEqual(len(result["guiltyPleasures"]), HOT_TAKES_LIMIT)
        titles = [i["title"] for i in result["guiltyPleasures"]]
        self.assertEqual(titles, sorted(titles))

    def test_blank_title_is_sent_as_stored(self):
        """The page labels it, as for every other Stats list."""
        rows = [(1, 5.0, 9, "  ")] + [(i, 7.0, 7) for i in range(2, 6)]
        self.assertEqual(habits(rows)["guiltyPleasures"][0]["title"], "  ")

    def test_a_movie_and_a_show_with_the_same_id_are_kept_apart(self):
        entries = [_Entry(1, 5.0, media_type="tv")] + [_Entry(i, 7.0) for i in range(1, 6)]
        ratings = {(i, "movie"): 7 for i in range(1, 6)}  # the show isn't rated
        self.assertEqual(rating_habits(entries, ratings)["count"], 5)


@patch("userdata.tmdb_client.cached_genre_names", return_value={18: "Drama"})
@patch("userdata.stats_views.request_backfill")
class StatsResponseTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="hot", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def test_stats_returns_rating_habits(self, *_):
        for i, (vote, rating) in enumerate([(5.2, 9), (7, 7), (7, 7), (7, 7), (7, 7)], start=1):
            WatchedEntry.objects.create(user=self.user, media_id=i, media_type="movie", title=f"T{i}",
                                        vote_average=vote, genre_ids=[18], metadata_settled=True)
            RatingEntry.objects.create(user=self.user, media_id=i, media_type="movie", title=f"T{i}",
                                       user_rating=rating)
        # Rated, not watched: no stored TMDB score, so it can't count.
        RatingEntry.objects.create(user=self.user, media_id=99, media_type="movie", title="X", user_rating=1)
        habits_ = self.client.get("/api/stats/").data["ratingHabits"]
        self.assertEqual(habits_["count"], 5)
        self.assertEqual([i["mediaId"] for i in habits_["guiltyPleasures"]], [1])
        self.assertEqual(habits_["notForYou"], [])

    def test_empty_library_gives_the_same_keys(self, *_):
        habits_ = self.client.get("/api/stats/").data["ratingHabits"]
        self.assertEqual(habits_["count"], 0)
        self.assertIsNone(habits_["avgOffset"])
