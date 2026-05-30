from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WatchlistEntry
from .serializers import WatchlistEntrySerializer


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def watchlist_list(request):
    if request.method == "GET":
        entries = WatchlistEntry.objects.filter(user=request.user).order_by("-added_at")
        return Response(WatchlistEntrySerializer(entries, many=True).data)

    serializer = WatchlistEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry, created = WatchlistEntry.objects.get_or_create(
        user=request.user,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "poster_path": serializer.validated_data.get("poster_path"),
            "vote_average": serializer.validated_data.get("vote_average", 0),
        },
    )
    return Response(
        WatchlistEntrySerializer(entry).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def watchlist_clear(request):
    WatchlistEntry.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def watchlist_detail(request, pk):
    entry = get_object_or_404(WatchlistEntry, pk=pk, user=request.user)
    if request.method == "DELETE":
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = WatchlistEntrySerializer(entry, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)
