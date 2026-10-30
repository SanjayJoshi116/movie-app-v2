"""Per-user daily budget for background TMDB title fetches.

The metadata backfill and the recommendation cache fill each cap one run, but
nothing capped how many runs one account could cause: clearing the watched
list and importing 500 unknown ids, then opening stats, cost 100 server-key
TMDB calls each time. Both now take a grant from here first.

A database row, not the cache: `DatabaseCache.incr` is a non-atomic get + set
that also resets the expiry, so concurrent processes could overspend it.
"""
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import TmdbTitleBudget

DAILY_TITLE_FETCHES = 1000


def take(user_id, n):
    """Reserve up to `n` title fetches for user_id today; returns how many were
    granted (0..n). Call on the request/refresh thread, never a pool worker."""
    if n <= 0:
        return 0
    today = timezone.now().date()
    with transaction.atomic():
        row = TmdbTitleBudget.objects.select_for_update().filter(user_id=user_id).first()
        if row is None:
            granted = min(n, DAILY_TITLE_FETCHES)
            try:
                with transaction.atomic():
                    TmdbTitleBudget.objects.create(user_id=user_id, day=today, used=granted)
                return granted
            except IntegrityError:
                # Another process created it first: lock theirs.
                row = TmdbTitleBudget.objects.select_for_update().get(user_id=user_id)
        new_day = row.day != today
        if new_day:
            row.day, row.used = today, 0
        granted = max(0, min(n, DAILY_TITLE_FETCHES - row.used))
        # No write when nothing changed (a spent budget, same day).
        if granted or new_day:
            row.used += granted
            row.save(update_fields=["day", "used"])
    return granted
