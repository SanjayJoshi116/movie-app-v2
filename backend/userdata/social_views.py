import logging
from concurrent.futures import ThreadPoolExecutor

import requests
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import EpisodeProgress, FollowedPerson, WatchedEntry
from .pagination import DefaultPagination
from .serializers import INT32_MAX, EpisodeProgressInputSerializer, FollowPersonInputSerializer
from . import tmdb_client

logger = logging.getLogger(__name__)


@api_view(["GET", "POST", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def episode_progress(request, show_id: int):
    if request.method == "GET":
        try:
            prog = EpisodeProgress.objects.get(user=request.user, show_id=show_id)
            return Response({"showId": prog.show_id, "season": prog.season_number, "episode": prog.episode_number})
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
            {"id": p.id, "personId": p.person_id, "name": p.name, "profilePath": p.profile_path}
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
        {"id": fp.id, "personId": fp.person_id, "name": fp.name, "profilePath": fp.profile_path},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
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


def _fetch_followed_people_credits(user, limit=None):
    """Fetch TMDB cast credits for a user's followed people (all of them, or the
    `limit` most recently followed). Returns [(FollowedPerson, cast_list)];
    cast_list is [] for a person whose TMDB fetch failed, so callers never need
    to special-case a failure separately from "no credits".

    Credits are cached per person (shared by every follower) for
    PERSON_CREDITS_TTL. Failures are never cached, so the next call retries."""
    followed = FollowedPerson.objects.filter(user=user).order_by("-followed_at", "-id")
    followed = list(followed[:limit] if limit is not None else followed)
    if not followed:
        return []

    cached = cache.get_many([_credits_key(fp.person_id) for fp in followed])
    to_fetch = list({fp.person_id for fp in followed if _credits_key(fp.person_id) not in cached})

    def fetch(person_id):
        try:
            return person_id, _fetch_person_credits(person_id)
        except (requests.RequestException, ValueError):
            logger.exception("Failed to fetch combined credits for person %s", person_id)
            return person_id, None

    if to_fetch:
        with ThreadPoolExecutor(max_workers=5) as ex:
            fetched = {pid: cast for pid, cast in ex.map(fetch, to_fetch) if cast is not None}
        cache.set_many({_credits_key(pid): cast for pid, cast in fetched.items()}, PERSON_CREDITS_TTL)
        cached.update({_credits_key(pid): cast for pid, cast in fetched.items()})

    return [(fp, cached.get(_credits_key(fp.person_id), [])) for fp in followed]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def followed_people_recommendations(request):
    # One section per person in the UI, so only the most recent follows.
    results = _fetch_followed_people_credits(request.user, limit=10)
    if not results:
        return Response([])

    watched_set = {
        (e.media_id, e.media_type)
        for e in WatchedEntry.objects.filter(user=request.user).only("media_id", "media_type")
    }

    sections = []
    for fp, cast in results:
        items = []
        seen_ids = set()
        for c in cast:
            if c.get("media_type") not in ("movie", "tv"):
                continue
            mid = c.get("id")
            if (mid, c["media_type"]) in watched_set or mid in seen_ids:
                continue
            if (c.get("vote_average") or 0) < 6:
                continue
            seen_ids.add(mid)
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
