from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import FollowedPerson, NotificationCheckpoint, WatchedEntry
from userdata.timezones import entry_day, local_today, request_tz, request_tz_name, valid_tz_name

KOLKATA = "Asia/Kolkata"
LONDON = "Europe/London"
NEW_YORK = "America/New_York"


def _request(tz=None):
    headers = {"HTTP_X_TIMEZONE": tz} if tz is not None else {}
    return RequestFactory().get("/", **headers)


class TimezoneHelperTests(SimpleTestCase):
    def test_valid_zone_is_used(self):
        self.assertEqual(request_tz_name(_request(KOLKATA)), KOLKATA)
        self.assertEqual(str(request_tz(_request(KOLKATA))), KOLKATA)

    def test_missing_unknown_overlong_and_malformed_fall_back_to_utc(self):
        for value in (None, "", "Mars/Olympus_Mons", "A" * 65, "../../etc/passwd", "Europe/../UTC"):
            with self.subTest(value=value):
                self.assertEqual(request_tz_name(_request(value)), "")
                self.assertEqual(str(request_tz(_request(value))), "UTC")

    def test_valid_tz_name_rejects_non_strings(self):
        self.assertEqual(valid_tz_name(None), "")
        self.assertEqual(valid_tz_name(42), "")

    def test_entry_day_prefers_logged_zone_then_request_zone(self):
        instant = datetime(2026, 10, 6, 19, 30, tzinfo=UTC)  # 01:00 on the 7th in Kolkata
        logged = SimpleNamespace(watched_at=instant, watched_tz=KOLKATA)
        legacy = SimpleNamespace(watched_at=instant, watched_tz="")
        self.assertEqual(str(entry_day(logged, _request(LONDON))), "2026-10-07")
        self.assertEqual(str(entry_day(legacy, _request(LONDON))), "2026-10-06")
        self.assertEqual(str(entry_day(legacy, _request(KOLKATA))), "2026-10-07")

    def test_local_today_follows_request_zone(self):
        fixed = datetime(2026, 10, 6, 19, 0, tzinfo=UTC)  # 00:30 on the 7th in Kolkata
        with patch("django.utils.timezone.now", return_value=fixed):
            self.assertEqual(str(local_today(_request(KOLKATA))), "2026-10-07")
            self.assertEqual(str(local_today(_request())), "2026-10-06")


class CorsAllowsTimezoneHeaderTests(APITestCase):
    def test_setting_lists_header(self):
        self.assertIn("x-timezone", settings.CORS_ALLOW_HEADERS)

    def test_preflight_allows_header(self):
        res = self.client.options(
            "/api/watched/",
            HTTP_ORIGIN="http://localhost:3000",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,content-type,x-timezone",
        )
        self.assertIn("x-timezone", res.headers.get("access-control-allow-headers", "").lower())


class WatchedZoneStorageTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tz", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _create(self, **headers):
        return self.client.post(
            "/api/watched/",
            {"mediaId": 550, "mediaType": "movie", "title": "Fight Club", "posterPath": None, "voteAverage": 8.4},
            format="json",
            **headers,
        )

    def test_create_stores_device_zone_and_returns_it(self):
        res = self._create(HTTP_X_TIMEZONE=KOLKATA)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["watchedTz"], KOLKATA)
        self.assertEqual(WatchedEntry.objects.get().watched_tz, KOLKATA)

    def test_create_with_bad_or_missing_zone_stores_blank(self):
        res = self._create(HTTP_X_TIMEZONE="Mars/Olympus_Mons")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WatchedEntry.objects.get().watched_tz, "")

    def test_bulk_import_keeps_row_zone_blanks_invalid_and_ignores_header(self):
        past = "2024-03-01T20:00:00Z"
        res = self.client.post(
            "/api/watched/bulk/",
            {"mediaType": "movie", "entries": [
                {"mediaId": 1, "title": "A", "watchedAt": past, "watchedTz": KOLKATA},
                {"mediaId": 2, "title": "B", "watchedAt": past, "watchedTz": "not-a-zone"},
                {"mediaId": 3, "title": "C", "watchedAt": past},
            ]},
            format="json",
            HTTP_X_TIMEZONE=LONDON,
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        zones = dict(WatchedEntry.objects.values_list("media_id", "watched_tz"))
        self.assertEqual(zones, {1: KOLKATA, 2: "", 3: ""})

    def test_bulk_import_overlong_zone_rejected(self):
        res = self.client.post(
            "/api/watched/bulk/",
            {"mediaType": "movie", "entries": [{"mediaId": 1, "title": "A", "watchedTz": "A" * 65}]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


@patch("userdata.stats_views.request_backfill")
@patch("userdata.stats_views._get_cached_genre_names", return_value={})
class StatsLocalDayTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="st", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        self.day = timezone.now().date() - timedelta(days=3)

    def _watch(self, media_id, at, tz):
        WatchedEntry.objects.create(
            user=self.user, media_id=media_id, media_type="movie", title=f"M{media_id}",
            watched_at=at, watched_tz=tz, genre_ids=[18], original_language="en", release_year=1999,
        )

    def _stats(self, tz=None):
        headers = {"HTTP_X_TIMEZONE": tz} if tz else {}
        return self.client.get("/api/stats/", **headers).data

    def test_kolkata_watch_after_midnight_stays_on_its_day_from_london(self, *_):
        at = datetime(self.day.year, self.day.month, self.day.day, 19, 30, tzinfo=UTC)
        self._watch(1, at, KOLKATA)
        expected = (self.day + timedelta(days=1)).isoformat()
        data = self._stats(LONDON)
        self.assertEqual([d["date"] for d in data["dailyActivity"]], [expected])
        self.assertEqual(data["recentItems"][0]["watchedAt"], expected)

    def test_legacy_entry_uses_viewing_device_day(self, *_):
        at = datetime(self.day.year, self.day.month, self.day.day, 23, 30, tzinfo=UTC)
        self._watch(1, at, "")
        next_day = (self.day + timedelta(days=1)).isoformat()
        self.assertEqual(self._stats(KOLKATA)["recentItems"][0]["watchedAt"], next_day)
        self.assertEqual(self._stats()["recentItems"][0]["watchedAt"], self.day.isoformat())

    def test_month_bucket_uses_logged_zone(self, *_):
        # 20:00 UTC on 31 Jan 2026 is 1 Feb in Kolkata.
        self._watch(1, datetime(2026, 1, 31, 20, 0, tzinfo=UTC), KOLKATA)
        months = [m["month"] for m in self._stats(LONDON)["monthlyActivity"]]
        self.assertEqual(months, ["Feb 2026"])


class NotificationsLocalDayTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="nt", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        FollowedPerson.objects.create(user=self.user, person_id=1, name="Some Actor")
        # Last check 23:00 on 6 Oct in New York (03:00 UTC on 7 Oct).
        NotificationCheckpoint.objects.create(user=self.user, last_seen_at=datetime(2026, 10, 7, 3, 0, tzinfo=UTC))

    @patch("userdata.tmdb_client._get")
    def test_release_on_next_local_day_is_unread(self, mock_get):
        mock_get.return_value = {"cast": [
            {"id": 9, "media_type": "movie", "title": "Premiere", "poster_path": None, "release_date": "2026-10-07"},
        ]}
        after_local_midnight = datetime(2026, 10, 7, 5, 0, tzinfo=UTC)  # 01:00 on 7 Oct in New York
        with patch("django.utils.timezone.now", return_value=after_local_midnight):
            ny = self.client.get("/api/notifications/new-releases/", HTTP_X_TIMEZONE=NEW_YORK).data
            utc = self.client.get("/api/notifications/new-releases/").data
        self.assertTrue(ny["items"][0]["isUnread"])
        self.assertEqual(ny["unreadCount"], 1)
        # The old server-clock behaviour: the check already happened "on the 7th".
        self.assertFalse(utc["items"][0]["isUnread"])
