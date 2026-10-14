"""bound-rec-refresh: failure backoff, the per-run fill cap, the per-user daily
title budget, warm-up order, and the per-process refresh limit."""
import threading
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from userdata import metadata_backfill, recommendations, tmdb_budget
from userdata.management.commands.compute_recommendations import users_to_warm
from userdata.models import TMDBMediaCache, TmdbTitleBudget, UserRecommendationCache, WatchedEntry

from .test_recommendation_refresh import _section, _tmdb_down, _tmdb_ok

FOR_YOU = "/api/recommendations/for-you/"
PERSONALIZED = "/api/recommendations/personalized/"


def _stale_row(user, sections=None):
    row = UserRecommendationCache.objects.create(user=user, for_you_json=sections or [_section("trending")])
    UserRecommendationCache.objects.filter(pk=row.pk).update(computed_at=timezone.now() - timedelta(days=2))
    return row


class _Base(APITestCase):
    def setUp(self):
        recommendations._computing_users.clear()
        recommendations._rerun_users.clear()
        self.addCleanup(recommendations._computing_users.clear)
        self.addCleanup(recommendations._rerun_users.clear)
        self.spawned = []
        patcher = patch.object(recommendations, "_spawn_refresh", side_effect=self.spawned.append)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.user = User.objects.create_user(username=f"b{id(self)}", password="Xk9#mQ2vTz8p")
        self.addCleanup(cache.delete, recommendations._backoff_key(self.user.id))
        self.client.force_authenticate(user=self.user)

    def _with(self, patches):
        for p in patches:
            p.start()
            self.addCleanup(p.stop)


class FailureBackoffTests(_Base):
    def setUp(self):
        super().setUp()
        WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A", genre_ids=[18])

    def _refuse(self):
        """A refresh whose result is refused because TMDB failed."""
        self._with(_tmdb_down())
        recommendations._refresh_cache(self.user)
        recommendations._computing_users.clear()

    def test_polls_during_backoff_start_no_refresh_and_serve_stored_result(self):
        _stale_row(self.user)
        self._refuse()
        self.assertTrue(recommendations.in_failure_backoff(self.user.id))
        for _ in range(5):
            for url in (FOR_YOU, PERSONALIZED):
                res = self.client.get(url)
                self.assertEqual(res.data["status"], "ready")
        self.assertEqual(self.spawned, [])
        self.assertEqual(self.client.get(FOR_YOU).data["sections"], [_section("trending")])

    def test_no_row_stays_pending_without_retriggering(self):
        self._refuse()
        self.assertFalse(UserRecommendationCache.objects.filter(user=self.user).exists())
        for _ in range(3):
            self.assertEqual(self.client.get(FOR_YOU).data["status"], "pending")
        self.assertEqual(self.spawned, [])

    def test_a_data_change_still_refreshes(self):
        _stale_row(self.user)
        self._refuse()
        with self.captureOnCommitCallbacks(execute=True):
            WatchedEntry.objects.create(user=self.user, media_id=2, media_type="movie", title="B")
        self.assertEqual(self.spawned, [self.user.id])
        self.assertFalse(recommendations.in_failure_backoff(self.user.id))

    def test_after_the_backoff_a_stale_poll_refreshes(self):
        _stale_row(self.user)
        self._refuse()
        cache.delete(recommendations._backoff_key(self.user.id))  # the timeout passed
        self.client.get(FOR_YOU)
        self.assertEqual(self.spawned, [self.user.id])

    def test_a_saved_refresh_sets_no_backoff(self):
        self._with(_tmdb_ok())
        recommendations._refresh_cache(self.user)
        self.assertFalse(recommendations.in_failure_backoff(self.user.id))


