from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import FollowedPerson


class FollowedPeopleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="fern", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)

    def _follow(self, person_id=287, name="Brad Pitt"):
        return self.client.post("/api/followed-people/", {"personId": person_id, "name": name}, format="json")

    def test_follow_then_refollow_is_idempotent(self):
        first = self._follow()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual((first.data["personId"], first.data["name"]), (287, "Brad Pitt"))
        again = self._follow()
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(FollowedPerson.objects.filter(user=self.user).count(), 1)

    def test_list_is_paginated_newest_first(self):
        self._follow(1, "First")
        self._follow(2, "Second")
        res = self.client.get("/api/followed-people/")
        self.assertEqual(res.data["count"], 2)
        self.assertEqual([p["personId"] for p in res.data["results"]], [2, 1])

    def test_unfollow_and_unfollow_missing(self):
        self._follow()
        res = self.client.delete("/api/followed-people/287/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(FollowedPerson.objects.filter(user=self.user).exists())
        res = self.client.delete("/api/followed-people/287/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_unfollow_never_touches_another_users_follow(self):
        other = User.objects.create_user(username="other", password="Xk9#mQ2vTz8p")
        FollowedPerson.objects.create(user=other, person_id=287, name="Brad Pitt")
        self.client.delete("/api/followed-people/287/")
        self.assertTrue(FollowedPerson.objects.filter(user=other).exists())
