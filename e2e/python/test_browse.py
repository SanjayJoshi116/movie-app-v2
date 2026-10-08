"""
Browse tests: movies page, TV page, anime page, sidebar navigation, theme toggle.
"""
import re

from playwright.sync_api import Page, expect

from conftest import (
    fulfill_json, MOCK_MOVIE_RESPONSE, MOCK_TV_RESPONSE, EMPTY_RESPONSE,
    mock_tmdb_movies, mock_tmdb_tv, mock_movie_detail_routes,
    MOCK_MOVIE_DETAIL,
)
# Note: authed_page is a pytest fixture defined in conftest.py — auto-discovered, not imported.


class TestMoviesPage:
    def test_movies_page_renders_cards(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        # Wait for cards to appear
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("article")).to_have_count(6)

    def test_movies_page_category_buttons_visible(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("button", name="Discover")).to_be_visible()
        expect(authed_page.get_by_role("button", name="Now Playing")).to_be_visible()
        expect(authed_page.get_by_role("button", name="Top Rated")).to_be_visible()
        expect(authed_page.get_by_role("button", name="Popular")).to_be_visible()

    def test_movies_page_details_button_navigates(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        mock_movie_detail_routes(authed_page, 100, MOCK_MOVIE_DETAIL)
        authed_page.route("**/api/tmdb/movie/100/reviews**", lambda r: fulfill_json(r, {"results": [], "total_pages": 1}))
        authed_page.route("**/api/tmdb/movie/100/similar**", lambda r: fulfill_json(r, EMPTY_RESPONSE))
        authed_page.route("**/api/tmdb/movie/100/watch*", lambda r: fulfill_json(r, {"results": {}}))
        authed_page.route("**/api/tmdb/movie/100/release_dates**", lambda r: fulfill_json(r, {"results": []}))

        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        authed_page.locator("button").filter(has_text="Details").first.click()
        expect(authed_page).to_have_url("/movie/100", timeout=8_000)

    def test_movies_page_empty_tmdb_response_shows_no_cards(self, authed_page: Page):
        authed_page.route("**/api/tmdb/discover/movie**", lambda r: fulfill_json(r, EMPTY_RESPONSE))
        authed_page.route("**/api/tmdb/trending/**", lambda r: fulfill_json(r, EMPTY_RESPONSE))
        authed_page.goto("/movies")
        # The empty state only renders once loading has finished, so the count
        # below can't pass on the skeleton.
        expect(authed_page.get_by_text("No movies found.")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("article")).to_have_count(0)

    def test_movies_card_has_details_button(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        expect(authed_page.locator("button").filter(has_text="Details").first).to_be_visible()


class TestTVPage:
    def test_tv_page_renders_cards(self, authed_page: Page):
        mock_tmdb_tv(authed_page)
        authed_page.goto("/tv")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)

    def test_tv_page_category_buttons_visible(self, authed_page: Page):
        mock_tmdb_tv(authed_page)
        authed_page.goto("/tv")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("button", name="Popular")).to_be_visible()
        expect(authed_page.get_by_role("button", name="Top Rated")).to_be_visible()
        expect(authed_page.get_by_role("button", name="On The Air")).to_be_visible()
        expect(authed_page.get_by_role("button", name="Airing Today")).to_be_visible()


PRIMARY_BTN = re.compile(r"ant-btn-primary")


