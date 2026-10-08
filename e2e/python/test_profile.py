"""
Profile modal tests: open, show user data, save changes, validation, theme toggle.
"""
import re

from playwright.sync_api import Page, expect

from conftest import paginated, fulfill_json, MOCK_USER, mock_tmdb_movies


def open_profile_modal(page: Page) -> None:
    """Click the avatar to open the profile modal."""
    # The modal checks whether a TMDB account is connected as it opens.
    page.route("**/api/tmdb-auth/status/**", lambda r: fulfill_json(r, {"connected": False}))
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
        expect(authed_page.locator(".ant-modal").get_by_label("Username")).to_have_value("testuser")

    def test_profile_modal_shows_email(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        expect(authed_page.locator(".ant-modal").get_by_label("Email")).to_have_value("t@t.com")

    def test_profile_modal_close_via_button(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        authed_page.locator(".ant-modal-close").click()
        expect(authed_page.locator(".ant-modal")).not_to_be_visible()


def save_button(page: Page):
    # The modal has footer={null}; Save is the form's own submit button.
    return page.locator(".ant-modal").get_by_role("button", name="Save Changes")


class TestProfileSave:
    def test_profile_save_changes_success(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        sent = []

        def profile(r):
            sent.append(r.request.post_data_json)
            fulfill_json(r, {**MOCK_USER, "first_name": "Test"})

        authed_page.route("**/api/auth/profile/**", profile)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        authed_page.locator(".ant-modal").get_by_label("First Name").fill("Test")
        save_button(authed_page).click()
        expect(authed_page.get_by_text("Profile updated successfully.")).to_be_visible(timeout=5_000)
        expect(authed_page.locator(".ant-modal")).not_to_be_visible()
        assert sent and sent[0]["first_name"] == "Test"
        # Unchanged email and no new password: no password field is sent.
        assert "current_password" not in sent[0] and "new_password" not in sent[0]

    def test_profile_save_error_keeps_dialog_open(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.route("**/api/auth/profile/**", lambda r: r.fulfill(
            status=400, content_type="application/json",
            body='{"username": ["This username is already taken."]}'
        ))
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        save_button(authed_page).click()
        expect(authed_page.locator(".ant-message-notice-content")).to_contain_text(
            "This username is already taken.", timeout=8_000
        )
        expect(authed_page.locator(".ant-modal")).to_be_visible()
        expect(authed_page.get_by_text("Profile updated successfully.")).not_to_be_visible()


class TestProfileValidation:
    def test_profile_empty_username_shows_validation(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        authed_page.locator(".ant-modal").get_by_label("Username").fill("")
        save_button(authed_page).click()
        # The catch-all fails the test at teardown if a PATCH went out anyway.
        expect(authed_page.locator(".ant-modal .ant-form-item-explain-error")).to_have_text("Required.")

    def test_profile_password_mismatch_shows_validation(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        open_profile_modal(authed_page)
        modal = authed_page.locator(".ant-modal")
        modal.get_by_label("New Password").fill("newpassword")
        modal.get_by_label("Confirm Password").fill("differentpassword")
        save_button(authed_page).click()
        expect(modal.get_by_text("Passwords do not match.")).to_be_visible(timeout=5_000)


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
        toggle = authed_page.get_by_role("button", name="Switch to light mode")
        expect(authed_page.locator("body")).to_have_class(re.compile(r"dark-theme"))
        toggle.click()
        expect(authed_page.get_by_role("button", name="Switch to dark mode")).to_be_visible()
        expect(authed_page.locator("body")).not_to_have_class(re.compile(r"dark-theme"))

    def test_theme_toggle_persists_after_navigation(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        toggle = authed_page.get_by_role("button", name="Switch to light mode")
        expect(authed_page.locator("body")).to_have_class(re.compile(r"dark-theme"))
        toggle.click()
        expect(authed_page.get_by_role("button", name="Switch to dark mode")).to_be_visible()
        expect(authed_page.locator("body")).not_to_have_class(re.compile(r"dark-theme"))
        # Navigate away and back (full page loads, so it comes from storage)
        authed_page.goto("/watchlist")
        expect(authed_page.get_by_text("My Watchlist (0)")).to_be_visible(timeout=8_000)
        authed_page.goto("/movies")
        expect(authed_page.get_by_role("article").first).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("button", name="Switch to dark mode")).to_be_visible()
        expect(authed_page.locator("body")).not_to_have_class(re.compile(r"dark-theme"))
