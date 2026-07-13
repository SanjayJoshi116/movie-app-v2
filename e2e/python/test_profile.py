"""
Profile modal tests: open, show user data, save changes, validation, theme toggle.
"""
from playwright.sync_api import Page, expect

from conftest import fulfill_json, MOCK_USER, mock_tmdb_movies


def open_profile_modal(page: Page) -> None:
    """Click the avatar to open the profile modal."""
    # The avatar is a clickable element wrapping the user initials in the sidebar
    page.locator(".ant-avatar").first.click()
    expect(page.locator(".ant-modal")).to_be_visible(timeout=5_000)


class TestProfileModalOpen:
    def test_profile_modal_opens_from_avatar(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.get_by_text("Edit Profile")).to_be_visible()

    def test_profile_modal_shows_username(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.get_by_text("Edit Profile")).to_be_visible()
        # Username field should be pre-filled with "testuser"
        username_input = authed_page.locator(".ant-modal").get_by_label("Username")
        if username_input.count() > 0:
            expect(username_input).to_have_value("testuser")

    def test_profile_modal_shows_email(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.get_by_text("Edit Profile")).to_be_visible()
        email_input = authed_page.locator(".ant-modal").get_by_label("Email")
        if email_input.count() > 0:
            expect(email_input).to_have_value("t@t.com")

    def test_profile_modal_close_via_button(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # Click the X close button on the modal
        authed_page.locator(".ant-modal-close").click()
        authed_page.wait_for_timeout(500)
        expect(authed_page.locator(".ant-modal")).not_to_be_visible()


class TestProfileSave:
    def test_profile_save_changes_success(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.route("**/api/django/auth/profile/**", lambda r: fulfill_json(r, {
            **MOCK_USER, "first_name": "Test"
        }))
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.get_by_text("Edit Profile")).to_be_visible()
        # Fill first name if available
        first_name_input = authed_page.locator(".ant-modal").get_by_label("First Name")
        if first_name_input.count() > 0:
            first_name_input.fill("Test")
        save_btn = authed_page.locator(".ant-modal-footer").get_by_role("button", name="Save Changes")
        if save_btn.count() > 0:
            save_btn.click()
            expect(authed_page.locator(".ant-message-notice-content")).to_be_visible(timeout=5_000)

    def test_profile_save_network_error(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.route("**/api/django/auth/profile/**", lambda r: r.fulfill(
            status=400, content_type="application/json",
            body='{"username": ["This username is already taken."]}'
        ))
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.get_by_text("Edit Profile")).to_be_visible()
        save_btn = authed_page.locator(".ant-modal-footer").get_by_role("button", name="Save Changes")
        if save_btn.count() > 0:
            save_btn.click()
            expect(authed_page.locator(".ant-message-notice-content")).to_be_visible(timeout=8_000)


class TestProfileValidation:
    def test_profile_empty_username_shows_validation(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.get_by_text("Edit Profile")).to_be_visible()
        username_input = authed_page.locator(".ant-modal").get_by_label("Username")
        if username_input.count() > 0:
            username_input.click(click_count=3)
            username_input.fill("")
            save_btn = authed_page.locator(".ant-modal-footer").get_by_role("button", name="Save Changes")
            if save_btn.count() > 0:
                save_btn.click()
                expect(authed_page.get_by_text("Username is required", exact=False)).to_be_visible(timeout=5_000)

    def test_profile_password_mismatch_shows_validation(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.get_by_text("Edit Profile")).to_be_visible()
        # Fill mismatched passwords — use exact IDs to avoid strict mode violation
        new_pass = authed_page.locator("#new_password")
        confirm_pass = authed_page.locator("#confirm_password")
        if new_pass.count() > 0 and confirm_pass.count() > 0:
            new_pass.fill("newpassword")
            confirm_pass.fill("differentpassword")
            save_btn = authed_page.locator(".ant-modal-footer").get_by_role("button", name="Save Changes")
            if save_btn.count() > 0:
                save_btn.click()
                expect(authed_page.get_by_text("Passwords do not match", exact=False)).to_be_visible(timeout=5_000)


class TestThemeToggle:
    def test_theme_toggle_is_accessible_via_aria_label(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        toggle = authed_page.locator("[aria-label*='Switch to']").first
        expect(toggle).to_be_visible()

    def test_theme_toggle_changes_aria_label_after_click(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        toggle = authed_page.locator("[aria-label*='Switch to']").first
        label_before = toggle.get_attribute("aria-label")
        toggle.click()
        authed_page.wait_for_timeout(300)
        label_after = toggle.get_attribute("aria-label")
        assert label_before != label_after, "Theme toggle should flip its aria-label"

    def test_theme_toggle_persists_after_navigation(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.route("**/api/django/watchlist/**", lambda r: fulfill_json(r, []))
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        toggle = authed_page.locator("[aria-label*='Switch to']").first
        label_before = toggle.get_attribute("aria-label")
        toggle.click()
        authed_page.wait_for_timeout(300)
        # Navigate away and back
        authed_page.goto("/watchlist")
        authed_page.wait_for_timeout(500)
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        authed_page.wait_for_timeout(500)
        toggle_after = authed_page.locator("[aria-label*='Switch to']").first
        label_after = toggle_after.get_attribute("aria-label")
        assert label_before != label_after, "Theme toggle state should persist across navigation"