class TestBrowseFilters:
    def _open_filters(self, page: Page):
        page.get_by_role("button", name="Toggle filters").click()
        expect(page.get_by_role("group", name="Genre filters")).to_be_visible(timeout=5_000)

    def test_tv_filter_panel_shows_tv_genres(self, authed_page: Page):
        mock_tmdb_tv(authed_page)
        authed_page.goto("/tv")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        self._open_filters(authed_page)
        genres = authed_page.get_by_role("group", name="Genre filters")
        expect(genres.get_by_text("Action & Adventure", exact=True)).to_be_visible()
        expect(genres.get_by_text("Sci-Fi & Fantasy", exact=True)).to_be_visible()
        expect(genres.get_by_text("Thriller", exact=True)).to_have_count(0)

    def test_tv_genre_goes_to_tv_discover_with_tv_id(self, authed_page: Page):
        mock_tmdb_tv(authed_page)
        authed_page.goto("/tv")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        self._open_filters(authed_page)
        with authed_page.expect_request(
            lambda req: "/api/tmdb/discover/tv" in req.url and "with_genres=10759" in req.url
        ):
            authed_page.get_by_role("group", name="Genre filters").get_by_text("Action & Adventure", exact=True).click()

    def test_category_buttons_work_after_empty_apply(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        self._open_filters(authed_page)
        authed_page.get_by_role("button", name="Apply Filters").click()
        with authed_page.expect_request(lambda req: "/api/tmdb/movie/top_rated" in req.url):
            authed_page.get_by_role("button", name="Top Rated").click()

    def test_movie_runtime_filter_does_not_reach_tv(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        mock_tmdb_tv(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        self._open_filters(authed_page)
        authed_page.get_by_placeholder("e.g. 60").fill("90")
        authed_page.get_by_role("button", name="Apply Filters").click()
        with authed_page.expect_request(
            lambda req: "/api/tmdb/discover/tv" in req.url or "/api/tmdb/tv/" in req.url
        ) as tv_req:
            authed_page.get_by_role("menuitem", name="TV Shows").click()
        assert "with_runtime" not in tv_req.value.url, tv_req.value.url

    def test_browser_back_restores_category(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        mock_movie_detail_routes(authed_page, 100, MOCK_MOVIE_DETAIL)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        authed_page.get_by_role("button", name="Top Rated").click()
        expect(authed_page.get_by_role("button", name="Top Rated")).to_have_class(PRIMARY_BTN)
        authed_page.locator("button").filter(has_text="Details").first.click()
        expect(authed_page).to_have_url("/movie/100", timeout=8_000)
        authed_page.go_back()
        expect(authed_page).to_have_url("/movies")
        expect(authed_page.get_by_role("button", name="Top Rated")).to_have_class(PRIMARY_BTN, timeout=8_000)


class TestAnimePage:
    def test_anime_page_renders(self, authed_page: Page):
        authed_page.route("**/api/tmdb/discover/tv**", lambda r: fulfill_json(r, MOCK_TV_RESPONSE))
        authed_page.route("**/api/tmdb/discover/movie**", lambda r: fulfill_json(r, MOCK_MOVIE_RESPONSE))
        authed_page.goto("/anime")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)

    def test_anime_page_has_title(self, authed_page: Page):
        authed_page.route("**/api/tmdb/discover/tv**", lambda r: fulfill_json(r, MOCK_TV_RESPONSE))
        authed_page.goto("/anime")
        # "Anime" appears in sidebar menu item and radio buttons — match exact sidebar item
        expect(authed_page.get_by_role("menuitem", name="Anime")).to_be_visible(timeout=5_000)


class TestSidebar:
    def test_sidebar_shows_navigation_links(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        # Sidebar navigation items render as Ant Design menu items
        expect(authed_page.get_by_role("menuitem", name="Movies")).to_be_visible()
        expect(authed_page.get_by_role("menuitem", name="TV Shows")).to_be_visible()
        expect(authed_page.get_by_role("menuitem", name="Watchlist")).to_be_visible()
        expect(authed_page.get_by_role("menuitem", name="Watched")).to_be_visible()
        expect(authed_page.get_by_role("menuitem", name="Stats")).to_be_visible()

    def test_sidebar_shows_username(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_text("testuser")).to_be_visible()

    def test_theme_toggle_button_exists(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        # The theme toggle button has an aria-label
        toggle = authed_page.locator("[aria-label*='Switch to']").first
        expect(toggle).to_be_visible()

    def test_theme_toggle_changes_aria_label(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        toggle = authed_page.get_by_role("button", name="Switch to light mode")
        expect(authed_page.locator("body")).to_have_class(re.compile(r"dark-theme"))
        toggle.click()
        expect(authed_page.get_by_role("button", name="Switch to dark mode")).to_be_visible()
        expect(authed_page.locator("body")).not_to_have_class(re.compile(r"dark-theme"))