class FillCapTests(_Base):
    def _watch(self, n, start=1):
        now = timezone.now()
        WatchedEntry.objects.bulk_create([
            WatchedEntry(user=self.user, media_id=i, media_type="movie", title=f"M{i}",
                         watched_at=now - timedelta(minutes=i), genre_ids=[18])
            for i in range(start, start + n)
        ])
        return list(WatchedEntry.objects.filter(user=self.user))

    def test_one_run_fetches_at_most_the_cap_newest_first_and_isnt_a_failure(self):
        entries = self._watch(250)
        health = recommendations.FetchHealth()
        with patch.object(recommendations.tmdb_client, "get_details_with_cast",
                          return_value={"genre_ids": [18], "top_cast": []}) as get:
            rows = recommendations._fill_media_cache(entries, health)
        self.assertEqual(get.call_count, recommendations.MAX_FILL_PER_RUN)
        fetched = {c.args[0] for c in get.call_args_list}
        self.assertEqual(fetched, set(range(1, 201)))  # newest watches (lowest minutes ago)
        self.assertFalse(health.failed)
        self.assertEqual(sum(r is not None for r in rows.values()), 200)

    def test_stale_rows_oldest_first_and_unfetched_ones_still_returned(self):
        entries = self._watch(250)
        TMDBMediaCache.objects.bulk_create([
            TMDBMediaCache(media_id=i, media_type="movie", genre_ids=[35], top_cast=[]) for i in range(1, 251)
        ])
        for i in range(1, 251):
            # Title 250 was cached longest ago.
            TMDBMediaCache.objects.filter(media_id=i).update(cached_at=timezone.now() - timedelta(days=8, minutes=i))
        with patch.object(recommendations.tmdb_client, "get_details_with_cast",
                          return_value={"genre_ids": [18], "top_cast": []}) as get:
            rows = recommendations._fill_media_cache(entries)
        self.assertEqual({c.args[0] for c in get.call_args_list}, set(range(51, 251)))
        self.assertEqual(len(rows), 250)
        self.assertEqual(rows[(1, "movie")].genre_ids, [35])  # stale, kept, still used

    def test_lookup_is_chunked_per_type_not_one_condition_per_title(self):
        entries = self._watch(2500)
        with self.assertNumQueries(3) as ctx:  # 2,500 movie ids in chunks of 1,000
            rows = recommendations._cached_rows(entries)
        self.assertEqual(rows, {})
        self.assertTrue(all(" OR " not in q["sql"] for q in ctx.captured_queries))


class BudgetTests(_Base):
    def test_take_grants_up_to_the_daily_limit_and_resets_the_next_day(self):
        self.assertEqual(tmdb_budget.take(self.user.id, 600), 600)
        self.assertEqual(tmdb_budget.take(self.user.id, 600), tmdb_budget.DAILY_TITLE_FETCHES - 600)
        self.assertEqual(tmdb_budget.take(self.user.id, 5), 0)
        TmdbTitleBudget.objects.filter(user=self.user).update(day=date(2000, 1, 1))
        self.assertEqual(tmdb_budget.take(self.user.id, 5), 5)

    def test_clear_and_import_loop_stops_at_the_budget(self):
        calls = []

        def fetch(entry):
            calls.append(entry.pk)
            return {"genre_ids": [], "original_language": "??", "release_year": -1}, True

        with patch.object(metadata_backfill, "fetch_entry_metadata", side_effect=fetch):
            for round_ in range(15):
                WatchedEntry.objects.filter(user=self.user).delete()
                WatchedEntry.objects.bulk_create([
                    WatchedEntry(user=self.user, media_id=100_000 * round_ + i, media_type="movie", title="x")
                    for i in range(500)
                ])
                metadata_backfill.backfill_entries(list(WatchedEntry.objects.filter(user=self.user)))
        self.assertEqual(len(calls), tmdb_budget.DAILY_TITLE_FETCHES)

    def test_budget_used_up_mid_refresh_still_saves(self):
        for i in range(1, 5):
            WatchedEntry.objects.create(user=self.user, media_id=i, media_type="movie", title=f"M{i}", genre_ids=[18])
        tmdb_budget.take(self.user.id, tmdb_budget.DAILY_TITLE_FETCHES)
        self._with(_tmdb_ok())
        with patch.object(recommendations.tmdb_client, "get_details_with_cast") as details:
            recommendations._refresh_cache(self.user)
        details.assert_not_called()
        self.assertTrue(UserRecommendationCache.objects.filter(user=self.user).exists())
        self.assertFalse(recommendations.in_failure_backoff(self.user.id))


