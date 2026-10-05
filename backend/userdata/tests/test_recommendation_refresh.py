from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import OperationalError, transaction
from rest_framework import status
from rest_framework.test import APITestCase

from userdata import recommendations
from userdata.models import WatchedEntry


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
