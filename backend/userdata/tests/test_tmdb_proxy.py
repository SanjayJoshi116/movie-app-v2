import re
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase
from urllib3.util.retry import Retry

from userdata import tmdb_proxy_views


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

    @patch("userdata.tmdb_proxy_views._session.get")
    def test_unresponsive_tmdb_returns_502_with_bounded_timeout(self, mock_get):
        mock_get.side_effect = requests.ReadTimeout("no response")

        res = self.client.get("/api/tmdb/movie/550")

        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(
            mock_get.call_args.kwargs["timeout"],
            (tmdb_proxy_views.CONNECT_TIMEOUT, tmdb_proxy_views.READ_TIMEOUT),
        )


class TmdbProxyTimeBudgetTests(SimpleTestCase):
    def test_worst_case_fits_under_gunicorn_timeout(self):
        entrypoint = (Path(__file__).resolve().parents[2] / "docker-entrypoint.sh").read_text()
        match = re.search(r"gunicorn .*--timeout (\d+)", entrypoint)
        self.assertIsNotNone(match, "docker-entrypoint.sh must set gunicorn --timeout explicitly")
        # 5s headroom for the view itself, JSON parsing, and the response write.
        self.assertLess(tmdb_proxy_views.WORST_CASE_SECONDS, int(match.group(1)) - 5)

    def test_session_uses_the_budgeted_retry(self):
        adapter = tmdb_proxy_views._session.get_adapter("https://api.themoviedb.org/3/movie/550")
        self.assertIs(adapter.max_retries, tmdb_proxy_views.RETRY)

    def test_old_configuration_would_have_exceeded_the_budget(self):
        old = tmdb_proxy_views._worst_case_seconds(Retry(total=4, connect=4, read=4, backoff_factor=0.5), 20, 20)
        self.assertGreater(old, 30)
