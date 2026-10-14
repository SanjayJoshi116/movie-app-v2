import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from django.core.cache import cache
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


def _credits_key(person_id):
    return f"tmdb:person_credits:{person_id}"


def _fetch_person_credits(person_id):
    """TMDB cast credits for one person, trimmed. Raises on failure. No DB or
    cache access, so it's safe in a worker thread (the production cache is
    DB-backed; worker threads would each open and leak a connection)."""
    data = tmdb_client._get(f"/person/{person_id}/combined_credits")
    return [{k: c[k] for k in _CREDIT_FIELDS if k in c} for c in data.get("cast", []) if isinstance(c, dict)]


def _fetch_followed_people_credits(user, limit=None, max_fetch=None, budget_seconds=None):
    """Fetch TMDB cast credits for a user's followed people (all of them, or the
    `limit` most recently followed). Returns [(FollowedPerson, cast_list)];
    cast_list is [] for a person whose TMDB fetch failed (or wasn't fetched this
    call), so callers never need to special-case a failure separately from
    "no credits".

    Credits are cached per person (shared by every follower) for
    PERSON_CREDITS_TTL, each as soon as it arrives. Failures are never cached,
    so the next call retries; a TMDB 404 is cached as no credits. `max_fetch` caps how many uncached people one
    call fetches (in followed order, so the next call's first uncached ones are
    new people), and `budget_seconds` caps how long it waits for them. Fetches
    still running at the deadline are abandoned: they only do HTTP."""
    followed = FollowedPerson.objects.filter(user=user).order_by("-followed_at", "-id")
    followed = list(followed[:limit] if limit is not None else followed)
    if not followed:
        return []

    cached = cache.get_many([_credits_key(fp.person_id) for fp in followed])
    to_fetch = list(dict.fromkeys(fp.person_id for fp in followed if _credits_key(fp.person_id) not in cached))
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
                    cache.set(_credits_key(pid), cast, PERSON_CREDITS_TTL)
                    cached[_credits_key(pid)] = cast
        except TimeoutError:
            logger.warning(
                "Followed-people credits budget (%ss) ran out with %s of %s fetches unfinished",
                budget_seconds, sum(not f.done() for f in futures), len(futures),
            )
        finally:
            ex.shutdown(wait=False, cancel_futures=True)

    return [(fp, cached.get(_credits_key(fp.person_id), [])) for fp in followed]


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

    sections = []
    for fp, cast in results:
        items = []
        # (id, type): a movie and a TV show can share a TMDB id.
        seen = set()
        for c in cast:
            if c.get("media_type") not in ("movie", "tv"):
                continue
            mid = c.get("id")
            key = (mid, c["media_type"])
            if key in watched_set or key in seen:
                continue
            if (c.get("vote_average") or 0) < 6:
                continue
            seen.add(key)
            items.append({
                "id": mid,
                "type": c["media_type"],
                "title": c.get("title") or c.get("name", ""),
                "posterPath": c.get("poster_path"),
                "voteAverage": c.get("vote_average", 0),
            })
        items.sort(key=lambda x: -x["voteAverage"])
        items = items[:12]
        if items:
            # Keyed by TMDB id: two followed people can share a name.
            sections.append({"key": f"follow-{fp.person_id}", "label": f"New from {fp.name}", "items": items})

    return Response(sections)
