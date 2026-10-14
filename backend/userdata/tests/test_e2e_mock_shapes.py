"""The Python e2e suite's mock records must look like what the API sends.

Mocks drifted before (createdAt instead of ratedAt, a removed `watched` flag,
"2024-01" months that made the stats page render NaN) and every e2e test
still passed. The e2e conftest imports playwright, which this job doesn't
install, so its MOCK_* dict literals are read with ast instead of imported.
"""
import ast
import re
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from userdata.models import RatingEntry, UserList, UserListItem, WatchedEntry, WatchlistEntry
from userdata.serializers import (
    RatingEntrySerializer,
    UserListItemSerializer,
    UserListSerializer,
    UserSerializer,
    WatchedEntrySerializer,
    WatchlistEntrySerializer,
)

REPO = Path(__file__).resolve().parents[3]
CONFTEST = REPO / "e2e" / "python" / "conftest.py"
# The TS e2e mocks `satisfies` these types, so they must match the API too.
DOMAIN_TS = REPO / "src" / "types" / "domain.ts"

TS_TYPE_SERIALIZERS = {
    "AuthUser": UserSerializer,
    "WatchlistEntryDTO": WatchlistEntrySerializer,
    "WatchedEntryDTO": WatchedEntrySerializer,
    "RatingEntryDTO": RatingEntrySerializer,
    "UserListItemDTO": UserListItemSerializer,
    "UserListDTO": UserListSerializer,
}

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


def _ts_interfaces():
    """{interface name: field names} for the top-level interfaces in domain.ts.
    Field lines are `name: type;` or `name?: type;` (optional still counts)."""
    text = DOMAIN_TS.read_text(encoding="utf-8")
    found = {}
    for match in re.finditer(r"^export interface (\w+) \{\r?\n(.*?)^\}", text, re.M | re.S):
        found[match.group(1)] = set(re.findall(r"^\s+(\w+)\??\s*:", match.group(2), re.M))
    return found


class TSApiTypeTests(APITestCase):
    """The TS e2e mocks are checked against these types by `satisfies`; this
    keeps the types themselves equal to what the serializers send."""

    def test_api_types_have_the_serializer_fields(self):
        interfaces = _ts_interfaces()
        for name, serializer in TS_TYPE_SERIALIZERS.items():
            with self.subTest(type=name):
                self.assertIn(name, interfaces, f"{name} not found in {DOMAIN_TS.name}")
                expected = set(serializer.Meta.fields)
                actual = interfaces[name]
                self.assertEqual(
                    actual, expected,
                    f"{name}: missing {sorted(expected - actual)}, extra {sorted(actual - expected)}",
                )


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
