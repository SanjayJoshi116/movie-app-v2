import logging
import time
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from django.core.cache import caches
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .bulk_import import bulk_import, timestamp_or_now
from .models import EpisodeProgress, FollowedPerson, WatchedEntry
from .pagination import DefaultPagination
from .serializers import (
    INT32_MAX,
    BulkEpisodeProgressSerializer,
    BulkFollowedPersonSerializer,
    EpisodeProgressInputSerializer,
    FollowPersonInputSerializer,
)
from . import tmdb_client

logger = logging.getLogger(__name__)


def _progress_data(prog):
    return {"showId": prog.show_id, "season": prog.season_number, "episode": prog.episode_number}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def episode_progress_list(request):
    """Every show's progress, for the backup export."""
    rows = EpisodeProgress.objects.filter(user=request.user).order_by("-updated_at", "-id")
    paginator = DefaultPagination()
    page = paginator.paginate_queryset(rows, request)
    return paginator.get_paginated_response(
        [{**_progress_data(p), "updatedAt": p.updated_at} for p in page]
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def episode_progress_bulk(request):
    """Create-only restore: a show the user already tracks keeps its progress."""

    def build(user, _media_type, item):
        return EpisodeProgress(
            user=user, show_id=item["showId"], season_number=item["season"], episode_number=item["episode"],
        )

    return bulk_import(
        request, model=EpisodeProgress, entry_serializer=BulkEpisodeProgressSerializer, build=build,
        identity=("showId", "show_id"),
    )


@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def episode_progress(request, show_id: int):
    if request.method == "GET":
        try:
            prog = EpisodeProgress.objects.get(user=request.user, show_id=show_id)
            return Response(_progress_data(prog))
        except EpisodeProgress.DoesNotExist:
            return Response(None)

    if request.method == "DELETE":
        EpisodeProgress.objects.filter(user=request.user, show_id=show_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # The path converter accepts any digits; an id past `integer` range would
    # be a DataError on insert. Reads/deletes above just match nothing.
    if not 1 <= show_id <= INT32_MAX:
        return Response({"detail": "Invalid show id."}, status=status.HTTP_400_BAD_REQUEST)
    body = EpisodeProgressInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    season = body.validated_data["season"]
    episode = body.validated_data["episode"]

    prog, _ = EpisodeProgress.objects.update_or_create(
        user=request.user,
        show_id=show_id,
        defaults={"season_number": season, "episode_number": episode},
    )
    return Response({"showId": prog.show_id, "season": prog.season_number, "episode": prog.episode_number})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def followed_people_list(request):
    if request.method == "GET":
        people = FollowedPerson.objects.filter(user=request.user).order_by("-followed_at", "-id")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(people, request)
        data = [
            {"id": p.id, "personId": p.person_id, "name": p.name, "profilePath": p.profile_path,
             "followedAt": p.followed_at}
            for p in page
        ]
        return paginator.get_paginated_response(data)

    body = FollowPersonInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    person_id = body.validated_data.get("personId")
    name = body.validated_data["name"]
    profile_path = body.validated_data.get("profilePath")
    if not person_id:
        return Response({"detail": "personId is required."}, status=status.HTTP_400_BAD_REQUEST)

    fp, created = FollowedPerson.objects.get_or_create(
        user=request.user,
        person_id=person_id,
        defaults={"name": name, "profile_path": profile_path},
    )
    return Response(
        {"id": fp.id, "personId": fp.person_id, "name": fp.name, "profilePath": fp.profile_path,
         "followedAt": fp.followed_at},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def followed_people_bulk(request):
    """Create-only restore that keeps each follow's original time."""

    def build(user, _media_type, item):
        return FollowedPerson(
            user=user, person_id=item["personId"], name=item["name"],
            profile_path=item.get("profilePath"), followed_at=timestamp_or_now(item.get("followedAt")),
        )

    return bulk_import(
        request, model=FollowedPerson, entry_serializer=BulkFollowedPersonSerializer, build=build,
        identity=("personId", "person_id"),
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def followed_people_detail(request, person_id: int):
    try:
        fp = FollowedPerson.objects.get(user=request.user, person_id=person_id)
        fp.delete()
    except FollowedPerson.DoesNotExist:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


PERSON_CREDITS_TTL = 6 * 60 * 60
# Wall-clock cap on the followed-people recommendations' TMDB fetches (up to 10
# cold people). Must stay well under gunicorn's --timeout
# (docker-entrypoint.sh); test_followed_people pins the margin.
FOLLOWED_RECS_BUDGET_SECONDS = 15
# Only what notifications / followed-people recommendations read — keeps the
# DB-cache rows small (a full combined_credits payload can be hundreds of KB).
_CREDIT_FIELDS = (
    "id", "media_type", "title", "name", "poster_path", "release_date", "first_air_date", "vote_average",
)
# Talk shows and news: a person appearing as themselves, not their work.
TALK_AND_NEWS_GENRES = {10767, 10763}
# "New from {name}" reads a person's titles dated this far back, or later.
NEW_WORK_DAYS = 730


# A person's summary keeps only credits dated this close to "now" (UTC, at
# fetch time): notifications look 30 days back in the device's zone (at most a
# day from UTC) and a summary is at most PERSON_CREDITS_TTL old, so these
# margins cover every poll that can read it, a title dated tomorrow included.
RECENT_PAST_DAYS = 32
RECENT_FUTURE_DAYS = 2


def credits_cache():
    """Person credits have their own cache alias (settings.PERSON_CREDITS_*):
    in `default` they culled throttle counters, in `tmdb` the proxy's entries."""
    return caches["person_credits"]


# Versioned: entries cached before crew credits counted (cast only, all-time)
# are never read.
def _credits_key(person_id):
    return f"person_new:v2:{person_id}"


def _recent_key(person_id):
    return f"person_recent:v2:{person_id}"


def is_talk_or_news(credit):
    return bool(TALK_AND_NEWS_GENRES & set(credit.get("genre_ids") or []))


def credit_date(credit):
    """A credit's release or first-air date, or None if missing or malformed."""
    value = credit.get("release_date") or credit.get("first_air_date")
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _recent_summary(cast, today: date):
    start = today - timedelta(days=RECENT_PAST_DAYS)
    end = today + timedelta(days=RECENT_FUTURE_DAYS)
    return [c for c in cast if (d := credit_date(c)) is not None and start <= d <= end]


def new_work(credits, today: date):
    """Credits dated within NEW_WORK_DAYS before `today`, or later; undated ones
    are left out. Also applied on read, so a list cached days ago stays right."""
    start = today - timedelta(days=NEW_WORK_DAYS)
    return [c for c in credits if (d := credit_date(c)) is not None and d >= start]


def cached_recent_credits(person_ids):
    """{person_id: recent summary} for the people whose summary is cached. Cache
    only, no TMDB call."""
    found = credits_cache().get_many([_recent_key(pid) for pid in person_ids])
    return {pid: found[_recent_key(pid)] for pid in person_ids if _recent_key(pid) in found}


def _fetch_person_credits(person_id):
    """One person's work from TMDB: acting and every crew job, one entry per
    (id, media_type), talk and news appearances left out, trimmed. Raises on
    failure. No DB or cache access, so it's safe in a worker thread (the
    production cache is DB-backed; worker threads would each open and leak a
    connection)."""
    data = tmdb_client._get(f"/person/{person_id}/combined_credits")
    seen = set()
    out = []
    for c in [*(data.get("cast") or []), *(data.get("crew") or [])]:
        if not isinstance(c, dict) or is_talk_or_news(c):
            continue
        key = (c.get("id"), c.get("media_type"))
        if key in seen:
            continue
        seen.add(key)
        out.append({k: c[k] for k in _CREDIT_FIELDS if k in c})
    return out


def _fetch_followed_people_credits(user, limit=None, max_fetch=None, budget_seconds=None, summary_only=False):
    """Fetch TMDB credits (acting and crew) for a user's followed people (all of them, or the
    `limit` most recently followed). Returns [(FollowedPerson, cast_list)];
    cast_list is [] for a person whose TMDB fetch failed (or wasn't fetched this
    call), so callers never need to special-case a failure separately from
    "no credits".

    Credits are cached per person (shared by every follower) for
    PERSON_CREDITS_TTL, each as soon as it arrives. Failures are never cached,
    so the next call retries; a TMDB 404 is cached as no credits. `max_fetch` caps how many uncached people one
    call fetches (in followed order, so the next call's first uncached ones are
    new people), and `budget_seconds` caps how long it waits for them. Fetches
    still running at the deadline are abandoned: they only do HTTP.

    Without `summary_only` the lists are each person's new and upcoming work
    (new_work). With it, their recent summary (credits dated around now):
    notifications read only those,
    so a poll's load doesn't grow with how many credits people have. Both are
    written together on every fetch, so either caller's fetch serves the other."""
    followed = FollowedPerson.objects.filter(user=user).order_by("-followed_at", "-id")
    followed = list(followed[:limit] if limit is not None else followed)
    if not followed:
        return []

    key = _recent_key if summary_only else _credits_key
    store = credits_cache()
    cached = store.get_many([key(fp.person_id) for fp in followed])
    to_fetch = list(dict.fromkeys(fp.person_id for fp in followed if key(fp.person_id) not in cached))
    if max_fetch is not None:
        to_fetch = to_fetch[:max_fetch]

    def fetch(person_id):
        try:
            return person_id, _fetch_person_credits(person_id)
        except (requests.RequestException, ValueError) as e:
            if tmdb_client.is_not_found(e):
                # Settled: cached as "no credits", so a merged or deleted
                # person isn't refetched (and doesn't starve others) every poll.
                logger.warning("TMDB has no person %s; caching no credits", person_id)
                return person_id, []
            logger.exception("Failed to fetch combined credits for person %s", person_id)
            return person_id, None

    if to_fetch:
        deadline = time.monotonic() + budget_seconds if budget_seconds is not None else None
        ex = ThreadPoolExecutor(max_workers=5)
        futures = [ex.submit(fetch, pid) for pid in to_fetch]
        try:
            remaining = None if deadline is None else max(0.0, deadline - time.monotonic())
            for future in as_completed(futures, timeout=remaining):
                pid, cast = future.result()
                if cast is not None:
                    # On this thread: the production cache is DB-backed.
                    today = timezone.now().date()
                    recent, new = _recent_summary(cast, today), new_work(cast, today)
                    store.set_many({_credits_key(pid): new, _recent_key(pid): recent}, PERSON_CREDITS_TTL)
                    cached[key(pid)] = recent if summary_only else new
        except TimeoutError:
            logger.warning(
                "Followed-people credits budget (%ss) ran out with %s of %s fetches unfinished",
                budget_seconds, sum(not f.done() for f in futures), len(futures),
            )
        finally:
            ex.shutdown(wait=False, cancel_futures=True)

    return [(fp, cached.get(key(fp.person_id), [])) for fp in followed]


class FollowedRecsThrottle(UserRateThrottle):
    """Up to 10 TMDB fetches per call on the server's key; the page asks once
    per load, so this is far above real use."""

    scope = "followed_recs"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([FollowedRecsThrottle])
def followed_people_recommendations(request):
    # One section per person in the UI, so only the most recent follows.
    results = _fetch_followed_people_credits(request.user, limit=10, budget_seconds=FOLLOWED_RECS_BUDGET_SECONDS)
    if not results:
        return Response([])

    watched_set = {
        (e.media_id, e.media_type)
        for e in WatchedEntry.objects.filter(user=request.user).only("media_id", "media_type")
    }

    today = timezone.now().date()
    sections = []
    for fp, cast in results:
        dated = []
        # (id, type): a movie and a TV show can share a TMDB id.
        seen = set()
        # New and upcoming work only, newest (upcoming) first. No rating floor:
        # new titles have few votes.
        for c in new_work(cast, today):
            if c.get("media_type") not in ("movie", "tv"):
                continue
            mid = c.get("id")
            key = (mid, c["media_type"])
            if key in watched_set or key in seen:
                continue
            seen.add(key)
            dated.append((credit_date(c), {
                "id": mid,
                "type": c["media_type"],
                "title": c.get("title") or c.get("name", ""),
                "posterPath": c.get("poster_path"),
                "voteAverage": c.get("vote_average", 0),
            }))
        dated.sort(key=lambda x: x[0], reverse=True)
        items = [item for _, item in dated[:12]]
        if items:
            # Keyed by TMDB id: two followed people can share a name.
            sections.append({"key": f"follow-{fp.person_id}", "label": f"New from {fp.name}", "items": items})

    return Response(sections)
