from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import NotificationCheckpoint
from .social_views import _fetch_followed_people_credits
from .timezones import local_today, request_tz

NEW_RELEASE_WINDOW_DAYS = 30
MAX_ITEMS = 30


class NotificationsThrottle(UserRateThrottle):
    scope = "notifications"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([NotificationsThrottle])
def new_release_notifications(request):
    checkpoint, _ = NotificationCheckpoint.objects.get_or_create(
        user=request.user, defaults={"last_seen_at": timezone.now()}
    )

    results = _fetch_followed_people_credits(request.user)
    # "Today" and the last-check day are the requesting device's, not the server's.
    today = local_today(request)
    cutoff = today - timedelta(days=NEW_RELEASE_WINDOW_DAYS)
    last_seen_date = checkpoint.last_seen_at.astimezone(request_tz(request)).date()

    items = []
    seen_ids = set()
    for fp, cast in results:
        for c in cast:
            if c.get("media_type") not in ("movie", "tv"):
                continue
            date_str = c.get("release_date") or c.get("first_air_date")
            if not date_str:
                continue
            try:
                release_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                continue
            if release_date > today or release_date < cutoff:
                continue
            key = (c.get("id"), c["media_type"])
            if key in seen_ids:
                continue
            seen_ids.add(key)
            items.append({
                "id": c.get("id"),
                "type": c["media_type"],
                "title": c.get("title") or c.get("name", ""),
                "posterPath": c.get("poster_path"),
                "releaseDate": date_str,
                "personName": fp.name,
                "isUnread": release_date > last_seen_date,
            })

    items.sort(key=lambda x: x["releaseDate"], reverse=True)
    items = items[:MAX_ITEMS]
    unread_count = sum(1 for i in items if i["isUnread"])

    return Response({"items": items, "unreadCount": unread_count})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notifications_seen(request):
    NotificationCheckpoint.objects.update_or_create(
        user=request.user, defaults={"last_seen_at": timezone.now()}
    )
    return Response(status=status.HTTP_204_NO_CONTENT)
