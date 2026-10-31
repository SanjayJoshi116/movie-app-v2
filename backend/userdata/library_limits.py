"""Per-user caps on library size (`library-limits` spec).

Rows stored before a cap existed stay readable and removable; only adds are
refused. The count runs under a transaction lock per user and collection, so
two adds racing at the edge can't both get in, and a long import into one
collection doesn't hold up adds to the others.
"""

from django.db import connection, transaction
from rest_framework.exceptions import APIException

# Collection -> (limit, the 400 message's template).
LIMITS = {
    "watched": (20_000, "Your watched history is limited to {:,} titles."),
    "watchlist": (20_000, "Your watchlist is limited to {:,} titles."),
    "ratings": (20_000, "Your ratings are limited to {:,} titles."),
    "lists": (200, "You can have at most {:,} lists."),
    "list_items": (2_000, "A list is limited to {:,} titles."),
}

# First key of the advisory lock (pg's two-int form, second key a hash of user
# and collection), distinct from the other *_LOCK_NAMESPACE values. A hash
# collision only adds a wait.
LIMIT_LOCK_NAMESPACE = 7312


class LimitReached(APIException):
    status_code = 400
    default_code = "limit_reached"


def room(collection, user_id, queryset):
    """How many more rows `queryset` (the collection's rows for this user or
    list) can take. Call inside transaction.atomic(): the lock it takes is held
    until that transaction ends, covering the insert that follows."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_advisory_xact_lock(%s, hashtext(%s))", [LIMIT_LOCK_NAMESPACE, f"{user_id}:{collection}"],
        )
    return max(0, LIMITS[collection][0] - queryset.count())


def check_room(collection, user_id, queryset):
    """Raise LimitReached (a 400 naming the limit) when the collection is full."""
    if room(collection, user_id, queryset) == 0:
        limit, message = LIMITS[collection]
        raise LimitReached(message.format(limit))


def get_or_create(collection, user_id, rows, identity, defaults):
    """`rows.get_or_create` under the collection's limit, in one transaction.
    A row that's already there comes back as is (a repeat add is never
    refused, and skips the lock and count); a new one needs room."""
    with transaction.atomic():
        entry = rows.filter(**identity).first()
        if entry is not None:
            return entry, False
        check_room(collection, user_id, rows)
        return rows.get_or_create(**identity, defaults=defaults)
