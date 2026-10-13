import itertools
import threading
from datetime import timedelta
from unittest.mock import patch

import requests
from django.contrib.auth.models import User
from django.db import OperationalError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from userdata import recommendations
from userdata.models import TMDBMediaCache, UserRecommendationCache, WatchedEntry


class RefreshCoalescingTests(APITestCase):
    """Background threads are replaced by a recorder so each test controls
    exactly when a "running" refresh finishes (via _finish_refresh)."""

    def setUp(self):
        recommendations._computing_users.clear()
        recommendations._rerun_users.clear()
        self.spawned = []
        patcher = patch.object(recommendations, "_spawn_refresh", side_effect=self.spawned.append)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.user = User.objects.create_user(username="rae", password="Xk9#mQ2vTz8p")

    def tearDown(self):
        recommendations._computing_users.clear()
        recommendations._rerun_users.clear()

    def _drain(self):
        """Let every spawned run finish in order; return the total number of runs."""
        runs = 0
        while runs < len(self.spawned):
            recommendations._finish_refresh(self.spawned[runs])
            runs += 1
        return runs

    def test_mark_watched_schedules_refresh_after_commit(self):
        with self.captureOnCommitCallbacks(execute=True):
            WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A")
            self.assertEqual(self.spawned, [])  # not before commit
        self.assertEqual(self.spawned, [self.user.id])

    def test_bulk_clear_runs_at_most_twice(self):
        WatchedEntry.objects.bulk_create([
            WatchedEntry(user=self.user, media_id=i, media_type="movie", title=f"M{i}")
            for i in range(50)
        ])
        self.client.force_authenticate(user=self.user)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.delete("/api/watched/clear/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["deleted"], 50)
        self.assertLessEqual(self._drain(), 2)
        self.assertNotIn(self.user.id, recommendations._computing_users)

    def test_trigger_while_in_flight_runs_exactly_one_follow_up(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        for _ in range(5):
            recommendations.request_refresh(self.user.id, rerun_if_running=True)
        self.assertEqual(len(self.spawned), 1)
        self.assertEqual(self._drain(), 2)
        self.assertNotIn(self.user.id, recommendations._computing_users)
        self.assertNotIn(self.user.id, recommendations._rerun_users)

    def test_view_style_trigger_while_in_flight_does_not_rerun(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        self.assertTrue(recommendations._start_refresh_if_needed(self.user))
        self.assertEqual(self._drain(), 1)

    def test_different_users_both_run(self):
        other = User.objects.create_user(username="sol", password="Xk9#mQ2vTz8p")
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        recommendations.request_refresh(other.id, rerun_if_running=True)
        self.assertEqual(sorted(self.spawned), sorted([self.user.id, other.id]))

    def test_account_deletion_schedules_no_refresh(self):
        WatchedEntry.objects.bulk_create([
            WatchedEntry(user=self.user, media_id=i, media_type="movie", title=f"M{i}")
            for i in range(20)
        ])
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            self.user.delete()
        self.assertEqual(callbacks, [])
        self.assertEqual(self.spawned, [])

    def test_rolled_back_create_schedules_no_refresh(self):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            try:
                with transaction.atomic():
                    WatchedEntry.objects.create(user=self.user, media_id=1, media_type="movie", title="A")
                    raise RuntimeError("rollback")
            except RuntimeError:
                pass
        self.assertEqual(callbacks, [])
        self.assertEqual(self.spawned, [])

    def test_thread_target_exits_quietly_for_missing_user(self):
        recommendations._computing_users.add(999999)
        with patch.object(recommendations, "_refresh_cache") as refresh, \
                self.assertNoLogs("userdata.recommendations", level="WARNING"):
            recommendations._refresh_cache_by_id(999999)
        refresh.assert_not_called()
        self.assertNotIn(999999, recommendations._computing_users)

    def test_db_error_loading_user_releases_slot(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        with patch.object(recommendations.User.objects, "filter", side_effect=OperationalError("db down")), \
                self.assertLogs("userdata.recommendations", level="WARNING"):
            recommendations._refresh_cache_by_id(self.user.id)
        self.assertNotIn(self.user.id, recommendations._computing_users)
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        self.assertEqual(self.spawned, [self.user.id, self.user.id])  # next trigger starts a new run

    def test_db_error_loading_user_still_runs_queued_follow_up(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        recommendations.request_refresh(self.user.id, rerun_if_running=True)  # queues one follow-up
        with patch.object(recommendations.User.objects, "filter", side_effect=OperationalError("db down")), \
                self.assertLogs("userdata.recommendations", level="WARNING"):
            recommendations._refresh_cache_by_id(self.user.id)
        self.assertEqual(self.spawned, [self.user.id, self.user.id])  # follow-up handed on
        self.assertNotIn(self.user.id, recommendations._rerun_users)
        recommendations._finish_refresh(self.user.id)  # follow-up finishes
        self.assertNotIn(self.user.id, recommendations._computing_users)

    def test_refresh_cache_finally_hands_off_to_queued_rerun(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        with patch.object(recommendations, "_compute_for_you", return_value=[]), \
                patch.object(recommendations, "_compute_personalized", return_value=[]):
            recommendations._refresh_cache_by_id(self.user.id)
        self.assertEqual(self.spawned, [self.user.id, self.user.id])
        self.assertIn(self.user.id, recommendations._computing_users)


def _section(key, n=1):
    return {"key": key, "label": key, "items": [{"id": i, "type": "movie"} for i in range(n)]}


def _tmdb_ok():
    """Patches for a working TMDB: every call returns fresh results."""
    ids = itertools.count(10_000)

    def get(path, *a, **k):
        return {
            "results": [{"id": next(ids), "title": "x", "vote_average": 7, "media_type": "movie"}],
            "cast": [{"id": next(ids), "title": "x", "vote_average": 7, "media_type": "movie"}],
        }

    return [
        patch.object(recommendations.tmdb_client, "get_details_with_cast",
                     return_value={"genre_ids": [18], "top_cast": [{"id": 5, "name": "A"}]}),
        patch.object(recommendations.tmdb_client, "_get", side_effect=get),
        patch.object(recommendations.tmdb_client, "discover",
                     side_effect=lambda *a, **k: [{"id": next(ids), "title": "x", "genre_ids": [18]}]),
        patch.object(recommendations.tmdb_client, "get_genre_names", return_value={}),
        patch.object(recommendations, "backfill_entries"),
    ]


def _tmdb_down():
    down = requests.ConnectionError("tmdb down")
    return [
        patch.object(recommendations.tmdb_client, "get_details_with_cast", side_effect=down),
        patch.object(recommendations.tmdb_client, "_get", side_effect=down),
        patch.object(recommendations.tmdb_client, "discover", side_effect=down),
        patch.object(recommendations.tmdb_client, "get_genre_names", return_value={}),
        patch.object(recommendations, "backfill_entries"),
    ]


class _RefreshBase(APITestCase):
    def setUp(self):
        recommendations._computing_users.clear()
        recommendations._rerun_users.clear()
        self.spawned = []
        patcher = patch.object(recommendations, "_spawn_refresh", side_effect=self.spawned.append)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(recommendations._computing_users.clear)
        self.addCleanup(recommendations._rerun_users.clear)
        self.user = User.objects.create_user(username="ref", password="Xk9#mQ2vTz8p")
        for i in range(1, 5):
            WatchedEntry.objects.create(
                user=self.user, media_id=i, media_type="movie", title=f"M{i}", genre_ids=[18, 35 + i % 2],
            )

    def _with(self, patches):
        for p in patches:
            p.start()
            self.addCleanup(p.stop)


class RefreshThreadingTests(_RefreshBase):
    def test_media_cache_db_access_stays_on_calling_thread(self):
        self._with(_tmdb_ok())
        TMDBMediaCache.objects.create(media_id=1, media_type="movie", genre_ids=[18], top_cast=[])
        TMDBMediaCache.objects.filter(media_id=1).update(cached_at=timezone.now() - timedelta(days=30))
        manager = TMDBMediaCache.objects
        calls = []

        def recorder(name):
            real = getattr(manager, name)

            def wrapper(*a, **k):
                calls.append((name, threading.current_thread()))
                return real(*a, **k)
            return wrapper

        with patch.object(manager, "update_or_create", side_effect=recorder("update_or_create")), \
                patch.object(manager, "filter", side_effect=recorder("filter")), \
                patch.object(manager, "get", side_effect=recorder("get")):
            recommendations._refresh_cache(self.user)

        self.assertEqual(sum(name == "update_or_create" for name, _ in calls), 4)  # 1 stale + 3 missing
        self.assertEqual({t for _, t in calls}, {threading.current_thread()})
        self.assertTrue(UserRecommendationCache.objects.get(user=self.user).for_you_json)


class OutageGuardTests(_RefreshBase):
    def _store(self, for_you, personalized):
        row = UserRecommendationCache.objects.create(
            user=self.user, for_you_json=for_you, personalized_json=personalized,
        )
        old = timezone.now() - timedelta(days=2)
        UserRecommendationCache.objects.filter(pk=row.pk).update(computed_at=old)
        return old

    def _compute_with_failure(self, for_you, personalized):
        def failing(result):
            def compute(user, health):
                health.mark_failed()
                return result
            return compute
        self._with([
            patch.object(recommendations, "_compute_for_you", side_effect=failing(for_you)),
            patch.object(recommendations, "_compute_personalized", side_effect=failing(personalized)),
        ])

    def test_tmdb_down_keeps_stored_row(self):
        self._with(_tmdb_down())
        for_you, personalized = [_section("trending"), _section("hidden-gems")], [_section("cluster-0")]
        old = self._store(for_you, personalized)
        with self.assertLogs("userdata.recommendations", level="WARNING") as logs:
            recommendations._refresh_cache(self.user)
        row = UserRecommendationCache.objects.get(user=self.user)
        self.assertEqual((row.for_you_json, row.personalized_json), (for_you, personalized))
        self.assertEqual(row.computed_at, old)
        self.assertTrue(any("kept the previous result" in m for m in logs.output))

    def test_tmdb_down_without_row_writes_nothing(self):
        self._with(_tmdb_down())
        recommendations._refresh_cache(self.user)
        self.assertFalse(UserRecommendationCache.objects.filter(user=self.user).exists())

    def test_partial_failure_with_equal_section_count_is_saved(self):
        self._store([_section("trending"), _section("old-gems")], [])
        new = [_section("trending", 3), _section("hidden-gems", 2)]
        self._compute_with_failure(new, [])
        recommendations._refresh_cache(self.user)
        self.assertEqual(UserRecommendationCache.objects.get(user=self.user).for_you_json, new)

    def test_partial_failure_with_fewer_sections_keeps_row(self):
        stored = [_section("trending"), _section("hidden-gems")]
        self._store(stored, [])
        self._compute_with_failure([_section("trending", 3)], [])
        recommendations._refresh_cache(self.user)
        self.assertEqual(UserRecommendationCache.objects.get(user=self.user).for_you_json, stored)

    def test_clean_refresh_with_fewer_sections_is_saved(self):
        self._store([_section("trending"), _section("hidden-gems")], [])
        self._with([
            patch.object(recommendations, "_compute_for_you", return_value=[_section("trending")]),
            patch.object(recommendations, "_compute_personalized", return_value=[]),
        ])
        recommendations._refresh_cache(self.user)
        self.assertEqual(UserRecommendationCache.objects.get(user=self.user).for_you_json, [_section("trending")])


class CrossProcessStatusTests(_RefreshBase):
    URLS = ("/api/recommendations/for-you/", "/api/recommendations/personalized/")

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.row = UserRecommendationCache.objects.create(
            user=self.user, for_you_json=[_section("a")], personalized_json=[_section("b")],
        )

    def _stamp(self, ago):
        UserRecommendationCache.objects.filter(pk=self.row.pk).update(refreshing_since=timezone.now() - ago)

    def test_refresh_on_another_process_reports_pending(self):
        self._stamp(timedelta(minutes=1))  # and _computing_users is empty in this process
        for url in self.URLS:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).data["status"], "pending")
        self.assertEqual(self.spawned, [])  # fresh cache: nothing started here

    def test_stamp_older_than_window_reports_ready(self):
        self._stamp(recommendations.REFRESH_STATUS_WINDOW + timedelta(minutes=1))
        for url in self.URLS:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).data["status"], "ready")

    def test_stamp_set_on_start_and_cleared_when_finished(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        self.row.refresh_from_db()
        self.assertIsNotNone(self.row.refreshing_since)
        recommendations.request_refresh(self.user.id, rerun_if_running=True)  # queues a follow-up

        recommendations._finish_refresh(self.user.id)  # hands off to the follow-up: still running
        self.row.refresh_from_db()
        self.assertIsNotNone(self.row.refreshing_since)

        recommendations._finish_refresh(self.user.id)  # follow-up finishes
        self.row.refresh_from_db()
        self.assertIsNone(self.row.refreshing_since)

    def test_full_refresh_clears_stamp(self):
        self._with([
            patch.object(recommendations, "_compute_for_you", return_value=[_section("a")]),
            patch.object(recommendations, "_compute_personalized", return_value=[]),
        ])
        recommendations.request_refresh(self.user.id, rerun_if_running=False)
        recommendations._refresh_cache_by_id(self.user.id)
        self.row.refresh_from_db()
        self.assertIsNone(self.row.refreshing_since)
        for url in self.URLS:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).data["status"], "ready")


def _http_error(status_code):
    response = requests.Response()
    response.status_code = status_code
    return requests.HTTPError(f"{status_code} error", response=response)


class NotFoundIsSettledTests(_RefreshBase):
    """A TMDB 404 is an answer (the title or person is gone), not an outage."""

    def _details(self, failing_id, error):
        def details(media_id, media_type):
            if media_id == failing_id:
                raise error
            return {"genre_ids": [18], "top_cast": [{"id": 5, "name": "A"}]}
        return patch.object(recommendations.tmdb_client, "get_details_with_cast", side_effect=details)

    def test_404_title_is_cached_empty_and_not_refetched(self):
        entries = list(WatchedEntry.objects.filter(user=self.user))
        health = recommendations.FetchHealth()
        with self._details(1, _http_error(404)) as details:
            rows = recommendations._fill_media_cache(entries, health)
        self.assertFalse(health.failed)
        self.assertEqual((rows[(1, "movie")].genre_ids, rows[(1, "movie")].top_cast), ([], []))
        self.assertEqual(details.call_count, 4)

        with self._details(1, _http_error(404)) as details:
            recommendations._fill_media_cache(entries, recommendations.FetchHealth())
        details.assert_not_called()  # all fresh now, the 404 title included

    def test_5xx_title_stores_nothing_and_marks_failed(self):
        entries = list(WatchedEntry.objects.filter(user=self.user))
        health = recommendations.FetchHealth()
        with self._details(1, _http_error(503)):
            rows = recommendations._fill_media_cache(entries, health)
        self.assertTrue(health.failed)
        self.assertIsNone(rows[(1, "movie")])
        self.assertFalse(TMDBMediaCache.objects.filter(media_id=1, media_type="movie").exists())

    def _tmdb_with_404(self, path_part):
        ok = _tmdb_ok()
        ids = itertools.count(20_000)

        def get(path, *a, **k):
            if path_part in path:
                raise _http_error(404)
            return {
                "results": [{"id": next(ids), "title": "x", "vote_average": 7, "media_type": "movie"}],
                "cast": [{"id": next(ids), "title": "x", "vote_average": 7, "media_type": "movie"}],
            }
        return [p for p in ok if p.attribute != "_get"] + [
            patch.object(recommendations.tmdb_client, "_get", side_effect=get),
        ]

    def test_404_similar_titles_do_not_mark_failed(self):
        self._with(self._tmdb_with_404("/similar"))
        health = recommendations.FetchHealth()
        recommendations._compute_for_you(self.user, health)
        self.assertFalse(health.failed)

    def test_404_actor_credits_do_not_mark_failed(self):
        self._with(self._tmdb_with_404("/person/"))
        health = recommendations.FetchHealth()
        recommendations._compute_for_you(self.user, health)
        self.assertFalse(health.failed)

    def test_5xx_similar_titles_still_mark_failed(self):
        ok = [p for p in _tmdb_ok() if p.attribute != "_get"]
        self._with([*ok, patch.object(recommendations.tmdb_client, "_get", side_effect=_http_error(502))])
        health = recommendations.FetchHealth()
        recommendations._compute_for_you(self.user, health)
        self.assertTrue(health.failed)

    def test_smaller_result_is_saved_when_only_404s_happened(self):
        stored = [_section(f"old-{i}") for i in range(30)]
        UserRecommendationCache.objects.create(user=self.user, for_you_json=stored, personalized_json=[])
        self._with(self._tmdb_with_404("/person/"))
        recommendations._refresh_cache(self.user)
        self.assertNotEqual(UserRecommendationCache.objects.get(user=self.user).for_you_json, stored)


class BackfillHealthTests(_RefreshBase):
    def setUp(self):
        super().setUp()
        WatchedEntry.objects.filter(user=self.user, media_id=1).update(genre_ids=[])

    def test_incomplete_backfill_marks_personalized_compute_failed(self):
        self._with([p for p in _tmdb_ok() if p.attribute != "backfill_entries"] + [
            patch.object(recommendations, "backfill_entries", return_value=False),
        ])
        health = recommendations.FetchHealth()
        recommendations._compute_personalized(self.user, health)
        self.assertTrue(health.failed)

    def test_complete_backfill_leaves_health_alone(self):
        self._with([p for p in _tmdb_ok() if p.attribute != "backfill_entries"] + [
            patch.object(recommendations, "backfill_entries", return_value=True),
        ])
        health = recommendations.FetchHealth()
        recommendations._compute_personalized(self.user, health)
        self.assertFalse(health.failed)

    def test_incomplete_backfill_keeps_a_larger_stored_result(self):
        stored = [_section(f"old-{i}") for i in range(30)]
        UserRecommendationCache.objects.create(user=self.user, for_you_json=stored, personalized_json=[])
        self._with([
            patch.object(recommendations, "backfill_entries", return_value=False),
            patch.object(recommendations, "_compute_for_you", return_value=[_section("trending")]),
        ])
        with self.assertLogs("userdata.recommendations", level="WARNING"):
            recommendations._refresh_cache(self.user)
        self.assertEqual(UserRecommendationCache.objects.get(user=self.user).for_you_json, stored)


class OwnStampTests(_RefreshBase):
    URLS = ("/api/recommendations/for-you/", "/api/recommendations/personalized/")

    def setUp(self):
        super().setUp()
        recommendations._own_stamp.clear()
        self.addCleanup(recommendations._own_stamp.clear)
        self.client.force_authenticate(user=self.user)
        self.row = UserRecommendationCache.objects.create(
            user=self.user, for_you_json=[_section("a")], personalized_json=[_section("b")],
        )

    def _stamp(self):
        self.row.refresh_from_db()
        return self.row.refreshing_since

    def test_finish_keeps_a_stamp_another_process_wrote_meanwhile(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=False)
        theirs = timezone.now() + timedelta(seconds=1)  # another process started a refresh
        UserRecommendationCache.objects.filter(pk=self.row.pk).update(refreshing_since=theirs)

        recommendations._finish_refresh(self.user.id)

        self.assertEqual(self._stamp(), theirs)
        for url in self.URLS:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).data["status"], "pending")

    def test_finish_keeps_an_earlier_stamp_another_process_wrote_meanwhile(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=False)
        theirs = self._stamp() - timedelta(microseconds=1)  # same instant on a coarse clock
        UserRecommendationCache.objects.filter(pk=self.row.pk).update(refreshing_since=theirs)
        recommendations._finish_refresh(self.user.id)
        self.assertEqual(self._stamp(), theirs)

    def test_lone_refresh_clears_its_own_stamp(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=False)
        self.assertIsNotNone(self._stamp())
        recommendations._finish_refresh(self.user.id)
        self.assertIsNone(self._stamp())
        self.assertNotIn(self.user.id, recommendations._own_stamp)

    def test_follow_up_run_restamps(self):
        recommendations.request_refresh(self.user.id, rerun_if_running=True)
        old = timezone.now() - timedelta(minutes=9)
        UserRecommendationCache.objects.filter(pk=self.row.pk).update(refreshing_since=old)
        recommendations._own_stamp[self.user.id] = old
        recommendations.request_refresh(self.user.id, rerun_if_running=True)  # queues a follow-up

        recommendations._finish_refresh(self.user.id)  # hands off

        new = self._stamp()
        self.assertGreater(new, old)
        self.assertEqual(recommendations._own_stamp[self.user.id], new)
        recommendations._finish_refresh(self.user.id)
        self.assertIsNone(self._stamp())


