from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db.models import F, Q
from django.utils import timezone

from userdata.models import UserRecommendationCache, WatchedEntry
from userdata.recommendations import (
    KEPT_OUTAGE,
    RECOMMENDATIONS_TTL_HOURS,
    REFRESH_STATUS_WINDOW,
    SAVED,
    FetchHealth,
    _compute_for_you,
    _compute_personalized,
    in_failure_backoff,
    save_recommendations,
)


def users_to_warm():
    """Users with watch history whose recommendations are missing or stale:
    no stored result first, then the oldest. The warm-up is cut at 30 s
    (start.py), so this order spends that time where it helps, and the next
    restart continues with the next oldest."""
    fresh_since = timezone.now() - timedelta(hours=RECOMMENDATIONS_TTL_HOURS)
    with_history = WatchedEntry.objects.values_list("user_id", flat=True).distinct()
    return (
        User.objects.filter(id__in=with_history)
        .filter(Q(rec_cache__isnull=True) | Q(rec_cache__computed_at__lt=fresh_since))
        .order_by(F("rec_cache__computed_at").asc(nulls_first=True), "id")
    )


class Command(BaseCommand):
    help = "Pre-compute recommendation cache for all users with watch history"

    def handle(self, *args, **options):
        users = list(users_to_warm())
        total = len(users)

        if total == 0:
            self.stdout.write("No users with missing or stale recommendations. Skipping.")
            return

        self.stdout.write(f"Computing recommendations for {total} user(s)...")

        for i, user in enumerate(users, 1):
            # A user backing off from a TMDB outage (set by any process) waits
            # it out here too, like their recommendation polls do. Checked per
            # user reached, since the 30 s cap usually ends the run early.
            # Under DEBUG the marker lives in each process's own LocMem cache,
            # so there this only sees this command's own outcomes.
            if in_failure_backoff(user.id):
                self.stdout.write(f"  [{i}/{total}] {user.username} — skipped (backing off after a TMDB failure)")
                continue
            # The server is already up, so a request may have started this
            # user's refresh: don't compute the same result twice.
            if UserRecommendationCache.objects.filter(
                user=user, refreshing_since__gt=timezone.now() - REFRESH_STATUS_WINDOW,
            ).exists():
                self.stdout.write(f"  [{i}/{total}] {user.username} — skipped (a refresh is already running)")
                continue
            try:
                started = timezone.now()
                health = FetchHealth()
                for_you = _compute_for_you(user, health)
                personalized = _compute_personalized(user, health)
                result = save_recommendations(user, for_you, personalized, health, started=started)
                outcome = {
                    SAVED: "done",
                    KEPT_OUTAGE: "kept previous (TMDB failed), backing off",
                }.get(result, "skipped (a newer compute already saved)")
                self.stdout.write(f"  [{i}/{total}] {user.username} — {outcome}")
            except Exception as e:
                # Broad on purpose: same heterogeneous TMDB/numpy/DB surface
                # as recommendations.py's _refresh_cache, plus this loop's
                # own job — one user's failure must not abort the batch for
                # everyone else.
                self.stderr.write(f"  [{i}/{total}] {user.username} — failed: {e}")

        self.stdout.write(self.style.SUCCESS("Recommendation cache computation complete."))
