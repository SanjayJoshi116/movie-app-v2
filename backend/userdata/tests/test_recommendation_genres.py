"""recommendation-sections: genres are matched per media type, and disliked
titles don't seed "Because you watched". TMDB is mocked; discover calls are
recorded as (media_type, with_genres)."""
import itertools
import threading
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from userdata import recommendations
from userdata.models import RatingEntry, TMDBMediaCache, WatchedEntry
from userdata.tmdb_client import STATIC_GENRE_NAMES

MOVIE_IDS = {28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37}
TV_IDS = {10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10763, 10764, 10765, 10766, 10767, 10768, 37}


class _Base(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="gina", password="Xk9#mQ2vTz8p")
        self.calls = []
        self.similar_paths = []
        lock = threading.Lock()
        ids = itertools.count(900000)

        def discover(media_type, with_genres, page=1):
            with lock:
                self.calls.append((media_type, with_genres))
                n = [next(ids) for _ in range(3)]
            return [{"id": i, "title": f"{media_type} {i}", "name": f"{media_type} {i}", "vote_average": 7,
                     "popularity": 10, "genre_ids": []} for i in n]

        def get(path, params=None, timeout=10):
            with lock:
                self.similar_paths.append(path)
                n = next(ids)
            return {"results": [{"id": n, "title": "x", "name": "x", "vote_average": 7, "media_type": "movie"}],
                    "cast": []}

        for p in (
            patch.object(recommendations.tmdb_client, "discover", side_effect=discover),
            patch.object(recommendations.tmdb_client, "_get", side_effect=get),
            patch.object(recommendations.tmdb_client, "get_genre_names", return_value=dict(STATIC_GENRE_NAMES)),
            patch.object(recommendations, "backfill_entries", return_value=True),
        ):
            p.start()
            self.addCleanup(p.stop)

    def watch(self, media_id, media_type, genre_ids, days_ago=0, rating=None):
        WatchedEntry.objects.create(
            user=self.user, media_id=media_id, media_type=media_type, title=f"T{media_id}",
            genre_ids=genre_ids, watched_at=timezone.now() - timedelta(days=days_ago),
        )
        # A fresh cache row, so For You never fetches details.
        TMDBMediaCache.objects.create(media_id=media_id, media_type=media_type, genre_ids=genre_ids, top_cast=[])
        if rating is not None:
            RatingEntry.objects.create(user=self.user, media_id=media_id, media_type=media_type,
                                       title=f"T{media_id}", user_rating=rating)

    def assert_ids_match_type(self):
        self.assertTrue(self.calls)
        for media_type, with_genres in self.calls:
            ids = {int(g) for g in with_genres.replace("|", ",").split(",")}
            with self.subTest(call=(media_type, with_genres)):
                self.assertLessEqual(ids, MOVIE_IDS if media_type == "movie" else TV_IDS)


class ForYouGenreTests(_Base):
    def test_action_movie_and_action_show_make_one_mixed_section(self):
        self.watch(1, "movie", [28], days_ago=2)
        self.watch(2, "tv", [10759], days_ago=1)
        sections = recommendations._compute_for_you(self.user)

        self.assert_ids_match_type()
        self.assertIn(("movie", "28|12"), self.calls)
        self.assertIn(("tv", "10759"), self.calls)
        genre = [s for s in sections if s["key"].startswith("genre-")]
        self.assertEqual([s["key"] for s in genre], ["genre-action-adventure"])
        self.assertEqual(genre[0]["label"], "Based on your taste in Action & Adventure")
        self.assertEqual({i["type"] for i in genre[0]["items"]}, {"movie", "tv"})

    def test_movie_only_genre_never_queries_tv(self):
        self.watch(1, "movie", [27])
        recommendations._compute_for_you(self.user)
        self.assertIn(("movie", "27"), self.calls)
        self.assertFalse([c for c in self.calls if c[0] == "tv"])

    def test_disliked_title_never_seeds_because_you_watched(self):
        self.watch(1, "movie", [18], days_ago=0, rating=2)  # the most recent watch
        self.watch(2, "movie", [18], days_ago=5)
        self.watch(3, "tv", [18], days_ago=6, rating=8)
        sections = recommendations._compute_for_you(self.user)

        because = {s["key"] for s in sections if s["key"].startswith("because-")}
        self.assertNotIn("because-movie-1", because)
        self.assertNotIn("/movie/1/similar", self.similar_paths)
        self.assertIn("because-tv-3", because)
        self.assertIn("because-movie-2", because)  # unrated stays eligible


class PersonalizedGenreTests(_Base):
    def test_clusters_query_each_type_with_its_own_ids(self):
        # Action on both sides plus Drama: the old pooled vocabulary AND-ed 28
        # with 10759 and got nothing back.
        self.watch(1, "movie", [28, 18], rating=9)
        self.watch(2, "tv", [10759, 18], rating=9)
        self.watch(3, "movie", [28], rating=8)
        self.watch(4, "tv", [10759], rating=8)
        self.watch(5, "movie", [35], rating=6)
        self.watch(6, "tv", [35], rating=6)
        sections = recommendations._compute_personalized(self.user)

        self.assert_ids_match_type()
        for _, with_genres in self.calls:
            self.assertFalse({"28", "10759"} <= set(with_genres.replace("|", ",").split(",")))
        labels = [s["label"] for s in sections]
        self.assertTrue(any("Action & Adventure" in label for label in labels), labels)
        # Never a movie-only "Action" next to the TV "Action & Adventure".
        for label in labels:
            self.assertEqual(label.count("Action"), label.count("Action & Adventure"), label)
        for s in sections:
            self.assertTrue(s["items"], s["label"])
