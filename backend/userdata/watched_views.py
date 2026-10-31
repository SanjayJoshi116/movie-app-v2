from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import library_limits
from .models import WatchedEntry
from .pagination import DefaultPagination
from .bulk_import import bulk_import, timestamp_or_now
from .serializers import BulkWatchedEntrySerializer, WatchedEntrySerializer
from .signals import schedule_refresh
from .timezones import request_tz_name, valid_tz_name


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
    identity = {
        "media_id": serializer.validated_data["media_id"],
        "media_type": serializer.validated_data["media_type"],
    }
    rows = request.user.watched  # a related manager: get_or_create sets user
    entry, created = library_limits.get_or_create(
        "watched", request.user.id, rows, identity,
        defaults={
            "title": serializer.validated_data["title"],
            "poster_path": serializer.validated_data.get("poster_path"),
            "vote_average": serializer.validated_data.get("vote_average", 0),
            "runtime_minutes": serializer.validated_data.get("runtime_minutes"),
            "platform": serializer.validated_data.get("platform"),
            "original_language": serializer.validated_data.get("original_language"),
            "release_year": serializer.validated_data.get("release_year"),
            # The logging device's zone fixes this watch's day everywhere.
            "watched_tz": request_tz_name(request),
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
    # One DELETE instead of .delete()'s per-row post_delete (one refresh
    # trigger per row): safe only because nothing references WatchedEntry, so
    # there's no cascade to collect. test_watched pins that.
    rows = WatchedEntry.objects.filter(user=request.user)
    with transaction.atomic():
        deleted = rows._raw_delete(rows.db)
        if deleted:
            schedule_refresh(request.user.id)
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
            # A row's own zone only (never the importer's header): the original
            # zone of a CSV row is unknown, and blank is the honest value.
            watched_tz=valid_tz_name(item.get("watchedTz")),
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
        limit="watched",
    )
