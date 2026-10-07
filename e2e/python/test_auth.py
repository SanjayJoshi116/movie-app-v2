"""
Auth tests: login, register, forgot password, reset password, protected routes.
These tests do NOT use authed_page — they run as unauthenticated by default.
"""
import json
import pytest
from playwright.sync_api import Page, expect

from conftest import paginated, fulfill_json, MOCK_TOKENS, MOCK_USER, seed_auth, mock_base_django_routes


# ---------------------------------------------------------------------------
# Default route guards (no auth, block all Django)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def block_api(page: Page):
    """Block all Django API calls by default; override per test as needed."""
    page.route("**/api/**", lambda r: r.fulfill(status=401, content_type="application/json", body='{"detail":"Unauthorized"}'))
    page.route("**/api/tmdb/**", lambda r: fulfill_json(r, {"results": [], "total_pages": 1, "total_results": 0}))


# ---------------------------------------------------------------------------
# Login page
# ---------------------------------------------------------------------------

class TestLoginPage:
    def test_login_renders_form(self, page: Page):
        page.goto("/login")
        expect(page.get_by_role("heading", name="Sign In")).to_be_visible()
        expect(page.get_by_label("Username")).to_be_visible()
        expect(page.get_by_label("Password")).to_be_visible()
        expect(page.get_by_role("button", name="Sign In")).to_be_visible()
        expect(page.get_by_role("link", name="Forgot password?")).to_be_visible()
        expect(page.get_by_role("link", name="Register")).to_be_visible()

    def test_login_invalid_credentials_shows_error_toast(self, page: Page):
        # Use 400 (not 401) so the JWT interceptor doesn't trigger a redirect
        page.route("**/api/auth/login/", lambda r: r.fulfill(
            status=400, content_type="application/json",
            body=json.dumps({"detail": "Invalid credentials."})
        ))
        page.goto("/login")
        page.get_by_label("Username").fill("wronguser")
        page.get_by_label("Password").fill("wrongpass")
        page.get_by_role("button", name="Sign In").click()
        expect(page.locator(".ant-message-notice-content")).to_contain_text(
            "Invalid username or password.", timeout=8_000
        )

    def test_login_success_redirects_to_movies(self, page: Page):
        page.route("**/api/auth/login/", lambda r: fulfill_json(r, {
            "access": MOCK_TOKENS["access"],
            "refresh": MOCK_TOKENS["refresh"],
            "user": MOCK_USER,
        }))
        page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        page.route("**/api/ratings/**", lambda r: fulfill_json(r, paginated([])))
        page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([])))
        page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))

        page.goto("/login")
        page.get_by_label("Username").fill("testuser")
        page.get_by_label("Password").fill("testpass")
        page.get_by_role("button", name="Sign In").click()
        expect(page).to_have_url("/movies", timeout=10_000)

    def test_login_empty_username_shows_validation(self, page: Page):
        page.goto("/login")
        page.get_by_label("Password").fill("somepass")
        page.get_by_role("button", name="Sign In").click()
        expect(page.get_by_text("Enter your username")).to_be_visible()

    def test_login_empty_password_shows_validation(self, page: Page):
        page.goto("/login")
        page.get_by_label("Username").fill("testuser")
        page.get_by_role("button", name="Sign In").click()
        expect(page.get_by_text("Enter your password")).to_be_visible()

    def test_login_server_error_shows_toast(self, page: Page):
        page.route("**/api/auth/login/", lambda r: r.fulfill(
            status=500, content_type="application/json",
            body=json.dumps({"detail": "Internal server error"})
        ))
        page.goto("/login")
        page.get_by_label("Username").fill("testuser")
        page.get_by_label("Password").fill("testpass")
        page.get_by_role("button", name="Sign In").click()
        expect(page.locator(".ant-message-notice-content")).to_be_visible(timeout=8_000)

    def test_login_already_authenticated_redirects_to_movies(self, page: Page):
        """Signed-in users skip /login (see test_a11y_routing for the no-flash check)."""
        seed_auth(page)
        mock_base_django_routes(page)
        page.goto("/login")
        expect(page).to_have_url("/movies")


