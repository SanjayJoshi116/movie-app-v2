from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import UserList, UserListItem

ITEM = {"mediaId": 550, "mediaType": "movie", "title": "Fight Club", "posterPath": None, "voteAverage": 8.4}


class ListCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lena", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _create(self, name="Favourites"):
        res = self.client.post("/api/lists/", {"name": name, "description": "d"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        return res.data

    def test_create_rename_delete(self):
        created = self._create()
        self.assertEqual((created["name"], created["items"]), ("Favourites", []))

        res = self.client.patch(f"/api/lists/{created['id']}/", {"name": "Best"}, format="json")
        self.assertEqual(res.data["name"], "Best")

        res = self.client.delete(f"/api/lists/{created['id']}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(UserList.objects.filter(pk=created["id"]).exists())

    def test_list_endpoint_is_paginated(self):
        self._create("A")
        res = self.client.get("/api/lists/")
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["name"], "A")

    def test_add_duplicate_remove_and_clear_items(self):
        list_id = self._create()["id"]
        url = f"/api/lists/{list_id}/items/"

        first = self.client.post(url, ITEM, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        again = self.client.post(url, ITEM, format="json")
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(UserListItem.objects.filter(user_list_id=list_id).count(), 1)

        res = self.client.delete(f"{url}{first.data['id']}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(UserListItem.objects.filter(user_list_id=list_id).count(), 0)

        self.client.post(url, ITEM, format="json")
        self.client.post(url, {**ITEM, "mediaId": 13, "title": "Forrest Gump"}, format="json")
        res = self.client.delete(f"{url}clear/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(UserListItem.objects.filter(user_list_id=list_id).count(), 0)


class ListOwnershipTests(APITestCase):
    def setUp(self):
        owner = User.objects.create_user(username="owner", password="Xk9#mQ2vTz8p")
        self.list = UserList.objects.create(user=owner, name="Private")
        self.item = UserListItem.objects.create(
            user_list=self.list, media_id=550, media_type="movie", title="Fight Club"
        )
        intruder = User.objects.create_user(username="intruder", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=intruder)

    def test_other_users_list_is_404_everywhere(self):
        base = f"/api/lists/{self.list.pk}"
        calls = [
            ("patch", f"{base}/", {"name": "Hijacked"}),
            ("delete", f"{base}/", None),
            ("post", f"{base}/items/", ITEM),
            ("delete", f"{base}/items/clear/", None),
            ("delete", f"{base}/items/{self.item.pk}/", None),
        ]
        for method, url, body in calls:
            with self.subTest(method=method, url=url):
                res = getattr(self.client, method)(url, body, format="json")
                self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.list.refresh_from_db()
        self.assertEqual(self.list.name, "Private")
        self.assertTrue(UserListItem.objects.filter(pk=self.item.pk).exists())

    def test_other_users_lists_not_listed(self):
        self.assertEqual(self.client.get("/api/lists/").data["count"], 0)
