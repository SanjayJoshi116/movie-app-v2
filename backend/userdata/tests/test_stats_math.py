from datetime import UTC, datetime
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from userdata import stats_views
from userdata.models import RatingEntry, WatchedEntry
from userdata.stats_views import rating_bucket, round_half_up


class RoundingHelperTests(APITestCase):
    def test_round_half_up(self):
        self.assertEqual(round_half_up(7.25), 7.3)
        self.assertEqual(round_half_up(7.35), 7.4)
        self.assertEqual(round_half_up(6.04), 6.0)
        self.assertEqual(round_half_up(7.249999), 7.2)

    def test_rating_bucket_gives_each_star_two_half_steps(self):
        counts = {}
        for r in [x / 2 for x in range(1, 21)]:  # 0.5 .. 10.0
            counts[rating_bucket(r)] = counts.get(rating_bucket(r), 0) + 1
        self.assertEqual(counts, dict.fromkeys(range(1, 11), 2))
        self.assertEqual((rating_bucket(6.5), rating_bucket(7.5), rating_bucket(0.5)), (7, 8, 1))


@patch.object(stats_views, "_get_cached_genre_names", return_value={18: "Drama"})
class StatsMathTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sam", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        self._next_id = 1

    def watch(self, *, when=None, vote=7.0, genres=(18,)):
        entry = WatchedEntry.objects.create(
            user=self.user, media_id=self._next_id, media_type="movie", title=f"T{self._next_id}",
            vote_average=vote, genre_ids=list(genres), original_language="en", release_year=2000,
            metadata_settled=True, watched_at=when or timezone.now(),
        )
        self._next_id += 1
        return entry

    def rate(self, entry, rating):
        RatingEntry.objects.create(
            user=self.user, media_id=entry.media_id, media_type=entry.media_type, title=entry.title, user_rating=rating,
        )

    def stats(self):
        res = self.client.get("/api/stats/")
        self.assertEqual(res.status_code, 200)
        return res.data

    def test_half_star_ratings_bucket_up(self, _genres):
        self.rate(self.watch(), 6.5)
        self.rate(self.watch(), 7.5)
        dist = {d["rating"]: d["count"] for d in self.stats()["ratingDistribution"]}
        self.assertEqual((dist["6"], dist["7"], dist["8"]), (0, 1, 1))

    def test_averages_round_half_up(self, _genres):
        a, b = self.watch(), self.watch()
        self.rate(a, 7.0)
        self.rate(b, 7.5)
        self.assertEqual(self.stats()["avgUserRating"], 7.3)

    def test_genre_average_rounds_half_up(self, _genres):
        # 7.0, 7.0, 7.5, 7.5 -> 7.25 -> 7.3 (round() gave 7.2)
        for r in (7.0, 7.0, 7.5, 7.5):
            self.rate(self.watch(), r)
        self.assertEqual(self.stats()["ratingByGenre"], [{"genre": "Drama", "avgRating": 7.3}])

    def test_unscored_titles_are_left_out_of_the_tmdb_average(self, _genres):
        self.watch(vote=8.0)
        self.watch(vote=7.0)
        self.watch(vote=0)
        self.assertEqual(self.stats()["avgTmdbRating"], 7.5)

    def test_all_unscored_gives_null(self, _genres):
        self.watch(vote=0)
        self.assertIsNone(self.stats()["avgTmdbRating"])

    def test_monthly_activity_fills_gaps_through_this_month(self, _genres):
        now = timezone.now()

        def months_ago(n):
            y, m = now.year, now.month - n
            while m < 1:
                y, m = y - 1, m + 12
            return datetime(y, m, 15, 12, tzinfo=UTC)

        self.watch(when=months_ago(5))
        self.watch(when=months_ago(2))
        monthly = self.stats()["monthlyActivity"]
        self.assertEqual([m["count"] for m in monthly], [1, 0, 0, 1, 0, 0])
        self.assertEqual(monthly[0]["month"], months_ago(5).strftime("%b %Y"))
        self.assertEqual(monthly[-1]["month"], now.strftime("%b %Y"))

    def test_no_history_gives_no_months(self, _genres):
        self.assertEqual(self.stats()["monthlyActivity"], [])