# ---------------------------------------------------------------------------
# Protected route redirects
# ---------------------------------------------------------------------------

class TestProtectedRoutes:
    def test_unauthenticated_movies_redirects_to_login(self, page: Page):
        page.goto("/movies")
        expect(page).to_have_url("/login", timeout=5_000)

    def test_unauthenticated_watchlist_redirects_to_login(self, page: Page):
        page.goto("/watchlist")
        expect(page).to_have_url("/login", timeout=5_000)

    def test_unauthenticated_stats_redirects_to_login(self, page: Page):
        page.goto("/stats")
        expect(page).to_have_url("/login", timeout=5_000)

    def test_unauthenticated_lists_redirects_to_login(self, page: Page):
        page.goto("/lists")
        expect(page).to_have_url("/login", timeout=5_000)

    def test_unauthenticated_watched_redirects_to_login(self, page: Page):
        page.goto("/watched")
        expect(page).to_have_url("/login", timeout=5_000)

    def test_unauthenticated_search_redirects_to_login(self, page: Page):
        page.goto("/search")
        expect(page).to_have_url("/login", timeout=5_000)


# ---------------------------------------------------------------------------
# Register page
# ---------------------------------------------------------------------------

class TestRegisterPage:
    def test_register_renders_form(self, page: Page):
        page.goto("/register")
        expect(page.get_by_text("Create Account")).to_be_visible()
        expect(page.get_by_label("Username")).to_be_visible()
        expect(page.get_by_label("Email")).to_be_visible()
        expect(page.get_by_label("Password", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Register")).to_be_visible()

    def test_register_short_password_validation(self, page: Page):
        page.goto("/register")
        page.get_by_label("Username").fill("newuser")
        page.get_by_label("Password", exact=True).fill("abc")
        page.get_by_role("button", name="Register").click()
        expect(page.get_by_text("At least 8 characters")).to_be_visible()

    def test_register_empty_username_validation(self, page: Page):
        page.goto("/register")
        page.get_by_label("Email").fill("test@example.com")
        page.get_by_label("Password", exact=True).fill("validpass")
        page.get_by_role("button", name="Register").click()
        expect(page.get_by_text("Enter a username")).to_be_visible()

    def test_register_invalid_email_validation(self, page: Page):
        page.goto("/register")
        page.get_by_label("Username").fill("newuser")
        page.get_by_label("Email").fill("notanemail")
        page.get_by_label("Password", exact=True).fill("validpass")
        page.get_by_role("button", name="Register").click()
        expect(page.get_by_text("Enter a valid email")).to_be_visible()

    def test_register_success_redirects_to_movies(self, page: Page):
        page.route("**/api/auth/register/", lambda r: fulfill_json(r, {
            "access": MOCK_TOKENS["access"],
            "refresh": MOCK_TOKENS["refresh"],
            "user": MOCK_USER,
        }))
        page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        page.route("**/api/ratings/**", lambda r: fulfill_json(r, paginated([])))
        page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([])))
        page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))

        page.goto("/register")
        page.get_by_label("Username").fill("newuser")
        page.get_by_label("Email").fill("new@example.com")
        page.get_by_label("Password", exact=True).fill("validpass")
        page.get_by_label("Confirm Password").fill("validpass")
        page.get_by_role("button", name="Register").click()
        expect(page).to_have_url("/movies", timeout=10_000)

    def test_register_duplicate_username_shows_error(self, page: Page):
        page.route("**/api/auth/register/", lambda r: r.fulfill(
            status=400, content_type="application/json",
            body=json.dumps({"username": ["A user with that username already exists."]})
        ))
        page.goto("/register")
        page.get_by_label("Username").fill("existinguser")
        page.get_by_label("Email").fill("new@example.com")
        page.get_by_label("Password", exact=True).fill("validpass")
        page.get_by_label("Confirm Password").fill("validpass")
        page.get_by_role("button", name="Register").click()
        expect(page.locator(".ant-message-notice-content")).to_contain_text(
            "A user with that username already exists.", timeout=8_000
        )

    def test_register_has_sign_in_link(self, page: Page):
        page.goto("/register")
        expect(page.get_by_role("link", name="Sign In")).to_be_visible()


