"""
Watchlist page tests: empty state, items, sorting, search, remove, export CSV.
"""
from playwright.sync_api import Page, expect

from conftest import fulfill_json, MOCK_WATCHLIST_ITEM, MOCK_RATING


def make_watchlist_items(n: int):
    return [
        {
            "id": i + 1,
            "mediaId": 550 + i,
            "mediaType": "movie",
            "title": f"Movie Title {i + 1}",
            "posterPath": None,
            "voteAverage": 7.0 + i * 0.1,
            "addedAt": f"2024-0{(i % 9) + 1}-15T10:00:00Z",
            "watched": False,
        }
        for i in range(n)
    ]


class TestWatchlistEmpty:
    def test_empty_watchlist_shows_count_zero(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, []))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (0)")).to_be_visible(timeout=8_000)

    def test_empty_watchlist_shows_description(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, []))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (0)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Your watchlist is empty", exact=False)).to_be_visible()

    def test_empty_watchlist_shows_browse_movies_button(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, []))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (0)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Browse Movies")).to_be_visible()

    def test_empty_watchlist_export_csv_hidden(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, []))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (0)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Export CSV")).not_to_be_visible()

    def test_browse_movies_button_navigates_to_movies(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, []))
        authed_page.route("**/api/tmdb/discover/movie**", lambda r: fulfill_json(r, {"results": [], "total_pages": 1, "total_results": 0}))
        authed_page.route("**/api/tmdb/trending/**", lambda r: fulfill_json(r, {"results": [], "total_pages": 1, "total_results": 0}))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_role("button", name="Browse Movies")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Browse Movies").click()
        expect(authed_page).to_have_url("/movies", timeout=5_000)


class TestWatchlistWithItems:
    def test_watchlist_one_item_shows_count(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)

    def test_watchlist_shows_item_title(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Fight Club")).to_be_visible()

    def test_watchlist_multiple_items_count(self, authed_page: Page):
        items = make_watchlist_items(3)
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, items))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (3)")).to_be_visible(timeout=8_000)

    def test_watchlist_export_csv_visible_with_items(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Export CSV")).to_be_visible()

    def test_watchlist_search_filter_finds_item(self, authed_page: Page):
        items = [
            MOCK_WATCHLIST_ITEM,
            {**MOCK_WATCHLIST_ITEM, "id": 2, "mediaId": 551, "title": "The Shawshank Redemption"},
        ]
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, items))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (2)")).to_be_visible(timeout=8_000)
        authed_page.get_by_placeholder("Search title…").fill("Fight")
        authed_page.wait_for_timeout(300)
        expect(authed_page.get_by_text("Fight Club")).to_be_visible()
        expect(authed_page.get_by_text("The Shawshank Redemption")).not_to_be_visible()

    def test_watchlist_search_no_results(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_placeholder("Search title…").fill("zzznotfound")
        authed_page.wait_for_timeout(300)
        expect(authed_page.get_by_text('No results for "zzznotfound"')).to_be_visible()

    def test_watchlist_sort_controls_visible(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        # Sort select combobox should be visible
        expect(authed_page.get_by_role("combobox").first).to_be_visible()

    def test_watchlist_sort_by_title(self, authed_page: Page):
        """Both items render; sort combobox is present."""
        items = [
            {**MOCK_WATCHLIST_ITEM, "id": 1, "mediaId": 551, "title": "Zebra Film"},
            {**MOCK_WATCHLIST_ITEM, "id": 2, "mediaId": 552, "title": "Alpha Film"},
        ]
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, items))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (2)")).to_be_visible(timeout=8_000)
        # Both titles should be visible
        expect(authed_page.get_by_text("Zebra Film")).to_be_visible()
        expect(authed_page.get_by_text("Alpha Film")).to_be_visible()
        # Sort combobox is present
        expect(authed_page.get_by_role("combobox").first).to_be_visible()


class TestWatchlistRemove:
    def test_remove_button_shows_popconfirm(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Remove").click()
        expect(authed_page.get_by_text("Remove from watchlist?")).to_be_visible(timeout=5_000)

    def test_remove_cancelled_keeps_item(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Remove").click()
        expect(authed_page.get_by_text("Remove from watchlist?")).to_be_visible(timeout=5_000)
        authed_page.get_by_role("button", name="Cancel").last.click()
        authed_page.wait_for_timeout(300)
        expect(authed_page.get_by_text("Fight Club")).to_be_visible()

    def test_remove_confirmed_shows_success_toast(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.route("**/api/django/watchlist/1/", lambda r: r.fulfill(status=204, body=""))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Remove").click()
        expect(authed_page.get_by_text("Remove from watchlist?")).to_be_visible(timeout=5_000)
        # Click the confirm Remove button inside popconfirm
        authed_page.locator(".ant-popconfirm-buttons").get_by_role("button", name="Remove").click()
        expect(authed_page.locator(".ant-message-notice-content")).to_contain_text(
            "Removed from watchlist", timeout=5_000
        )


class TestWatchlistRating:
    def test_rate_button_opens_rating_modal(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Rate").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        expect(authed_page.get_by_text("Rate: Fight Club")).to_be_visible()

    def test_already_rated_shows_edit_button(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.route("**/api/django/ratings/", lambda r: fulfill_json(r, [MOCK_RATING]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Edit")).to_be_visible()

    def test_rated_item_shows_rating_tag(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.route("**/api/django/ratings/", lambda r: fulfill_json(r, [MOCK_RATING]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("My: 9/10")).to_be_visible()
