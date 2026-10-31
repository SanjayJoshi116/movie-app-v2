import logging
from contextlib import contextmanager

import requests
from django.db import DatabaseError, connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import library_limits
from .models import RatingEntry, TMDBProfile
from .pagination import DefaultPagination
from .bulk_import import bulk_import, timestamp_or_now
from .serializers import BulkRatingEntrySerializer, RatingEntrySerializer
from .signals import schedule_refresh
from . import tmdb_client

logger = logging.getLogger(__name__)

# First key of the per-title rating lock (pg's two-int form), distinct from the
# other advisory lock namespaces (recommendations 7311, library limits 7312).
RATING_LOCK_NAMESPACE = 7313


@contextmanager
def _rating_lock(user_id, media_type, media_id):
    """Serialize one user's writes to one title's rating, TMDB sync included.

    Session-level, not transaction-level: the local change must commit before
    the sync (a killed request never leaves TMDB with a score the app rolled
    back), yet the next write must wait until this one's sync is sent, or two
    syncs can reach TMDB in the wrong order. A dropped connection releases it.
    """
    key = [RATING_LOCK_NAMESPACE, f"{user_id}:{media_type}:{media_id}"]
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_lock(%s, hashtext(%s))", key)
    try:
        yield
    finally:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s, hashtext(%s))", key)
        except DatabaseError:
            # The connection broke, which already released the lock; raising
            # here would hide the error that broke it.
            pass


def _tmdb_session_id(user):
    """The user's TMDB session id, or "" when they never connected (not an error)."""
    try:
        return user.tmdb_profile.session_id
    except TMDBProfile.DoesNotExist:
        return ""


def _sync_to_tmdb(user, action, call):
    """Mirror a rating change to the user's connected TMDB account, if any,
    after the local change is saved. Best-effort and bounded: a TMDB failure,
    or TMDB not answering within TMDB_CALL_DEADLINE, is logged and never fails
    the local write. It runs in the request, not in the background, so changes
    reach TMDB in the order they were made: background syncs on different
    server processes could arrive out of order."""
    session_id = _tmdb_session_id(user)
    if not session_id:
        return
    try:
        tmdb_client.call_with_deadline(call, tmdb_client.TMDB_CALL_DEADLINE, session_id)
    except (requests.RequestException, ValueError) as e:
        # Type only: str(e) carries the request URL, session_id included.
        logger.warning("TMDB rating %s failed for user %s (%s)", action, user.pk, type(e).__name__)


def _sync_rating_to_tmdb(user, entry):
    media_type, media_id, value = entry.media_type, entry.media_id, entry.user_rating
    _sync_to_tmdb(user, "sync", lambda session_id: tmdb_client.post_rating(media_type, media_id, session_id, value))


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
    data = serializer.validated_data
    identity = {"media_id": data["media_id"], "media_type": data["media_type"]}
    rows = request.user.ratings  # a related manager: update_or_create sets user
    defaults = {
        "title": data["title"],
        "user_rating": data["user_rating"],
        # Creating and re-rating both count as "rated now".
        "rated_at": timezone.now(),
    }
    # A re-rate without a review keeps the stored one; a new rating starts empty.
    if "review" in data:
        defaults["review"] = data["review"]
    with _rating_lock(request.user.id, data["media_type"], data["media_id"]):
        with transaction.atomic():
            # The score before this request, to tell a re-rating from a review edit.
            old_rating = rows.filter(**identity).values_list("user_rating", flat=True).first()
            if old_rating is None:
                library_limits.check_room("ratings", request.user.id, rows)
            entry, created = rows.update_or_create(
                **identity, defaults=defaults, create_defaults={"review": "", **defaults},
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
    found = get_object_or_404(RatingEntry, pk=pk, user=request.user)
    with _rating_lock(request.user.id, found.media_type, found.media_id):
        # Re-read under the lock: a write that held it may have changed the row.
        entry = get_object_or_404(RatingEntry, pk=pk, user=request.user)
        if request.method == "DELETE":
            return _delete_rating(request, entry)
        return _patch_rating(request, entry)


def _delete_rating(request, entry):
    media_type, media_id = entry.media_type, entry.media_id
    # Locally first: a TMDB failure (or a killed worker) never keeps the row.
    entry.delete()
    _sync_to_tmdb(request.user, "delete",
                  lambda session_id: tmdb_client.delete_rating(media_type, media_id, session_id))
    schedule_refresh(request.user.id)
    return Response(status=status.HTTP_204_NO_CONTENT)


def _patch_rating(request, entry):
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
        after_create=after_create, limit="ratings",
    )
