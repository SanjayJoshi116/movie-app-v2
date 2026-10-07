import logging

import requests
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import RatingEntry, TMDBProfile
from .pagination import DefaultPagination
from .bulk_import import bulk_import, timestamp_or_now
from .serializers import BulkRatingEntrySerializer, RatingEntrySerializer
from . import tmdb_client

logger = logging.getLogger(__name__)


def _sync_rating_to_tmdb(user, entry):
    """Mirror a rating to the user's connected TMDB account, if any. Best-effort:
    a TMDB failure is logged and never fails the local write."""
    try:
        tmdb_profile = user.tmdb_profile
        if tmdb_profile.session_id:
            tmdb_client.post_rating(entry.media_type, entry.media_id, tmdb_profile.session_id, entry.user_rating)
    except (TMDBProfile.DoesNotExist, requests.RequestException, ValueError):
        logger.exception("Failed to sync rating to TMDB for user %s", user.pk)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def ratings_list(request):
    if request.method == "GET":
        entries = RatingEntry.objects.filter(user=request.user).order_by("-rated_at", "-id")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(entries, request)
        return paginator.get_paginated_response(RatingEntrySerializer(page, many=True).data)

    serializer = RatingEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry, created = RatingEntry.objects.update_or_create(
        user=request.user,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "user_rating": serializer.validated_data["user_rating"],
            "review": serializer.validated_data.get("review", ""),
            # Creating and re-rating both count as "rated now".
            "rated_at": timezone.now(),
        },
    )
    _sync_rating_to_tmdb(request.user, entry)

    return Response(
        RatingEntrySerializer(entry).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def ratings_detail(request, pk):
    entry = get_object_or_404(RatingEntry, pk=pk, user=request.user)
    if request.method == "DELETE":
        try:
            tmdb_profile = request.user.tmdb_profile
            if tmdb_profile.session_id:
                tmdb_client.delete_rating(entry.media_type, entry.media_id, tmdb_profile.session_id)
        except (TMDBProfile.DoesNotExist, requests.RequestException, ValueError):
            logger.exception("Failed to delete rating on TMDB for user %s", request.user.pk)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    old_rating, old_review = entry.user_rating, entry.review
    serializer = RatingEntrySerializer(entry, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    new = serializer.validated_data
    rating_changed = "user_rating" in new and new["user_rating"] != old_rating
    review_changed = "review" in new and new["review"] != old_review
    if rating_changed or review_changed:
        serializer.save(rated_at=timezone.now())
    else:
        serializer.save()
    if rating_changed:
        _sync_rating_to_tmdb(request.user, entry)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bulk_ratings(request):
    """Create-only restore: an existing rating is never overwritten, and nothing
    is pushed to a connected TMDB account (a backup restore shouldn't fire
    hundreds of third-party writes)."""

    def build(user, media_type, item):
        return RatingEntry(
            user=user,
            media_id=item["mediaId"],
            media_type=media_type,
            title=item["title"],
            user_rating=item["userRating"],
            review=item["review"],
            rated_at=timestamp_or_now(item.get("ratedAt")),
        )

    return bulk_import(request, model=RatingEntry, entry_serializer=BulkRatingEntrySerializer, build=build)
