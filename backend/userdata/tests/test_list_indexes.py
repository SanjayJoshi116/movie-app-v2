"""fix-db-layer: every library list endpoint has a per-user index in its own
order. The indexes live in Meta.indexes, so makemigrations can't drop them
again the way 0009 dropped 0008's migration-only ones."""
import re
from pathlib import Path

import pytest

from userdata.models import EpisodeProgress, FollowedPerson, RatingEntry, UserList, WatchedEntry, WatchlistEntry

USERDATA = Path(__file__).resolve().parents[1]

# model -> (view file, the ordering its list query uses)
LIST_QUERIES = [
    (WatchedEntry, "watched_views.py", ["-watched_at", "-id"]),
    (WatchlistEntry, "watchlist_views.py", ["-added_at", "-id"]),
    (RatingEntry, "ratings_views.py", ["-rated_at", "-id"]),
    (FollowedPerson, "social_views.py", ["-followed_at", "-id"]),
    (EpisodeProgress, "social_views.py", ["-updated_at", "-id"]),
    (UserList, "lists_views.py", ["-created_at", "-id"]),
]


@pytest.mark.parametrize("model,view,ordering", LIST_QUERIES, ids=lambda v: getattr(v, "__name__", None))
def test_list_query_has_matching_index(model, view, ordering):
    source = (USERDATA / view).read_text(encoding="utf-8")
    call = "order_by(" + ", ".join(f'"{f}"' for f in ordering) + ")"
    assert re.search(rf"{model.__name__}\.objects\.filter\(user=[^)]*\)[^\n]*{re.escape(call)}", source), (
        f"{view} no longer lists {model.__name__} with {call}; update its index too"
    )
    fields = [list(index.fields) for index in model._meta.indexes]
    assert ["user", *ordering] in fields
