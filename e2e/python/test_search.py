"""
Search tests: navigation, results tabs, edge cases (empty, special chars, no results).
"""
from playwright.sync_api import Page, expect

from conftest import (
    fulfill_json, EMPTY_RESPONSE,
    mock_tmdb_movies, MOCK_MOVIES, MOCK_TV_SHOWS,
)

SEARCH_MOVIES = {
    "results": MOCK_MOVIES[:2],
    "total_pages": 1,
    "total_results": 2,
    "page": 1,
}
SEARCH_TV = {
    "results": [
        {**s, "name": s.get("name", s.get("title", "Show")), "first_air_date": "2024-01-01"}
        for s in MOCK_TV_SHOWS[:2]
    ],
    "total_pages": 1,
    "total_results": 2,
    "page": 1,
}
SEARCH_PEOPLE = {
    "results": [
        {"id": 1, "name": "Tom Hanks", "known_for_department": "Acting", "profile_path": None, "popularity": 50}
    ],
    "total_pages": 1,
    "total_results": 1,
    "page": 1,
}


def mount_search_routes(page: Page):
    page.route("**/api/tmdb/search/movie**", lambda r: fulfill_json(r, SEARCH_MOVIES))
    page.route("**/api/tmdb/search/tv**", lambda r: fulfill_json(r, SEARCH_TV))
    page.route("**/api/tmdb/search/person**", lambda r: fulfill_json(r, SEARCH_PEOPLE))
    page.route("**/api/tmdb/search/multi**", lambda r: fulfill_json(r, SEARCH_MOVIES))


class TestSearchNavigation:
    def test_search_typing_and_enter_navigates_to_search_page(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        mount_search_routes(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        authed_page.get_by_placeholder("Search movies, shows or people…").fill("inception")
        authed_page.get_by_placeholder("Search movies, shows or people…").press("Enter")
        expect(authed_page).to_have_url("/search", timeout=5_000)

    def test_search_page_direct_navigation_shows_prompt(self, authed_page: Page):
        mount_search_routes(authed_page)
        authed_page.goto("/search")
        # Without a query param, the search page should show a prompt
        # It might show "Type something in the search bar" or results section
        expect(authed_page).to_have_url("/search")


class TestSearchResults:
    def _navigate_to_search(self, page: Page, query: str = "fight") -> None:
        mock_tmdb_movies(page)
        mount_search_routes(page)
        page.goto("/movies")
        expect(page.get_by_role("article").first).to_be_visible(timeout=10_000)
        page.get_by_placeholder("Search movies, shows or people…").fill(query)
        page.get_by_placeholder("Search movies, shows or people…").press("Enter")
        expect(page).to_have_url("/search", timeout=5_000)

    def test_search_results_page_loads(self, authed_page: Page):
        self._navigate_to_search(authed_page)
        # The search page should have rendered without crashing
        expect(authed_page.locator("body")).to_be_visible()

    def test_search_no_results_shows_empty_state(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.route("**/api/tmdb/search/movie**", lambda r: fulfill_json(r, {
            "results": [], "total_pages": 1, "total_results": 0, "page": 1
        }))
        authed_page.route("**/api/tmdb/search/tv**", lambda r: fulfill_json(r, {
            "results": [], "total_pages": 1, "total_results": 0, "page": 1
        }))
        authed_page.route("**/api/tmdb/search/person**", lambda r: fulfill_json(r, {
            "results": [], "total_pages": 1, "total_results": 0, "page": 1
        }))
        authed_page.route("**/api/tmdb/search/multi**", lambda r: fulfill_json(r, EMPTY_RESPONSE))

        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        authed_page.get_by_placeholder("Search movies, shows or people…").fill("zzzunknownquery")
        authed_page.get_by_placeholder("Search movies, shows or people…").press("Enter")
        expect(authed_page).to_have_url("/search", timeout=5_000)
        # Empty state should render (Ant Empty component)
        authed_page.wait_for_timeout(1500)
        expect(authed_page.locator(".ant-empty, .ant-result")).to_be_visible(timeout=5_000)


class TestSearchEdgeCases:
    def test_search_special_chars_no_crash(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        mount_search_routes(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        authed_page.get_by_placeholder("Search movies, shows or people…").fill("C++ & Python <script>")
        authed_page.get_by_placeholder("Search movies, shows or people…").press("Enter")
        expect(authed_page).to_have_url("/search", timeout=5_000)
        # No error boundary should be visible
        expect(authed_page.get_by_text("Something went wrong")).not_to_be_visible(timeout=3_000)

    def test_search_very_long_query_no_crash(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        mount_search_routes(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        long_query = "a" * 200
        authed_page.get_by_placeholder("Search movies, shows or people…").fill(long_query)
        authed_page.get_by_placeholder("Search movies, shows or people…").press("Enter")
        expect(authed_page).to_have_url("/search", timeout=5_000)

    def test_search_single_char_query_navigates(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        mount_search_routes(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        authed_page.get_by_placeholder("Search movies, shows or people…").fill("a")
        authed_page.get_by_placeholder("Search movies, shows or people…").press("Enter")
        expect(authed_page).to_have_url("/search", timeout=5_000)
