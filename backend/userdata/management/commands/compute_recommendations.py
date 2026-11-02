from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db.models import Exists, F, OuterRef, Q
from django.utils import timezone

from userdata.logging import redact
from userdata.models import UserRecommendationCache, WatchedEntry
from userdata.recommendations import (
    KEPT_OUTAGE,
    SAVED,
    claim_stale_refresh,
    compute_and_save,
    in_failure_backoff,
    release_refresh_claim,
    stale_before,
)

# How long a warm-up claim reads as "refresh running" if the command is
# killed before releasing it (the 30 s cap ends it with SIGKILL or SIGTERM,
# which skip `finally`). Longer than the cap, far shorter than
# REFRESH_STATUS_WINDOW, so a killed run blocks that user's polls briefly.
WARMUP_CLAIM_TTL = timedelta(seconds=60)


def users_to_warm():
    """Users with watch history whose recommendations are missing or stale:
    no stored result first, then the oldest. The warm-up is cut at 30 s
    (start.py), so this order spends that time where it helps, and the next
    restart continues with the next oldest."""
    fresh_since = stale_before(timezone.now())
    with_history = WatchedEntry.objects.values_list("user_id", flat=True).distinct()
    return (
        User.objects.filter(id__in=with_history)
        .filter(Q(rec_cache__isnull=True) | Q(rec_cache__computed_at__lt=fresh_since))
        .annotate(has_cache=Exists(UserRecommendationCache.objects.filter(user=OuterRef("pk"))))
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
            # The server is already up: claim the user (the row's refreshing
            # stamp, which every process's polls honour) so a request can't
            # start the same compute meanwhile. Skipped when a refresh is
            # already running or a request refreshed them since the list was
            # read. A user with no stored result has nothing to claim.
            stamp = claim_stale_refresh(user.id, live_for=WARMUP_CLAIM_TTL) if user.has_cache else None
            if user.has_cache and stamp is None:
                self.stdout.write(
                    f"  [{i}/{total}] {user.username} — skipped (already fresh, or a refresh is running)"
                )
                continue
            try:
                result = compute_and_save(user)
                outcome = {
                    SAVED: "done",
                    KEPT_OUTAGE: "kept previous (TMDB failed), backing off",
                }.get(result, "skipped (a newer compute already saved)")
                self.stdout.write(f"  [{i}/{total}] {user.username} — {outcome}")
            except Exception as e:
                # Broad on purpose: same heterogeneous TMDB/numpy/DB surface
                # as recommendations.py's _refresh_cache, plus this loop's
                # own job — one user's failure must not abort the batch for
                # everyone else. Redacted: stderr bypasses the log formatter,
                # and a requests error's text carries the URL (`api_key=`).
                self.stderr.write(redact(f"  [{i}/{total}] {user.username} — failed: {e}"))
            finally:
                if stamp is not None:
                    release_refresh_claim(user.id, stamp)

        self.stdout.write(self.style.SUCCESS("Recommendation cache computation complete."))
