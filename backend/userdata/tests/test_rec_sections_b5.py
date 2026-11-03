"""recommendation-sections (fix-recs-sweep-b5): a section reserves only the
titles it shows, a malformed TMDB list empties only its own section, and a
blank seed title gets a fallback label. TMDB is mocked."""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from userdata import recommendations
from userdata.models import RatingEntry, TMDBMediaCache, WatchedEntry
from userdata.tmdb_client import STATIC_GENRE_NAMES


def _record(i, media_type):
    return {"id": i, "title": f"{media_type} {i}", "name": f"{media_type} {i}", "vote_average": 7,
            "popularity": 10, "genre_ids": [], "media_type": media_type}


class _Base(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="bea", password="Xk9#mQ2vTz8p")
        self.get_answers = {}

        # The same 20 titles per type for every genre query.
        def discover(media_type, with_genres, page=1):
            base = 1000 if media_type == "movie" else 2000
            return [_record(base + n, media_type) for n in range(20)]

        def get(path, params=None, timeout=10):
            for prefix, answer in self.get_answers.items():
                if path.startswith(prefix):
                    return answer
            return {"results": [], "cast": []}

        for p in (
            patch.object(recommendations.tmdb_client, "discover", side_effect=discover),
            patch.object(recommendations.tmdb_client, "_get", side_effect=get),
            patch.object(recommendations.tmdb_client, "cached_genre_names", return_value=dict(STATIC_GENRE_NAMES)),
            patch.object(recommendations, "backfill_entries", return_value=True),
        ):
            p.start()
            self.addCleanup(p.stop)

    def watch(self, media_id, genre_ids, title=None, top_cast=None, rating=None):
        WatchedEntry.objects.create(
            user=self.user, media_id=media_id, media_type="movie",
            title=f"T{media_id}" if title is None else title,
            genre_ids=genre_ids, watched_at=timezone.now() - timedelta(days=media_id),
        )
        TMDBMediaCache.objects.create(media_id=media_id, media_type="movie", genre_ids=genre_ids,
                                      top_cast=top_cast or [])
        if rating is not None:
            RatingEntry.objects.create(user=self.user, media_id=media_id, media_type="movie",
                                       title=f"T{media_id}", user_rating=rating)


def _keys(section):
    return {(i["id"], i["type"]) for i in section["items"]}


class SectionReservationTests(_Base):
    def test_loved_and_taste_sections_of_one_family_both_show(self):
        for i in (1, 2, 3):
            self.watch(i, [18], rating=9)
        sections = {s["key"]: s for s in recommendations._compute_for_you(self.user)}

        self.assertIn("loved", sections)
        self.assertIn("genre-18", sections)
        self.assertEqual(len(sections["loved"]["items"]), 12)
        self.assertEqual(len(sections["genre-18"]["items"]), 12)
        self.assertFalse(_keys(sections["loved"]) & _keys(sections["genre-18"]))

    def test_no_title_repeats_across_sections(self):
        for i in (1, 2, 3):
            self.watch(i, [18], rating=9)
        shown = [k for s in recommendations._compute_for_you(self.user) for k in _keys(s)]
        self.assertEqual(len(shown), len(set(shown)))

    def test_second_cluster_sharing_the_pool_still_gets_titles(self):
        for i in (1, 2, 3):
            self.watch(i, [18], rating=9)
        for i in (4, 5, 6):
            self.watch(i, [35], rating=9)
        sections = recommendations._compute_personalized(self.user)

        self.assertEqual(len(sections), 2, [s["label"] for s in sections])
        first, second = sections
        self.assertEqual(len(first["items"]), 12)
        # 40 candidates (20 per type) shared: the second shows the 12 best of the 28 left.
        self.assertEqual(len(second["items"]), 12)
        self.assertFalse(_keys(first) & _keys(second))


class MalformedListTests(_Base):
    def test_null_trending_list_drops_only_trending(self):
        for i in (1, 2, 3):
            self.watch(i, [18], rating=9)
        self.get_answers["/trending/"] = {"results": None}
        keys = {s["key"] for s in recommendations._compute_for_you(self.user)}
        self.assertNotIn("trending", keys)
        self.assertIn("genre-18", keys)

    def test_non_object_actor_credit_is_ignored(self):
        cast = [{"id": 5, "name": "Ann"}]
        for i in (1, 2, 3):
            self.watch(i, [18], top_cast=cast)
        self.get_answers["/person/5/"] = {"cast": ["oops", None, {**_record(3001, "movie"), "vote_average": 8}]}
        sections = {s["key"]: s for s in recommendations._compute_for_you(self.user)}
        self.assertEqual([i["id"] for i in sections["actor-5"]["items"]], [3001])


class SeedLabelTests(_Base):
    def test_blank_seed_title_is_named_untitled(self):
        self.watch(550, [18], title="  ")
        self.get_answers["/movie/550/similar"] = {"results": [_record(4001, "movie")]}
        labels = {s["key"]: s["label"] for s in recommendations._compute_for_you(self.user)}
        self.assertEqual(labels["because-movie-550"], "Because you watched Untitled (#550)")
