"""Shared implementation of the bulk import endpoints (watched, watchlist,
ratings, list items, followed people, episode progress)."""

from django.db import connection, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from .serializers import BulkImportSerializer

MAX_BULK_ENTRIES = 500


def insert_ignoring_conflicts(model, objs):
    """Insert `objs`, skipping any that hit a unique constraint, and return how
    many rows were actually inserted.

    `bulk_create(ignore_conflicts=True)` can't say which rows it skipped, so a
    row another request created between the pre-check and the insert used to
    be counted as added. PostgreSQL only (the project's one database).
    """
    if not objs:
        return 0
    fields = [f for f in model._meta.concrete_fields if not f.primary_key]
    quote = connection.ops.quote_name
    columns = ", ".join(quote(f.column) for f in fields)
    row = "(" + ", ".join(["%s"] * len(fields)) + ")"
    params = [
        # pre_save applies auto_now and friends, as a normal save would.
        f.get_db_prep_save(f.pre_save(obj, add=True), connection)
        for obj in objs for f in fields
    ]
    sql = (
        f"INSERT INTO {quote(model._meta.db_table)} ({columns}) "
        f"VALUES {', '.join([row] * len(objs))} ON CONFLICT DO NOTHING RETURNING 1"
    )
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return len(cursor.fetchall())


def bulk_import(
    request, *, model, entry_serializer, build, after_create=None, max_entries=MAX_BULK_ENTRIES, scope=None,
    identity=None,
):
    """Validate a `{"entries": [...], "mediaType": ...}` body and create the
    entries that don't exist yet.

    - All-or-nothing: any malformed entry rejects the request with
      400 {"entries": {"<index>": errors}} before the DB is touched.
    - An entry with no mediaId is skipped (the CSV importers rely on this).
    - Create-only: (media_id, media_type) pairs the user already has are left
      untouched and counted as skipped.

    `build(user, media_type, validated_entry)` returns an unsaved instance.
    `identity=(entry_field, model_field)` keys entries on one id instead of
    (mediaId, mediaType), for models like followed people (`personId`) and
    episode progress (`showId`); `build` then gets `media_type=None`.
    `scope` is the filter that selects the rows an entry could collide with
    (default `{"user": request.user}`; list items pass `{"user_list": ...}`).
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
    id_field, model_id_field = identity or ("mediaId", "media_id")

    valid_items = []
    errors = {}
    for index, item in enumerate(entries):
        if not isinstance(item, dict):
            errors[str(index)] = ["Must be an object."]
            continue
        if item.get(id_field) in (None, ""):
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
        media_type = None if identity else (item.get("mediaType") or default_type)
        unique.setdefault((item[id_field], media_type), item)

    user = request.user
    with transaction.atomic():
        # The pre-check skips what's already there; a concurrent single-item
        # create can still slip in before the insert, which then skips it too
        # and counts only the rows it really inserted.
        owner = scope if scope is not None else {"user": user}
        ids = {entry_id for entry_id, _ in unique}
        rows = model.objects.filter(**owner, **{f"{model_id_field}__in": ids})
        if identity:
            existing = {(entry_id, None) for entry_id in rows.values_list(model_id_field, flat=True)}
        else:
            existing = set(rows.values_list("media_id", "media_type"))
        to_create = [
            build(user, media_type, item)
            for (entry_id, media_type), item in unique.items()
            if (entry_id, media_type) not in existing
        ]
        added = insert_ignoring_conflicts(model, to_create)
        if after_create is not None:
            after_create(user, added)

    return Response({"added": added, "skipped": len(unique) - added}, status=status.HTTP_200_OK)


def timestamp_or_now(value):
    """A supplied (already validated) timestamp, or the model default."""
    return value if value is not None else timezone.now()
