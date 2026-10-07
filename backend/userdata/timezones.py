"""Whose clock decides "which day".

- "Today" follows the device making the request: the app sends its IANA time
  zone in an `X-Timezone` header on every authenticated call.
- A past watch stays on the day it was logged: WatchedEntry.watched_tz records
  the zone at log time; entries without one fall back to the request's zone.

Invalid or missing zones never fail a request; they fall back to UTC.
"""
from datetime import UTC as DT_UTC, date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

MAX_TZ_LENGTH = 64
UTC = ZoneInfo("UTC")


def valid_tz_name(name) -> str:
    """The name if it's a loadable IANA zone, else ""."""
    if not isinstance(name, str) or not name or len(name) > MAX_TZ_LENGTH:
        return ""
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ""
    return name


def request_tz_name(request) -> str:
    """The requesting device's validated zone name, or "" (for storing)."""
    return valid_tz_name(request.META.get("HTTP_X_TIMEZONE", ""))


def request_tz(request) -> ZoneInfo:
    """The requesting device's zone, or UTC."""
    name = request_tz_name(request)
    return ZoneInfo(name) if name else UTC


def entry_tz(entry, request) -> ZoneInfo:
    """The zone a watch was logged in, else the requesting device's."""
    name = valid_tz_name(entry.watched_tz)
    return ZoneInfo(name) if name else request_tz(request)


def entry_local(entry, request):
    """The watch time as a datetime in the entry's day-deciding zone."""
    watched_at = entry.watched_at
    if timezone.is_naive(watched_at):
        watched_at = watched_at.replace(tzinfo=DT_UTC)
    return watched_at.astimezone(entry_tz(entry, request))


def entry_day(entry, request) -> date:
    return entry_local(entry, request).date()


def local_today(request) -> date:
    return timezone.now().astimezone(request_tz(request)).date()
