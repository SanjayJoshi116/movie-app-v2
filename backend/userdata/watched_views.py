from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WatchedEntry
from .pagination import DefaultPagination
from .bulk_import import MAX_BULK_ENTRIES, bulk_import, timestamp_or_now  # noqa: F401 (MAX re-exported for tests)
from .serializers import BulkWatchedEntrySerializer, WatchedEntrySerializer
from .signals import schedule_refresh


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def watched_list(request):
    if request.method == "GET":
        entries = WatchedEntry.objects.filter(user=request.user).order_by("-watched_at", "-id")
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
            "original_language": serializer.validated_data.get("original_language"),
            "release_year": serializer.validated_data.get("release_year"),
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
    def build(user, media_type, item):
        vote_average = item.get("voteAverage")
        return WatchedEntry(
            user=user,
            media_id=item["mediaId"],
            media_type=media_type,
            title=item["title"],
            poster_path=item.get("posterPath"),
            vote_average=0 if vote_average is None else vote_average,
            watched_at=timestamp_or_now(item.get("watchedAt")),
            runtime_minutes=item.get("runtimeMinutes"),
            platform=item.get("platform"),
        )

    def after_create(user, added):
        # bulk_create sends no post_save, so the signal's refresh never fires.
        if added:
            schedule_refresh(user.id)

    return bulk_import(
        request,
        model=WatchedEntry,
        entry_serializer=BulkWatchedEntrySerializer,
        build=build,
        after_create=after_create,
    )
