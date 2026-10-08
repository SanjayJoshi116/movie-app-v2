import itertools
from datetime import timedelta
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from userdata.models import FollowedPerson, UserList, UserListItem, WatchedEntry
from userdata.recommendations import _add_or_merge_section, _compute_for_you


def _items(*ids, type_="movie"):
    return [{"id": i, "type": type_, "title": str(i), "posterPath": None, "voteAverage": 7} for i in ids]


class SectionKeyTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="keys", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    @patch("userdata.recommendations._fetch_media_details", return_value=None)
    @patch("userdata.recommendations.tmdb_client.get_genre_names", return_value={})
    @patch("userdata.recommendations.tmdb_client._get")
    def test_because_keys_include_media_type(self, mock_get, _names, _cached):
        WatchedEntry.objects.create(user=self.user, media_id=1399, media_type="movie", title="A Movie")
        WatchedEntry.objects.create(user=self.user, media_id=1399, media_type="tv", title="A Show")
        ids = itertools.count(10_000)
        mock_get.side_effect = lambda path, *a, **k: {
            "results": [{"id": next(ids), "title": "x", "vote_average": 7, "media_type": "movie"} for _ in range(3)]
        }

        keys = [s["key"] for s in _compute_for_you(self.user)]

        self.assertIn("because-movie-1399", keys)
        self.assertIn("because-tv-1399", keys)
        self.assertEqual(len(keys), len(set(keys)))

    @patch("userdata.tmdb_client._get")
    def test_same_name_followed_people_get_distinct_keys(self, mock_get):
        FollowedPerson.objects.create(user=self.user, person_id=1, name="Chris Evans")
        FollowedPerson.objects.create(user=self.user, person_id=2, name="Chris Evans")
        mock_get.side_effect = lambda path, *a, **k: {"cast": [
            {"id": 100 + int(path.split("/")[2]), "media_type": "movie", "title": "t", "vote_average": 8}
        ]}

        res = self.client.get("/api/recommendations/followed-people/")

        self.assertEqual(sorted(s["key"] for s in res.data), ["follow-1", "follow-2"])

    def test_duplicate_cluster_labels_merge(self):
        sections = []
        drama = "Your Taste: Drama & Crime"
        _add_or_merge_section(sections, {"key": "cluster-0", "label": drama, "items": _items(1, 2)})
        _add_or_merge_section(sections, {"key": "cluster-1", "label": drama, "items": _items(2, 3)})
        _add_or_merge_section(sections, {"key": "cluster-2", "label": "Your Taste: Comedy", "items": _items(4)})

        self.assertEqual([s["label"] for s in sections], ["Your Taste: Drama & Crime", "Your Taste: Comedy"])
        self.assertEqual([i["id"] for i in sections[0]["items"]], [1, 2, 3])


class ListItemOrderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lists", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        self.list = UserList.objects.create(user=self.user, name="L")
        now = timezone.now()
        for media_id, days_ago in [(1, 2), (2, 0), (3, 1)]:
            item = UserListItem.objects.create(
                user_list=self.list, media_id=media_id, media_type="movie", title=str(media_id)
            )
            UserListItem.objects.filter(pk=item.pk).update(added_at=now - timedelta(days=days_ago))
        # Two items sharing one timestamp: higher id first.
        same = now - timedelta(days=5)
        for media_id in (4, 5):
            item = UserListItem.objects.create(
                user_list=self.list, media_id=media_id, media_type="movie", title=str(media_id)
            )
            UserListItem.objects.filter(pk=item.pk).update(added_at=same)

    def _ids(self, data):
        return [i["mediaId"] for i in data["items"]]

    def test_list_endpoint_orders_newest_first_with_id_tiebreak(self):
        res = self.client.get("/api/lists/")
        self.assertEqual(self._ids(res.data["results"][0]), [2, 3, 1, 5, 4])

    def test_patch_response_uses_the_same_order(self):
        res = self.client.patch(f"/api/lists/{self.list.pk}/", {"name": "Renamed"}, format="json")
        self.assertEqual(self._ids(res.data), [2, 3, 1, 5, 4])


class TmdbProxyParamTests(APITestCase):
    @patch("userdata.tmdb_proxy_views._session.get")
    def test_repeated_params_kept_and_client_key_dropped(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=Mock(return_value={}))

        self.client.get("/api/tmdb/discover/movie?with_genres=28&with_genres=12&api_key=abc&page=2")

        params = mock_get.call_args.kwargs["params"]
        self.assertEqual([v for k, v in params if k == "with_genres"], ["28", "12"])
        keys = [v for k, v in params if k == "api_key"]
        self.assertEqual(len(keys), 1)
        self.assertNotEqual(keys[0], "abc")
        self.assertIn(("page", "2"), params)