class BudgetConcurrencyTests(TransactionTestCase):
    def test_concurrent_takes_never_exceed_the_limit(self):
        user = User.objects.create_user(username="conc", password="Xk9#mQ2vTz8p")
        granted = []
        barrier = threading.Barrier(4)

        def worker():
            try:
                barrier.wait()
                for _ in range(10):
                    granted.append(tmdb_budget.take(user.id, 40))
            finally:
                connection.close()

        threads = [threading.Thread(target=worker) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(sum(granted), tmdb_budget.DAILY_TITLE_FETCHES)
        self.assertEqual(TmdbTitleBudget.objects.get(user=user).used, tmdb_budget.DAILY_TITLE_FETCHES)


class WarmupOrderTests(APITestCase):
    def test_skips_fresh_and_orders_missing_then_oldest(self):
        def user(name, computed_hours_ago=None):
            u = User.objects.create_user(username=name, password="Xk9#mQ2vTz8p")
            WatchedEntry.objects.create(user=u, media_id=1, media_type="movie", title="A")
            if computed_hours_ago is not None:
                row = UserRecommendationCache.objects.create(user=u)
                UserRecommendationCache.objects.filter(pk=row.pk).update(
                    computed_at=timezone.now() - timedelta(hours=computed_hours_ago)
                )
            return u

        fresh = user("fresh", 1)
        stale_newer = user("stale_newer", 20)
        stale_oldest = user("stale_oldest", 100)
        missing = user("missing")
        User.objects.create_user(username="no_history", password="Xk9#mQ2vTz8p")
        order = list(users_to_warm())
        self.assertEqual(order, [missing, stale_oldest, stale_newer])
        self.assertNotIn(fresh, order)


class RefreshConcurrencyTests(APITestCase):
    def setUp(self):
        recommendations._computing_users.clear()
        recommendations._rerun_users.clear()
        self.addCleanup(recommendations._computing_users.clear)
        self.addCleanup(recommendations._rerun_users.clear)

    def test_at_most_four_compute_at_once_and_all_finish(self):
        running, peak, done = [0], [0], []
        lock = threading.Lock()
        release = threading.Event()

        def fake_refresh(user_id):
            with lock:
                running[0] += 1
                peak[0] = max(peak[0], running[0])
            release.wait(5)
            with lock:
                running[0] -= 1
                done.append(user_id)

        with patch.object(recommendations, "_refresh_cache_by_id", side_effect=fake_refresh), \
                patch.object(recommendations.connection, "close"):
            threads = [threading.Thread(target=recommendations._refresh_thread, args=(i,)) for i in range(20)]
            for t in threads:
                t.start()
            for _ in range(50):
                with lock:
                    if running[0] == recommendations.MAX_CONCURRENT_REFRESHES:
                        break
                threading.Event().wait(0.02)
            release.set()
            for t in threads:
                t.join(5)
        self.assertEqual(peak[0], recommendations.MAX_CONCURRENT_REFRESHES)
        self.assertEqual(sorted(done), list(range(20)))

    def test_thread_start_failure_releases_the_user(self):
        user = User.objects.create_user(username="nostart", password="Xk9#mQ2vTz8p")
        UserRecommendationCache.objects.create(user=user)
        no_thread = RuntimeError("can't start new thread")
        with patch.object(recommendations.threading.Thread, "start", side_effect=no_thread), \
                self.assertLogs("userdata.recommendations", level="ERROR"):
            recommendations.request_refresh(user.id, rerun_if_running=False)
        self.assertNotIn(user.id, recommendations._computing_users)
        self.assertIsNone(UserRecommendationCache.objects.get(user=user).refreshing_since)
