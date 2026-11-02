from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import FollowedPerson, NotificationCheckpoint
from .social_views import (
    _fetch_followed_people_credits, cached_recent_credits, credit_date, credit_item, watched_keys,
)
from .timezones import local_today, request_tz

NEW_RELEASE_WINDOW_DAYS = 30
MAX_ITEMS = 30
# One poll fetches at most this many uncached people, so a huge cold follow
# list is covered over ceil(n / 40) polls instead of in one request.
NOTIFICATIONS_MAX_FETCH = 40
# Wall-clock cap on one poll's TMDB fetches. Must stay well under gunicorn's
# --timeout (docker-entrypoint.sh); test_notifications pins the margin.
NOTIFICATIONS_BUDGET_SECONDS = 15
# Notifications remembered by mark-seen (a 30-day window holds far fewer).
MAX_SEEN_ITEMS = 500


class NotificationsThrottle(UserRateThrottle):
    scope = "notifications"


def _seen_keys(seen_items):
    """The (id, type) keys a checkpoint stores, in order, ignoring malformed entries."""
    return [tuple(k) for k in seen_items or [] if isinstance(k, list) and len(k) == 2]


def _window_items(results, today, watched, limit=MAX_ITEMS):
    """[(item, key)] for the credits dated in the notification window, newest
    first, one per (id, media_type), watched titles left out, at most `limit`
    (None: all). Shared by the poll and mark-seen, so what mark-seen records is
    what a poll shows."""
    cutoff = today - timedelta(days=NEW_RELEASE_WINDOW_DAYS)
    items = []
    seen_ids = set()
    for fp, cast in results:
        for c in cast:
            release_date = credit_date(c)
            if release_date is None or release_date > today or release_date < cutoff:
                continue
            key = (c["id"], c["media_type"])
            if key in seen_ids or key in watched:
                continue
            seen_ids.add(key)
            items.append(({
                **credit_item(c),
                "releaseDate": release_date.isoformat(),
                # No person id in the item for the client to fall back on.
                "personName": fp.name.strip() or f"Person {fp.person_id}",
            }, key))
    items.sort(key=lambda pair: pair[0]["releaseDate"], reverse=True)
    return items if limit is None else items[:limit]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([NotificationsThrottle])
def new_release_notifications(request):
    # A first poll starts with an empty seen set: everything shown is new.
    checkpoint, _ = NotificationCheckpoint.objects.get_or_create(
        user=request.user, defaults={"last_seen_at": timezone.now(), "seen_items": []}
    )

    # Each person's recent summary, not their full credit list: a poll's load
    # grows with recent releases, not with how many credits people have.
    results = _fetch_followed_people_credits(
        request.user, max_fetch=NOTIFICATIONS_MAX_FETCH, budget_seconds=NOTIFICATIONS_BUDGET_SECONDS,
        summary_only=True,
    )
    watched = watched_keys(request.user, results)
    # "Today" and the last-check day are the requesting device's, not the server's.
    today = local_today(request)

    if checkpoint.seen_items is None:
        # From before the seen set: unread when released after the last
        # mark-seen day, until the next mark-seen records the set.
        last_seen_date = checkpoint.last_seen_at.astimezone(request_tz(request)).date()

        def is_unread(item, _key):
            return item["releaseDate"] > last_seen_date.isoformat()
    else:
        seen = set(_seen_keys(checkpoint.seen_items))

        def is_unread(_item, key):
            return key not in seen

    items = [{**item, "isUnread": is_unread(item, key)}
             for item, key in _window_items(results, today, watched)]
    unread_count = sum(1 for i in items if i["isUnread"])

    return Response({"items": items, "unreadCount": unread_count})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notifications_seen(request):
    # The notifications a poll shows now (cached summaries only, no TMDB call:
    # a poll shows only cached people anyway), then everything seen before:
    # a person whose summary isn't cached right now keeps their seen titles.
    # One not among them later, a title TMDB adds late included, is unread
    # whatever its date. Titles in the window hidden only because they're
    # watched are recorded too (after the shown ones), so unmarking one later
    # doesn't bring it back as unread.
    today = local_today(request)
    followed = list(FollowedPerson.objects.filter(user=request.user))
    summaries = cached_recent_credits([fp.person_id for fp in followed])
    results = [(fp, summaries.get(fp.person_id, [])) for fp in followed]
    watched = watched_keys(request.user, results)
    shown = [key for _item, key in _window_items(results, today, watched)]
    hidden = [key for _item, key in _window_items(results, today, set(), limit=None) if key in watched]
    recorded = shown + hidden
    recorded_set = set(recorded)
    with transaction.atomic():
        checkpoint, _ = NotificationCheckpoint.objects.select_for_update().get_or_create(
            user=request.user, defaults={"last_seen_at": timezone.now(), "seen_items": []},
        )
        seen = recorded + [k for k in _seen_keys(checkpoint.seen_items) if k not in recorded_set]
        checkpoint.last_seen_at = timezone.now()
        checkpoint.seen_items = [list(k) for k in seen[:MAX_SEEN_ITEMS]]
        checkpoint.save(update_fields=["last_seen_at", "seen_items"])
    return Response(status=status.HTTP_204_NO_CONTENT)
