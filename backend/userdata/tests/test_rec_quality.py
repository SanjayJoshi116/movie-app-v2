"""rec-quality-fixes: clustering input, the split-type genre fallback, rated
titles never recommended, genre-less rechecks, unknown genre ids on both
types, and the newest compute winning the save."""
import importlib
from datetime import timedelta
from unittest.mock import patch

import numpy as np
from django.apps import apps
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from userdata import genre_families, metadata_backfill, recommendations
from userdata.metadata_backfill import backfill_entries, entry_needs_metadata
from userdata.models import RatingEntry, TMDBMediaCache, UserRecommendationCache, WatchedEntry

from .test_recommendation_genres import _Base

HORROR, REALITY, DRAMA, COMEDY = 27, 10764, 18, 35


class _MeanKMeans:
    """Every cluster is the mean of all rows: the clusters' top genres are the
    history's overall top genres, whatever sklearn would pick."""

    def __init__(self, n_clusters, **_):
        self.k = n_clusters

    def fit(self, X):
        self.cluster_centers_ = np.repeat(X.mean(axis=0, keepdims=True), self.k, axis=0)
        return self


class ClusteringInputTests(_Base):
    def labels(self):
        return [s["label"] for s in recommendations._compute_personalized(self.user)]

    def test_disliked_titles_dont_shape_taste(self):
        for i in range(10):
            self.watch(100 + i, "movie", [HORROR], rating=1 + i % 2)
        for i in range(3):
            self.watch(200 + i, "movie", [DRAMA], rating=8)
            self.watch(300 + i, "movie", [COMEDY], rating=8)
        labels = self.labels()
        self.assertTrue(labels)
        self.assertFalse(any("Horror" in label for label in labels), labels)

    def test_genre_less_titles_are_left_out(self):
        for i in range(3):
            self.watch(200 + i, "movie", [DRAMA], rating=8)
            self.watch(300 + i, "movie", [COMEDY], rating=8)
        with patch.object(recommendations, "KMeans", _MeanKMeans):
            without = self.labels()
            for i in range(6):
                self.watch(400 + i, "movie", [])
            with_genreless = self.labels()
        self.assertEqual(without, with_genreless)

    def test_fewer_than_three_usable_titles_give_no_taste_sections(self):
        self.watch(1, "movie", [DRAMA], rating=8)
        self.watch(2, "movie", [COMEDY])
        self.watch(3, "movie", [HORROR], rating=2)
        self.watch(4, "movie", [])
        self.watch(5, "movie", [])
        self.assertEqual(recommendations._compute_personalized(self.user), [])
        self.assertEqual(self.calls, [])


class SplitTypeFallbackTests(_Base):
    def test_genres_for_falls_back_per_type(self):
        horror, reality = genre_families.family_of(HORROR, "movie"), genre_families.family_of(REALITY, "tv")
        self.assertIsNone(genre_families.with_genres("movie", [horror, reality]))
        self.assertEqual(recommendations._genres_for("movie", [horror, reality]), "27")
        self.assertEqual(recommendations._genres_for("tv", [horror, reality]), "10764")

    def test_horror_and_reality_cluster_yields_both(self):
        for i in range(3):
            self.watch(100 + i, "movie", [HORROR], rating=8)
            self.watch(200 + i, "tv", [REALITY], rating=8)
        with patch.object(recommendations, "KMeans", _MeanKMeans):
            sections = recommendations._compute_personalized(self.user)
        self.assertEqual(len(sections), 1)
        self.assertIn("Horror", sections[0]["label"])
        self.assertEqual({i["type"] for i in sections[0]["items"]}, {"movie", "tv"})
        self.assertEqual(set(self.calls), {("movie", "27"), ("tv", "10764")})
        self.assert_ids_match_type()


class RatedTitlesExcludedTests(_Base):
    def test_rated_but_unwatched_title_is_never_recommended(self):
        for i in range(3):
            self.watch(200 + i, "movie", [DRAMA], rating=8)
            self.watch(300 + i, "movie", [COMEDY], rating=8)
        # discover's next ids are predictable: rate the first three it will return.
        next_ids = range(900000, 900000 + 60)
        RatingEntry.objects.bulk_create([
            RatingEntry(user=self.user, media_id=i, media_type=t, title="rated", user_rating=7)
            for i in next_ids for t in ("movie", "tv")
        ])
        personalized = recommendations._compute_personalized(self.user)
        for_you = recommendations._compute_for_you(self.user)
        recommended = {i["id"] for s in personalized + for_you for i in s["items"]}
        self.assertFalse(recommended & set(next_ids))


class GenrelessRecheckTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rc", password="Xk9#mQ2vTz8p")
        metadata_backfill._failed_at.clear()

    def _entry(self, media_id=1, **fields):
        return WatchedEntry.objects.create(user=self.user, media_id=media_id, media_type="movie", title="T", **fields)

    def test_genre_less_answer_is_rechecked_after_30_days(self):
        entry = self._entry()
        no_genres = {"genres": [], "original_language": "en", "release_date": ""}
        released = {"genres": [{"id": DRAMA}], "original_language": "en", "release_date": "2026-11-01"}
        with patch("userdata.tmdb_client._get", return_value=no_genres) as get:
            backfill_entries([entry])
            entry = WatchedEntry.objects.get(pk=entry.pk)
            self.assertFalse(entry.metadata_settled)
            self.assertEqual(entry.release_year, metadata_backfill.UNKNOWN_YEAR)
            backfill_entries([entry])  # within 30 days: not fetched
            self.assertEqual(get.call_count, 1)
        later = timezone.now() + timedelta(days=31)
        with patch("userdata.tmdb_client._get", return_value=released) as get, \
                patch("django.utils.timezone.now", return_value=later):
            self.assertTrue(entry_needs_metadata(entry))
            backfill_entries([entry])
        entry = WatchedEntry.objects.get(pk=entry.pk)
        self.assertEqual((entry.genre_ids, entry.release_year), ([DRAMA], 2026))
        self.assertFalse(entry_needs_metadata(entry))

    def test_not_found_stays_settled_after_30_days(self):
        entry = self._entry(genre_ids=[], original_language="??", release_year=-1, metadata_settled=True,
                            metadata_checked_at=timezone.now() - timedelta(days=400))
        self.assertFalse(entry_needs_metadata(entry))

    def test_migration_unsettles_only_genre_less_answers(self):
        migration = importlib.import_module("userdata.migrations.0028_rec_quality")
        not_found = self._entry(1, genre_ids=[], original_language="??", release_year=-1, metadata_settled=True)
        genre_less = self._entry(2, genre_ids=[], original_language="ja", release_year=-1, metadata_settled=True)
        filled = self._entry(3, genre_ids=[DRAMA], original_language="en", release_year=1999)
        migration.unsettle_genreless(apps, None)
        settled = set(WatchedEntry.objects.filter(metadata_settled=True).values_list("pk", flat=True))
        self.assertEqual(settled, {not_found.pk})
        self.assertTrue(entry_needs_metadata(WatchedEntry.objects.get(pk=genre_less.pk)))
        self.assertFalse(entry_needs_metadata(WatchedEntry.objects.get(pk=filled.pk)))


class UnknownGenreIdTests(TestCase):
    def setUp(self):
        saved = {k: {t: list(v) for t, v in ids.items()} for k, ids in genre_families.IDS.items()}

        def restore():
            genre_families.IDS.clear()
            genre_families.IDS.update(saved)
        self.addCleanup(restore)

    def test_new_id_seen_on_both_types_is_queryable_on_both(self):
        family = genre_families.family_of(99999, "movie")
        self.assertIsNone(genre_families.with_genres("tv", [family]))
        genre_families.family_of(99999, "tv")
        self.assertEqual(genre_families.with_genres("tv", [family]), "99999")
        self.assertEqual(genre_families.with_genres("movie", [family]), "99999")


class NewestComputeWinsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="nw", password="Xk9#mQ2vTz8p")
        self.addCleanup(cache.delete, recommendations._backoff_key(self.user.id))

    def _save(self, label, started):
        return recommendations.save_recommendations(
            self.user, [{"key": label, "label": label, "items": [{"id": 1}]}], [], recommendations.FetchHealth(),
            started=started,
        )

    def test_older_compute_finishing_later_is_skipped(self):
        t0 = timezone.now()
        self.assertEqual(self._save("newer", t0 + timedelta(seconds=5)), recommendations.SAVED)
        self.assertEqual(self._save("older", t0), recommendations.SUPERSEDED)
        row = UserRecommendationCache.objects.get(user=self.user)
        self.assertEqual(row.for_you_json[0]["key"], "newer")

    def test_newer_compute_replaces_older(self):
        t0 = timezone.now()
        self._save("older", t0)
        self.assertEqual(self._save("newer", t0 + timedelta(seconds=5)), recommendations.SAVED)
        self.assertEqual(UserRecommendationCache.objects.get(user=self.user).for_you_json[0]["key"], "newer")

    def test_without_started_saves_as_before(self):
        self._save("newer", timezone.now() + timedelta(hours=1))
        self.assertEqual(self._save("plain", None), recommendations.SAVED)

    def test_superseded_refresh_sets_no_backoff(self):
        UserRecommendationCache.objects.create(
            user=self.user, for_you_json=[], source_started_at=timezone.now() + timedelta(hours=1),
        )
        with patch.object(recommendations, "_compute_for_you", return_value=[]), \
                patch.object(recommendations, "_compute_personalized", return_value=[]), \
                patch.object(recommendations, "_finish_refresh"):
            recommendations._refresh_cache(self.user)
        self.assertFalse(recommendations.in_failure_backoff(self.user.id))


class ActorSectionTalkShowTests(_Base):
    """follow-crew-credits: a talk-show appearance isn't an actor's work."""

    def test_because_you_like_skips_talk_and_news(self):
        self.watch(1, "movie", [DRAMA])
        TMDBMediaCache.objects.filter(media_id=1).update(top_cast=[{"id": 287, "name": "An Actor"}])

        def get(path, params=None, timeout=10):
            if path == "/person/287/combined_credits":
                return {"cast": [
                    {"id": 70, "media_type": "tv", "name": "Late Show", "vote_average": 8, "genre_ids": [10767]},
                    {"id": 71, "media_type": "tv", "name": "Evening News", "vote_average": 8, "genre_ids": [10763]},
                    {"id": 72, "media_type": "movie", "title": "A Film", "vote_average": 7, "genre_ids": [DRAMA]},
                ]}
            return {"results": [], "cast": []}

        with patch.object(recommendations.tmdb_client, "_get", side_effect=get):
            sections = recommendations._compute_for_you(self.user)
        actor = [s for s in sections if s["key"] == "actor-287"]
        self.assertEqual([i["title"] for i in actor[0]["items"]], ["A Film"])
