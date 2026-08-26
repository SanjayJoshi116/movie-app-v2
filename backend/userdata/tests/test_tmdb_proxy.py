from unittest.mock import Mock, patch

import requests
from rest_framework import status
from rest_framework.test import APITestCase


class TmdbProxyTests(APITestCase):
    @patch("userdata.tmdb_proxy_views._session.get")
    def test_connection_failure_returns_clean_502(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("boom")

        res = self.client.get("/api/tmdb/movie/550")

        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(res.data, {"error": "TMDB request failed."})

    @patch("userdata.tmdb_proxy_views._session.get")
    def test_successful_request_is_passed_through(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {"id": 550, "title": "Fight Club"}
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        res = self.client.get("/api/tmdb/movie/550")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, {"id": 550, "title": "Fight Club"})
