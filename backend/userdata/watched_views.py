from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WatchedEntry
from .pagination import DefaultPagination
from .serializers import WatchedEntrySerializer

MAX_BULK_ENTRIES = 500


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def watched_list(request):
    if request.method == "GET":
        entries = WatchedEntry.objects.filter(user=request.user).order_by("-watched_at")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(entries, request)
        return paginator.get_paginated_response(WatchedEntrySerializer(page, many=True).data)

    serializer = WatchedEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry, created = WatchedEntry.objects.get_or_create(
        user=request.user,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "poster_path": serializer.validated_data.get("poster_path"),
            "vote_average": serializer.validated_data.get("vote_average", 0),
            "runtime_minutes": serializer.validated_data.get("runtime_minutes"),
            "platform": serializer.validated_data.get("platform"),
        },
    )
    return Response(
        WatchedEntrySerializer(entry).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def watched_detail(request, pk):
    entry = get_object_or_404(WatchedEntry, pk=pk, user=request.user)
    entry.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def watched_clear(request):
    deleted, _ = WatchedEntry.objects.filter(user=request.user).delete()
    return Response({"deleted": deleted}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bulk_watched(request):
    entries = request.data.get("entries", [])
    if not isinstance(entries, list):
        return Response({"detail": "entries must be a list."}, status=status.HTTP_400_BAD_REQUEST)
    if len(entries) > MAX_BULK_ENTRIES:
        return Response(
            {"detail": f"entries must not exceed {MAX_BULK_ENTRIES} items."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    media_type = request.data.get("mediaType", "movie")
    if media_type not in ("movie", "tv"):
        return Response({"detail": "mediaType must be 'movie' or 'tv'."}, status=status.HTTP_400_BAD_REQUEST)

    seen_media_ids = set()
    unique_media_ids = []
    objs = []
    for item in entries:
        media_id = item.get("mediaId")
        if not media_id or media_id in seen_media_ids:
            continue
        seen_media_ids.add(media_id)
        unique_media_ids.append(media_id)
        objs.append(WatchedEntry(
            user=request.user,
            media_id=media_id,
            media_type=media_type,
            title=item.get("title", ""),
            poster_path=item.get("posterPath"),
            vote_average=item.get("voteAverage", 0),
        ))

    existing_ids = set(
        WatchedEntry.objects.filter(
            user=request.user, media_type=media_type, media_id__in=unique_media_ids
        ).values_list("media_id", flat=True)
    )

    with transaction.atomic():
        WatchedEntry.objects.bulk_create(objs, ignore_conflicts=True)

    added = sum(1 for mid in unique_media_ids if mid not in existing_ids)
    skipped = len(unique_media_ids) - added

    return Response({"added": added, "skipped": skipped}, status=status.HTTP_200_OK)