# ---------------------------------------------------------------------------
# Forgot password page
# ---------------------------------------------------------------------------

class TestForgotPasswordPage:
    def test_forgot_password_renders_form(self, page: Page):
        page.goto("/forgot-password")
        expect(page.get_by_text("Forgot Password")).to_be_visible()
        expect(page.get_by_label("Email")).to_be_visible()
        expect(page.get_by_role("button", name="Send Reset Link")).to_be_visible()

    def test_forgot_password_success_shows_inbox_state(self, page: Page):
        page.route("**/api/auth/password-reset/", lambda r: fulfill_json(r, {
            "detail": "If that email is registered, a reset link has been sent."
        }))
        page.goto("/forgot-password")
        page.get_by_label("Email").fill("user@example.com")
        page.get_by_role("button", name="Send Reset Link").click()
        expect(page.get_by_role("heading", name="Check Your Inbox")).to_be_visible(timeout=8_000)

    def test_forgot_password_invalid_email_format(self, page: Page):
        page.goto("/forgot-password")
        page.get_by_label("Email").fill("notanemail")
        page.get_by_role("button", name="Send Reset Link").click()
        expect(page.get_by_text("Enter a valid email")).to_be_visible()

    def test_forgot_password_empty_email(self, page: Page):
        page.goto("/forgot-password")
        page.get_by_role("button", name="Send Reset Link").click()
        # Either a validation message or email stays empty; the button should not navigate
        expect(page.get_by_label("Email")).to_be_visible()

    def test_forgot_password_has_back_to_login_link(self, page: Page):
        page.goto("/forgot-password")
        expect(page.get_by_role("link", name="Back to Sign In")).to_be_visible()


# ---------------------------------------------------------------------------
# Reset password page
# ---------------------------------------------------------------------------

class TestResetPasswordPage:
    def test_reset_password_renders_form(self, page: Page):
        page.goto("/reset-password/abc123/token456")
        expect(page.get_by_role("heading", name="Reset Password")).to_be_visible()

    def test_reset_password_mismatched_passwords_shows_error(self, page: Page):
        page.goto("/reset-password/abc123/token456")
        page.get_by_label("New Password").fill("newpass1")
        page.get_by_label("Confirm Password").fill("differentpass")
        page.get_by_role("button", name="Reset Password").click()
        expect(page.get_by_text("Passwords do not match")).to_be_visible(timeout=5_000)

    def test_reset_password_success_navigates_to_login(self, page: Page):
        page.route("**/api/auth/password-reset/confirm/", lambda r: fulfill_json(r, {
            "detail": "Password reset successfully."
        }))
        page.goto("/reset-password/uid123/tok456")
        page.get_by_label("New Password").fill("newvalidpass")
        page.get_by_label("Confirm Password").fill("newvalidpass")
        page.get_by_role("button", name="Reset Password").click()
        expect(page).to_have_url("/login", timeout=10_000)

    def test_reset_password_invalid_token_shows_error(self, page: Page):
        page.route("**/api/auth/password-reset/confirm/", lambda r: r.fulfill(
            status=400, content_type="application/json",
            body=json.dumps({"detail": "Invalid or expired reset link."})
        ))
        page.goto("/reset-password/baduid/badtok")
        page.get_by_label("New Password").fill("newvalidpass")
        page.get_by_label("Confirm Password").fill("newvalidpass")
        page.get_by_role("button", name="Reset Password").click()
        expect(page.locator(".ant-message-notice-content")).to_be_visible(timeout=8_000)
