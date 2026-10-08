"""The Python e2e suite's mock records must look like what the API sends.

Mocks drifted before (createdAt instead of ratedAt, a removed `watched` flag,
"2024-01" months that made the stats page render NaN) and every e2e test
still passed. The e2e conftest imports playwright, which this job doesn't
install, so its MOCK_* dict literals are read with ast instead of imported.
"""
import ast
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from userdata.models import RatingEntry, UserList, UserListItem, WatchedEntry, WatchlistEntry
from userdata.serializers import (
    RatingEntrySerializer,
    UserListSerializer,
    UserSerializer,
    WatchedEntrySerializer,
    WatchlistEntrySerializer,
)

CONFTEST = Path(__file__).resolve().parents[3] / "e2e" / "python" / "conftest.py"

RECORD_SERIALIZERS = {
    "MOCK_USER": UserSerializer,
    "MOCK_WATCHLIST_ITEM": WatchlistEntrySerializer,
    "MOCK_WATCHED_ITEM": WatchedEntrySerializer,
    "MOCK_RATING": RatingEntrySerializer,
    "MOCK_LIST": UserListSerializer,
}


def _mocks():
    """Top-level `MOCK_X = {...}` assignments, evaluated as literals."""
    tree = ast.parse(CONFTEST.read_text(encoding="utf-8"))
    found = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in RECORD_SERIALIZERS or name == "MOCK_STATS":
                try:
                    found[name] = ast.literal_eval(node.value)
                except ValueError as e:
                    raise AssertionError(f"{name} in {CONFTEST.name} must stay a plain literal: {e}") from None
    return found


class E2EMockShapeTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.mocks = _mocks()

    def test_every_checked_mock_is_present(self):
        self.assertEqual(set(self.mocks), set(RECORD_SERIALIZERS) | {"MOCK_STATS"})

    def test_record_mocks_have_the_serializer_fields(self):
        for name, serializer in RECORD_SERIALIZERS.items():
            with self.subTest(mock=name):
                expected = set(serializer.Meta.fields)
                actual = set(self.mocks[name])
                self.assertEqual(
                    actual, expected,
                    f"{name}: missing {sorted(expected - actual)}, extra {sorted(actual - expected)}",
                )

    @patch("userdata.stats_views.request_backfill")
    @patch("userdata.stats_views._get_cached_genre_names", return_value={18: "Drama"})
    def test_stats_mock_matches_a_real_stats_response(self, _names, _backfill):
        user = User.objects.create_user(username="shape", password="x")
        common = {"user": user, "media_id": 550, "media_type": "movie", "title": "Fight Club"}
        WatchedEntry.objects.create(
            **common, genre_ids=[18], original_language="en", release_year=1999,
            runtime_minutes=139, platform="Netflix",
        )
        RatingEntry.objects.create(**common, user_rating=9, review="Masterpiece.")
        WatchlistEntry.objects.create(**{**common, "media_id": 551})
        lst = UserList.objects.create(user=user, name="Favorites")
        UserListItem.objects.create(user_list=lst, media_id=550, media_type="movie", title="Fight Club")
        self.client.force_authenticate(user)
        real = self.client.get("/api/stats/").data
        mock = self.mocks["MOCK_STATS"]

        self.assertEqual(
            set(mock), set(real),
            f"MOCK_STATS: missing {sorted(set(real) - set(mock))}, extra {sorted(set(mock) - set(real))}",
        )
        # Nested rows: compare one row's keys wherever both sides have rows.
        for key, value in real.items():
            if isinstance(value, list) and value and mock[key]:
                with self.subTest(stats_key=key):
                    self.assertEqual(set(mock[key][0]), set(value[0]))
        # Month labels in the API's own format ("%b %Y"), which StatsPage parses.
        for row in real["monthlyActivity"] + mock["monthlyActivity"]:
            datetime.strptime(row["month"], "%b %Y")