class RatingRefreshTests(APITestCase):
    """recommendation-refresh: score changes schedule a refresh, review edits don't."""

    def setUp(self):
        self.user = User.objects.create_user(username="rita", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        self.refreshes = []
        patcher = patch.object(recommendations, "request_refresh",
                               side_effect=lambda uid, **kw: self.refreshes.append(uid))
        patcher.start()
        self.addCleanup(patcher.stop)

    def rate(self, rating, review=""):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/ratings/", {
                "mediaId": 550, "mediaType": "movie", "title": "Fight Club", "userRating": rating, "review": review,
            }, format="json")
        self.assertIn(res.status_code, (200, 201), res.data)
        return res.data

    def test_new_rating_schedules_a_refresh(self):
        self.rate(9)
        self.assertEqual(self.refreshes, [self.user.id])

    def test_score_change_schedules_a_refresh(self):
        self.rate(9)
        self.rate(6)
        self.assertEqual(self.refreshes, [self.user.id, self.user.id])

    def test_review_only_edit_schedules_none(self):
        entry = self.rate(9)
        self.refreshes.clear()
        self.rate(9, review="Holds up.")
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.patch(f"/api/ratings/{entry['id']}/", {"review": "Still holds up."}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.refreshes, [])

    def test_patch_score_change_schedules_a_refresh(self):
        entry = self.rate(9)
        self.refreshes.clear()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(f"/api/ratings/{entry['id']}/", {"userRating": 4}, format="json")
        self.assertEqual(self.refreshes, [self.user.id])

    def test_delete_schedules_a_refresh(self):
        entry = self.rate(9)
        self.refreshes.clear()
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.delete(f"/api/ratings/{entry['id']}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.refreshes, [self.user.id])

    def test_bulk_import_schedules_one_refresh_only_when_it_adds(self):
        body = {"entries": [
            {"mediaId": i, "mediaType": "movie", "title": f"M{i}", "userRating": 8, "review": ""} for i in (1, 2)
        ]}
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/ratings/bulk/", body, format="json")
        self.assertEqual(res.data, {"added": 2, "skipped": 0})
        self.assertEqual(self.refreshes, [self.user.id])

        self.refreshes.clear()
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/ratings/bulk/", body, format="json")
        self.assertEqual(res.data, {"added": 0, "skipped": 2})
        self.assertEqual(self.refreshes, [])

    def test_account_deletion_schedules_none(self):
        self.rate(9)
        self.refreshes.clear()
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            self.user.delete()
        self.assertEqual(callbacks, [])
        self.assertEqual(self.refreshes, [])
