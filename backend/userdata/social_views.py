import logging
from concurrent.futures import ThreadPoolExecutor

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import EpisodeProgress, FollowedPerson, WatchedEntry
from .pagination import DefaultPagination
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

    try:
        season = int(request.data.get("season", 1))
        episode = int(request.data.get("episode", 1))
    except (TypeError, ValueError):
        return Response({"detail": "season and episode must be integers."}, status=status.HTTP_400_BAD_REQUEST)
    if season < 1 or episode < 1:
        return Response({"detail": "season and episode must be >= 1."}, status=status.HTTP_400_BAD_REQUEST)

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
        people = FollowedPerson.objects.filter(user=request.user).order_by("-followed_at")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(people, request)
        data = [
            {"id": p.id, "personId": p.person_id, "name": p.name, "profilePath": p.profile_path}
            for p in page
        ]
        return paginator.get_paginated_response(data)

    person_id = request.data.get("personId")
    name = request.data.get("name", "")
    profile_path = request.data.get("profilePath")
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def followed_people_recommendations(request):
    followed = list(FollowedPerson.objects.filter(user=request.user).order_by("-followed_at")[:10])
    if not followed:
        return Response([])

    watched_set = {
        (e.media_id, e.media_type)
        for e in WatchedEntry.objects.filter(user=request.user).only("media_id", "media_type")
    }

    def fetch_credits(fp):
        try:
            data = tmdb_client._get(f"/person/{fp.person_id}/combined_credits")
            items = []
            seen_ids = set()
            for c in data.get("cast", []):
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
            return fp.name, items[:12]
        except Exception:
            logger.exception("Failed to fetch combined credits for person %s", fp.person_id)
            return fp.name, []

    sections = []
    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(fetch_credits, followed))

    for name, items in results:
        if items:
            sections.append({"key": f"follow-{name}", "label": f"New from {name}", "items": items})

    return Response(sections)
