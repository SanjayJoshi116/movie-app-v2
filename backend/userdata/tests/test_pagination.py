from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from userdata.models import WatchedEntry


class LibraryPageSizeTests(APITestCase):
    """Library lists accept a client page size up to 500 (page-performance spec)."""

    def setUp(self):
        self.user = User.objects.create_user(username="pager", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        WatchedEntry.objects.bulk_create(
            WatchedEntry(user=self.user, media_id=i, media_type="movie", title=f"T{i}") for i in range(1, 601)
        )

    def _page(self, query):
        res = self.client.get(f"/api/watched/{query}")
        self.assertEqual(res.status_code, 200)
        return res.data

    def test_default_page_size_is_unchanged(self):
        data = self._page("?page=1")
        self.assertEqual(len(data["results"]), 100)
        self.assertEqual(data["count"], 600)

    def test_client_can_ask_for_500(self):
        first = self._page("?page=1&page_size=500")
        second = self._page("?page=2&page_size=500")
        self.assertEqual((len(first["results"]), len(second["results"])), (500, 100))
        self.assertEqual(first["next"], 2)
        self.assertIsNone(second["next"])
        ids = [e["mediaId"] for e in first["results"] + second["results"]]
        self.assertEqual(sorted(ids), list(range(1, 601)))

    def test_page_size_above_500_is_capped(self):
        self.assertEqual(len(self._page("?page=1&page_size=10000")["results"]), 500)
