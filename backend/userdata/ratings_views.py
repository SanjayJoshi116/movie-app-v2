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
from .signals import schedule_refresh
from . import tmdb_client

logger = logging.getLogger(__name__)


def _tmdb_session_id(user):
    """The user's TMDB session id, or "" when they never connected (not an error)."""
    try:
        return user.tmdb_profile.session_id
    except TMDBProfile.DoesNotExist:
        return ""


def _sync_rating_to_tmdb(user, entry):
    """Mirror a rating to the user's connected TMDB account, if any. Best-effort:
    a TMDB failure is logged and never fails the local write."""
    session_id = _tmdb_session_id(user)
    if not session_id:
        return
    try:
        tmdb_client.post_rating(entry.media_type, entry.media_id, session_id, entry.user_rating)
    except (requests.RequestException, ValueError) as e:
        # Type only: str(e) carries the request URL, session_id included.
        logger.warning("TMDB rating sync failed for user %s (%s)", user.pk, type(e).__name__)


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
    # The score before this request, to tell a re-rating from a review edit.
    old_rating = (
        RatingEntry.objects.filter(
            user=request.user,
            media_id=serializer.validated_data["media_id"],
            media_type=serializer.validated_data["media_type"],
        ).values_list("user_rating", flat=True).first()
    )
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
    # A review-only change is local: TMDB gets scores, and recommendations
    # weigh scores (loved genres, seeds, clusters). rated_at moves either way.
    if created or entry.user_rating != old_rating:
        _sync_rating_to_tmdb(request.user, entry)
        schedule_refresh(request.user.id)

    return Response(
        RatingEntrySerializer(entry).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def ratings_detail(request, pk):
    entry = get_object_or_404(RatingEntry, pk=pk, user=request.user)
    if request.method == "DELETE":
        session_id = _tmdb_session_id(request.user)
        if session_id:
            try:
                tmdb_client.delete_rating(entry.media_type, entry.media_id, session_id)
            except (requests.RequestException, ValueError) as e:
                logger.warning("TMDB rating delete failed for user %s (%s)", request.user.pk, type(e).__name__)
        entry.delete()
        schedule_refresh(request.user.id)
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
        schedule_refresh(request.user.id)
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

    def after_create(user, added):
        # bulk_create sends no signals. A backup restore imports watched first;
        # this refresh (coalesced after that one) is the one that sees ratings.
        if added:
            schedule_refresh(user.id)

    return bulk_import(
        request, model=RatingEntry, entry_serializer=BulkRatingEntrySerializer, build=build,
        after_create=after_create,
    )
