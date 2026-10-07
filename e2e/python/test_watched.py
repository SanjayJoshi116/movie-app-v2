"""
Watched list page tests: empty state, items, sort, search, remove, clear all, pagination.
"""
from playwright.sync_api import Page, expect

from conftest import paginated, fulfill_json, MOCK_WATCHED_ITEM


def make_watched_items(n: int):
    return [
        {
            "id": i + 1,
            "mediaId": 550 + i,
            "mediaType": "movie" if i % 3 != 2 else "tv",
            "title": f"Watched Title {i + 1}",
            "posterPath": None,
            "voteAverage": 7.0 + i * 0.05,
            "watchedAt": f"2024-0{(i % 9) + 1}-{(i % 28) + 1:02d}T10:00:00Z",
        }
        for i in range(n)
    ]


class TestWatchedEmpty:
    def test_empty_watched_shows_count_zero(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (0)")).to_be_visible(timeout=8_000)

    def test_empty_watched_shows_description(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (0)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Nothing marked as watched yet", exact=False)).to_be_visible()

    def test_empty_watched_shows_browse_movies_button(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (0)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Browse Movies")).to_be_visible()

    def test_empty_watched_no_clear_all_button(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (0)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Clear All")).not_to_be_visible()


class TestWatchedWithItems:
    def test_watched_one_item_shows_count(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)

    def test_watched_shows_item_title(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Fight Club")).to_be_visible()

    def test_watched_shows_movie_and_tv_tags(self, authed_page: Page):
        items = [
            MOCK_WATCHED_ITEM,  # movie
            {**MOCK_WATCHED_ITEM, "id": 2, "mediaId": 551, "mediaType": "tv", "title": "Breaking Bad"},
        ]
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, items))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (2)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("1 movie")).to_be_visible()
        expect(authed_page.get_by_text("1 TV show")).to_be_visible()

    def test_watched_export_csv_visible(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Export CSV")).to_be_visible()

    def test_watched_sort_controls_visible(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("combobox").first).to_be_visible()
        expect(authed_page.get_by_placeholder("Search title…")).to_be_visible()

    def test_watched_search_filter_finds_item(self, authed_page: Page):
        items = [
            MOCK_WATCHED_ITEM,
            {**MOCK_WATCHED_ITEM, "id": 2, "mediaId": 551, "title": "The Shawshank Redemption"},
        ]
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, items))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (2)")).to_be_visible(timeout=8_000)
        authed_page.get_by_placeholder("Search title…").fill("Fight")
        authed_page.wait_for_timeout(300)
        expect(authed_page.get_by_text("Fight Club")).to_be_visible()
        expect(authed_page.get_by_text("The Shawshank Redemption")).not_to_be_visible()

    def test_watched_search_no_results_shows_empty_state(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_placeholder("Search title…").fill("zzznotfound")
        authed_page.wait_for_timeout(300)
        expect(authed_page.get_by_text('No results for "zzznotfound"')).to_be_visible()

    def test_watched_pagination_with_many_items(self, authed_page: Page):
        items = make_watched_items(50)
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, items))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (50)")).to_be_visible(timeout=8_000)
        # With pageSize=48, pagination should appear
        expect(authed_page.locator(".ant-pagination")).to_be_visible(timeout=5_000)


class TestWatchedClearAll:
    def test_clear_all_button_shows_popconfirm(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Clear All").click()
        expect(authed_page.get_by_text("Clear all watched?")).to_be_visible(timeout=5_000)

    def test_clear_all_cancelled_keeps_items(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Clear All").click()
        expect(authed_page.get_by_text("Clear all watched?")).to_be_visible(timeout=5_000)
        authed_page.get_by_role("button", name="Cancel").last.click()
        authed_page.wait_for_timeout(300)
        expect(authed_page.get_by_text("Fight Club")).to_be_visible()

    def test_clear_all_confirmed_shows_success_toast(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        authed_page.route("**/api/watched/clear/**", lambda r: r.fulfill(status=204, body=""))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Clear All").click()
        expect(authed_page.get_by_text("Clear all watched?")).to_be_visible(timeout=5_000)
        authed_page.locator(".ant-popconfirm-buttons").get_by_role("button", name="Clear All").click()
        expect(authed_page.locator(".ant-message-notice-content")).to_be_visible(timeout=5_000)

    def test_clear_all_network_error_shows_error_toast(self, authed_page: Page):
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        # No "detail" field: getApiError() (src/utils/apiError.ts) prefers data.detail
        # when present, so a body that has one would surface as that string instead of
        # exercising the component's own fallback message this test is checking for.
        authed_page.route("**/api/watched/clear/**", lambda r: r.fulfill(
            status=500, content_type="application/json", body='{}'
        ))
        authed_page.goto("/watched")
        expect(authed_page.get_by_text("Watched (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Clear All").click()
        expect(authed_page.get_by_text("Clear all watched?")).to_be_visible(timeout=5_000)
        authed_page.locator(".ant-popconfirm-buttons").get_by_role("button", name="Clear All").click()
        expect(authed_page.locator(".ant-message-notice-content")).to_contain_text(
            "Failed to clear watched list.", timeout=8_000
        )
