"""
Profile modal tests: open, show user data, save changes, validation, theme toggle.
"""
import json
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


# --- fix-account-edges ---------------------------------------------------------

def goto_movies(page: Page) -> None:
    mock_tmdb_movies(page)
    page.goto("/movies")
    expect(page.get_by_role("article").first).to_be_visible(timeout=10_000)


def close_profile_modal(page: Page) -> None:
    page.locator(".ant-modal-close").click()
    expect(page.locator(".ant-modal")).not_to_be_visible()


def open_data_tab(page: Page) -> None:
    page.locator(".ant-modal").get_by_role("tab", name="Data & TMDB").click()


class TestProfileDialogStartsFresh:
    def test_unsaved_edits_and_passwords_gone_on_reopen(self, authed_page: Page):
        goto_movies(authed_page)
        open_profile_modal(authed_page)
        modal = authed_page.locator(".ant-modal")
        modal.get_by_label("First Name").fill("Draft name")
        modal.get_by_label("Current Password").fill("typed-secret")
        modal.get_by_label("New Password").fill("another-secret")
        close_profile_modal(authed_page)

        open_profile_modal(authed_page)
        expect(modal.get_by_label("First Name")).to_have_value("")
        expect(modal.get_by_label("Current Password")).to_have_value("")
        expect(modal.get_by_label("New Password")).to_have_value("")

    def test_profile_changed_while_closed_shows_new_values(self, authed_page: Page):
        goto_movies(authed_page)
        open_profile_modal(authed_page)
        close_profile_modal(authed_page)
        # Another tab saved the profile: same account, new first name.
        authed_page.evaluate(
            """() => {
              const u = JSON.parse(localStorage.getItem('cinedb_user'));
              localStorage.setItem('cinedb_user', JSON.stringify({ ...u, first_name: 'Elsewhere' }));
              window.dispatchEvent(new StorageEvent('storage', { key: 'cinedb_user' }));
            }"""
        )
        open_profile_modal(authed_page)
        expect(authed_page.locator(".ant-modal").get_by_label("First Name")).to_have_value("Elsewhere")


class TestProfileWithoutEmail:
    def test_no_email_account_saves_profile(self, authed_page: Page):
        authed_page.add_init_script(
            f"localStorage.setItem('cinedb_user', JSON.stringify({json.dumps({**MOCK_USER, 'email': ''})}));"
        )
        sent = []

        def profile(r):
            sent.append(r.request.post_data_json)
            fulfill_json(r, {**MOCK_USER, "email": "", "first_name": "Nora"})

        authed_page.route("**/api/auth/profile/**", profile)
        goto_movies(authed_page)
        open_profile_modal(authed_page)
        authed_page.locator(".ant-modal").get_by_label("First Name").fill("Nora")
        save_button(authed_page).click()
        expect(authed_page.get_by_text("Profile updated successfully.")).to_be_visible(timeout=5_000)
        assert sent and sent[0]["email"] == ""
        assert "current_password" not in sent[0]


class TestExportAll:
    def test_failed_watched_load_blocks_export_and_retry_recovers(self, authed_page: Page):
        state = {"fail": True}

        def watched(r):
            if state["fail"]:
                r.fulfill(status=500, content_type="application/json", body="{}")
            else:
                fulfill_json(r, paginated([]))

        authed_page.route("**/api/watched/**", watched)
        goto_movies(authed_page)
        open_profile_modal(authed_page)
        open_data_tab(authed_page)
        modal = authed_page.locator(".ant-modal")
        downloads = []
        authed_page.on("download", lambda d: downloads.append(d))

        modal.get_by_role("button", name="Export All Data (ZIP)").click()
        alert = modal.get_by_role("alert").filter(has_text="Couldn't load your watched history")
        expect(alert).to_be_visible(timeout=5_000)
        assert not downloads

        state["fail"] = False
        alert.get_by_role("button", name="Retry").click()
        expect(alert).not_to_be_visible()
        with authed_page.expect_download(timeout=10_000) as info:
            modal.get_by_role("button", name="Export All Data (ZIP)").click()
        assert info.value.suggested_filename.startswith("cinedb-backup-")

    def test_loading_library_shows_loading_button(self, authed_page: Page):
        # Ratings never answer: the library is still loading when the dialog opens.
        authed_page.route("**/api/ratings/**", lambda r: None)
        goto_movies(authed_page)
        open_profile_modal(authed_page)
        open_data_tab(authed_page)
        button = authed_page.locator(".ant-modal").get_by_role("button", name="Loading library…")
        expect(button).to_be_visible()
        expect(button).to_have_class(re.compile(r"ant-btn-loading"))


class TestTmdbErrors:
    def test_disconnect_network_failure_says_server_unreachable(self, authed_page: Page):
        goto_movies(authed_page)
        authed_page.route("**/api/tmdb-auth/disconnect/**", lambda r: r.abort())
        # Connected, so the dialog offers Disconnect (open_profile_modal mocks "not connected").
        authed_page.route("**/api/tmdb-auth/status/**", lambda r: fulfill_json(r, {"connected": True}))
        authed_page.locator(".ant-avatar").first.click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        open_data_tab(authed_page)
        authed_page.locator(".ant-modal").get_by_role("button", name="Disconnect").click()
        expect(authed_page.locator(".ant-message-notice-content")).to_contain_text(
            "Can't reach the server. Check your connection and try again.", timeout=8_000
        )
