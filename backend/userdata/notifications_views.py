from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import FollowedPerson, NotificationCheckpoint, WatchedEntry
from .social_views import _fetch_followed_people_credits, cached_recent_credits, credit_date
from .timezones import local_today, request_tz

NEW_RELEASE_WINDOW_DAYS = 30
MAX_ITEMS = 30
# One poll fetches at most this many uncached people, so a huge cold follow
# list is covered over ceil(n / 40) polls instead of in one request.
NOTIFICATIONS_MAX_FETCH = 40
# Wall-clock cap on one poll's TMDB fetches. Must stay well under gunicorn's
# --timeout (docker-entrypoint.sh); test_notifications pins the margin.
NOTIFICATIONS_BUDGET_SECONDS = 15
# Same-day items remembered by mark-seen (MAX_ITEMS a poll, with margin).
MAX_SEEN_SAME_DAY = 100


class NotificationsThrottle(UserRateThrottle):
    scope = "notifications"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([NotificationsThrottle])
def new_release_notifications(request):
    checkpoint, _ = NotificationCheckpoint.objects.get_or_create(
        user=request.user, defaults={"last_seen_at": timezone.now()}
    )

    # Each person's recent summary, not their full credit list: a poll's load
    # grows with recent releases, not with how many credits people have.
    results = _fetch_followed_people_credits(
        request.user, max_fetch=NOTIFICATIONS_MAX_FETCH, budget_seconds=NOTIFICATIONS_BUDGET_SECONDS,
        summary_only=True,
    )
    # Titles the user already watched aren't news (followed-people
    # recommendations skip them too). One query, on the request thread.
    watched = set(WatchedEntry.objects.filter(user=request.user).values_list("media_id", "media_type"))
    # "Today" and the last-check day are the requesting device's, not the server's.
    today = local_today(request)
    cutoff = today - timedelta(days=NEW_RELEASE_WINDOW_DAYS)
    last_seen_date = checkpoint.last_seen_at.astimezone(request_tz(request)).date()
    seen_same_day = {tuple(k) for k in checkpoint.seen_same_day if isinstance(k, list) and len(k) == 2}

    items = []
    seen_ids = set()
    for fp, cast in results:
        for c in cast:
            if c.get("media_type") not in ("movie", "tv"):
                continue
            release_date = credit_date(c)
            if release_date is None:
                continue
            date_str = release_date.isoformat()
            if release_date > today or release_date < cutoff:
                continue
            key = (c.get("id"), c["media_type"])
            if key in seen_ids or key in watched:
                continue
            seen_ids.add(key)
            items.append({
                "id": c.get("id"),
                "type": c["media_type"],
                "title": c.get("title") or c.get("name", ""),
                "posterPath": c.get("poster_path"),
                "releaseDate": date_str,
                # No person id in the item for the client to fall back on.
                "personName": fp.name.strip() or f"Person {fp.person_id}",
                # A same-day release is read only if the user had it at mark-seen.
                "isUnread": release_date > last_seen_date or (
                    release_date == last_seen_date and key not in seen_same_day
                ),
            })

    items.sort(key=lambda x: x["releaseDate"], reverse=True)
    items = items[:MAX_ITEMS]
    unread_count = sum(1 for i in items if i["isUnread"])

    return Response({"items": items, "unreadCount": unread_count})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notifications_seen(request):
    # Remember the items dated today that the user has now (cached summaries
    # only, no TMDB call: a poll shows only cached people anyway), so one dated
    # today that appears later is still unread.
    today = local_today(request)
    person_ids = FollowedPerson.objects.filter(user=request.user).values_list("person_id", flat=True)
    seen = []
    for cast in cached_recent_credits(list(person_ids)).values():
        for c in cast:
            if c.get("media_type") in ("movie", "tv") and credit_date(c) == today:
                key = [c.get("id"), c["media_type"]]
                if key not in seen:
                    seen.append(key)
    NotificationCheckpoint.objects.update_or_create(
        user=request.user,
        defaults={"last_seen_at": timezone.now(), "seen_same_day": seen[:MAX_SEEN_SAME_DAY]},
    )
    return Response(status=status.HTTP_204_NO_CONTENT)
