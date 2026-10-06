"""Shared implementation of the bulk import endpoints (watched, watchlist, ratings)."""

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from .serializers import BulkImportSerializer

MAX_BULK_ENTRIES = 500


def bulk_import(request, *, model, entry_serializer, build, after_create=None, max_entries=MAX_BULK_ENTRIES):
    """Validate a `{"entries": [...], "mediaType": ...}` body and create the
    entries that don't exist yet.

    - All-or-nothing: any malformed entry rejects the request with
      400 {"entries": {"<index>": errors}} before the DB is touched.
    - An entry with no mediaId is skipped (the CSV importers rely on this).
    - Create-only: (media_id, media_type) pairs the user already has are left
      untouched and counted as skipped.

    `build(user, media_type, validated_entry)` returns an unsaved instance.
    `after_create(user, added)` runs inside the transaction, so anything it
    defers with on_commit sees the new rows.
    """
    body = BulkImportSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    entries = body.validated_data["entries"]
    if not isinstance(entries, list):
        return Response({"detail": "entries must be a list."}, status=status.HTTP_400_BAD_REQUEST)
    if len(entries) > max_entries:
        return Response(
            {"detail": f"entries must not exceed {max_entries} items."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    default_type = body.validated_data["mediaType"]

    valid_items = []
    errors = {}
    for index, item in enumerate(entries):
        if not isinstance(item, dict):
            errors[str(index)] = ["Must be an object."]
            continue
        if item.get("mediaId") in (None, ""):
            continue
        entry = entry_serializer(data=item)
        if entry.is_valid():
            valid_items.append(entry.validated_data)
        else:
            errors[str(index)] = entry.errors
    if errors:
        return Response({"entries": errors}, status=status.HTTP_400_BAD_REQUEST)

    # De-duplicate on the validated (int id, type), so 5 and "5" are one title.
    unique = {}
    for item in valid_items:
        key = (item["mediaId"], item.get("mediaType") or default_type)
        unique.setdefault(key, item)

    user = request.user
    with transaction.atomic():
        # The pre-check runs inside the transaction so the counts reflect
        # everything committed before it. A concurrent single-item create can
        # still slip in between; ignore_conflicts keeps that safe.
        existing = set(
            model.objects.filter(user=user, media_id__in={mid for mid, _ in unique})
            .values_list("media_id", "media_type")
        )
        to_create = [
            build(user, media_type, item)
            for (media_id, media_type), item in unique.items()
            if (media_id, media_type) not in existing
        ]
        model.objects.bulk_create(to_create, ignore_conflicts=True)
        added = len(to_create)
        if after_create is not None:
            after_create(user, added)

    return Response({"added": added, "skipped": len(unique) - added}, status=status.HTTP_200_OK)


def timestamp_or_now(value):
    """A supplied (already validated) timestamp, or the model default."""
    return value if value is not None else timezone.now()
