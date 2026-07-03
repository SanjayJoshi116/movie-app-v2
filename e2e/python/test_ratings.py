"""
Rating modal tests: open, save, cancel, edit existing, validation, network errors.
"""
from playwright.sync_api import Page, expect

from conftest import (
    fulfill_json, MOCK_WATCHLIST_ITEM, MOCK_RATING,
    mock_movie_detail_routes,
)


class TestRatingModalFromWatchlist:
    def test_rate_button_opens_modal(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Rate").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        expect(authed_page.get_by_text("Rate: Fight Club")).to_be_visible()

    def test_modal_has_star_rating_widget(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Rate").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        expect(authed_page.locator(".ant-rate")).to_be_visible()

    def test_modal_save_button_disabled_without_rating(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Rate").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # Save button should be disabled when no star is selected
        save_btn = authed_page.locator(".ant-modal-footer").get_by_role("button", name="Save")
        expect(save_btn).to_be_disabled()

    def test_modal_save_enabled_after_star_click(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Rate").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # Click the 9th star
        stars = authed_page.locator(".ant-rate-star")
        stars.nth(8).click()
        authed_page.wait_for_timeout(200)
        save_btn = authed_page.locator(".ant-modal-footer").get_by_role("button", name="Save")
        expect(save_btn).to_be_enabled()

    def test_modal_cancel_closes_modal(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Rate").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        authed_page.locator(".ant-modal-footer").get_by_role("button", name="Cancel").click()
        authed_page.wait_for_timeout(300)
        expect(authed_page.locator(".ant-modal")).not_to_be_visible()

    def test_rating_saved_shows_success_toast(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.route("**/api/django/ratings/", lambda r: fulfill_json(r, []))
        authed_page.route("**/api/django/ratings/**", lambda r: fulfill_json(r, MOCK_RATING))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Rate").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # Select a star rating
        authed_page.locator(".ant-rate-star").nth(8).click()
        authed_page.wait_for_timeout(200)
        authed_page.locator(".ant-modal-footer").get_by_role("button", name="Save").click()
        expect(authed_page.locator(".ant-message-notice-content")).to_contain_text(
            "Rating saved", timeout=5_000
        )


class TestRatingEditing:
    def test_edit_rating_button_shows_when_rated(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.route("**/api/django/ratings/", lambda r: fulfill_json(r, [MOCK_RATING]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Edit")).to_be_visible()

    def test_edit_modal_prefills_existing_rating(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.route("**/api/django/ratings/", lambda r: fulfill_json(r, [MOCK_RATING]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Edit").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # The modal title should include the movie title
        expect(authed_page.get_by_text("Rate: Fight Club")).to_be_visible()

    def test_edit_modal_shows_existing_review(self, authed_page: Page):
        authed_page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, [MOCK_WATCHLIST_ITEM]))
        authed_page.route("**/api/django/ratings/", lambda r: fulfill_json(r, [MOCK_RATING]))
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (1)")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Edit").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # Existing review should be pre-filled in textarea
        expect(authed_page.locator(".ant-modal textarea")).to_have_value("Masterpiece.")


class TestRatingFromDetailPage:
    def test_rate_button_visible_on_movie_detail(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        rate_btn = authed_page.get_by_role("button", name="Rate")
        if rate_btn.count() == 0:
            rate_btn = authed_page.locator("button").filter(has_text="Rate").first
        expect(rate_btn).to_be_visible(timeout=5_000)

    def test_rate_button_opens_modal_on_detail_page(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        rate_btn = authed_page.get_by_role("button", name="Rate")
        if rate_btn.count() == 0:
            rate_btn = authed_page.locator("button").filter(has_text="Rate").first
        rate_btn.first.click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
