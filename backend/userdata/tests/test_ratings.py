from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from userdata.models import RatingEntry


class RatingsPaginationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="uma", password="Xk9#mQ2vTz8p")
        self.client.force_authenticate(user=self.user)
        RatingEntry.objects.bulk_create([
            RatingEntry(user=self.user, media_id=i, media_type="movie", title=f"Movie {i}", user_rating=7)
            for i in range(110)
        ])

    def test_paginated_response_shape(self):
        res = self.client.get("/api/ratings/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 110)
        self.assertEqual(len(res.data["results"]), 100)
        self.assertIsNotNone(res.data["next"])
