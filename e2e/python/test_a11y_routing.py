"""
Accessibility and routing: keyboard-reachable card links, the not-found page,
and signed-in users being sent on from the auth pages.
"""
from playwright.sync_api import Page, expect

from conftest import (
    EMPTY_RESPONSE,
    MOCK_MOVIE_DETAIL,
    MOCK_MOVIE_RESPONSE,
    fulfill_json,
    mock_movie_detail_routes,
    mock_tmdb_movies,
    paginated,
)

# Set by an init script if the login form is ever painted during the page's life.
WATCH_FOR_LOGIN_FORM = """
window.__sawLoginForm = false;
new MutationObserver(() => {
  if (document.querySelector('input#password')) window.__sawLoginForm = true;
}).observe(document, { childList: true, subtree: true });
"""


class TestKeyboardCardLinks:
    def test_enter_on_similar_card_opens_that_title(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.route("**/api/tmdb/movie/100/similar**", lambda r: fulfill_json(r, MOCK_MOVIE_RESPONSE))
        mock_movie_detail_routes(authed_page, 101, detail={**MOCK_MOVIE_DETAIL, "id": 101, "title": "Movie 2"})
        authed_page.goto("/movie/100")

        link = authed_page.get_by_role("link", name="Movie 2", exact=True)
        expect(link).to_have_attribute("href", "/movie/101", timeout=10_000)
        link.focus()
        authed_page.keyboard.press("Enter")

        expect(authed_page).to_have_url("/movie/101")
        expect(authed_page.get_by_role("heading", name="Movie 2")).to_be_visible(timeout=10_000)

    def test_cast_card_is_a_link_named_after_the_actor(self, authed_page: Page):
        detail = {**MOCK_MOVIE_DETAIL, "credits": {"cast": [
            {"id": 287, "name": "Brad Pitt", "character": "Tyler Durden", "profile_path": None},
        ], "crew": []}}
        mock_movie_detail_routes(authed_page, 100, detail=detail)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_role("link", name="Brad Pitt", exact=True)).to_have_attribute(
            "href", "/person/287", timeout=10_000
        )

    def test_keyboard_follow_on_person_card_does_not_navigate(self, authed_page: Page):
        person = {"id": 287, "name": "Brad Pitt", "profile_path": None, "known_for_department": "Acting"}
        authed_page.route("**/api/tmdb/person/popular**", lambda r: fulfill_json(
            r, {"results": [person], "total_pages": 1, "total_results": 1, "page": 1}
        ))
        posted = []

        def followed(route):
            if route.request.method == "POST":
                posted.append(route.request.post_data_json)
                fulfill_json(route, {"personId": 287, "name": "Brad Pitt", "profilePath": None,
                                     "followedAt": "2026-01-01T00:00:00Z"}, status=201)
            else:
                fulfill_json(route, paginated([]))

        authed_page.route("**/api/followed-people/**", followed)
        authed_page.goto("/people")

        poster = authed_page.get_by_role("link", name="View profile of Brad Pitt")
        expect(poster).to_have_attribute("href", "/person/287", timeout=10_000)
        poster.focus()
        authed_page.keyboard.press("Tab")
        follow = authed_page.get_by_role("button", name="Follow Brad Pitt")
        expect(follow).to_be_focused()
        authed_page.keyboard.press("Enter")

        expect(authed_page.get_by_role("button", name="Unfollow Brad Pitt")).to_be_visible(timeout=5_000)
        assert posted and posted[0]["personId"] == 287
        expect(authed_page).to_have_url("/people")


class TestNotFoundPage:
    def test_unknown_path_shows_not_found_and_keeps_url(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/moviez")
        expect(authed_page.get_by_text("Page not found")).to_be_visible(timeout=10_000)
        expect(authed_page).to_have_url("/moviez")

        authed_page.get_by_role("link", name="Go to Movies").click()
        expect(authed_page).to_have_url("/movies")

    def test_root_still_lands_on_movies(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.goto("/")
        expect(authed_page).to_have_url("/movies")


class TestSignedInAuthPages:
    def test_login_redirects_to_movies_without_painting_the_form(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.add_init_script(WATCH_FOR_LOGIN_FORM)
        authed_page.goto("/login")
        expect(authed_page).to_have_url("/movies")
        assert authed_page.evaluate("window.__sawLoginForm") is False

    def test_back_does_not_return_to_login(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, {}))
        authed_page.goto("/people")
        authed_page.route("**/api/tmdb/person/popular**", lambda r: fulfill_json(r, EMPTY_RESPONSE))
        authed_page.goto("/login")
        expect(authed_page).to_have_url("/movies")
        authed_page.go_back()
        expect(authed_page).to_have_url("/people")

    def test_register_and_forgot_password_redirect(self, authed_page: Page):
        mock_tmdb_movies(authed_page)
        for path in ("/register", "/forgot-password"):
            authed_page.goto(path)
            expect(authed_page).to_have_url("/movies")

    def test_reset_link_still_works_when_signed_in(self, authed_page: Page):
        authed_page.goto("/reset-password/abc123/token456")
        expect(authed_page.get_by_role("heading", name="Reset Password")).to_be_visible()
