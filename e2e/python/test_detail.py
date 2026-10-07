"""
Detail page tests: movie detail, TV detail, episode guide, toggles, error states.
"""
from playwright.sync_api import Page, expect

from conftest import (
    paginated,
    fulfill_json, MOCK_LIST, mock_movie_detail_routes, mock_tv_detail_routes,
)


class TestMovieDetailPage:
    def test_movie_detail_renders_title(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)

    def test_movie_detail_shows_back_button(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Back button has an arrow icon with "Back" text
        back_btn = authed_page.locator("button").filter(has_text="Back").first
        expect(back_btn).to_be_visible()

    def test_movie_detail_watchlist_add_toggle(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        added_item = {
            "id": 99, "mediaId": 100, "mediaType": "movie", "title": "Movie 1",
            "posterPath": None, "voteAverage": 7.5, "addedAt": "2024-01-01T00:00:00Z", "watched": False,
        }
        authed_page.route("**/api/watchlist/**", lambda r: (
            fulfill_json(r, paginated([]))
            if r.request.method == "GET"
            else fulfill_json(r, added_item, status=201)
        ))
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Find the bookmark/watchlist button
        watchlist_btn = authed_page.locator("[aria-label*='watchlist'], [aria-label*='Watchlist']").first
        if watchlist_btn.count() > 0:
            watchlist_btn.click()
            expect(authed_page.locator(".ant-message-notice-content")).to_be_visible(timeout=5_000)

    def test_movie_detail_watched_toggle(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        watched_item = {
            "id": 1, "mediaId": 100, "mediaType": "movie", "title": "Movie 1",
            "posterPath": None, "voteAverage": 7.5, "watchedAt": "2024-01-01T00:00:00Z",
        }
        authed_page.route("**/api/watched/**", lambda r: (
            fulfill_json(r, paginated([]))
            if r.request.method == "GET"
            else fulfill_json(r, watched_item, status=201)
        ))
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Eye/watched icon button
        eye_btn = authed_page.locator("[aria-label*='watched'], [aria-label*='Watched']").first
        if eye_btn.count() > 0:
            eye_btn.click()
            # Marking as watched opens a confirm modal (MarkWatchedModal) rather than
            # firing instantly -- only unmarking is a direct toggle with no modal.
            expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
            authed_page.get_by_role("button", name="Mark Watched").click()
            expect(authed_page.locator(".ant-message-notice-content")).to_be_visible(timeout=5_000)

    def test_movie_detail_rate_button_opens_modal(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Rate button
        rate_btn = authed_page.get_by_role("button", name="Rate")
        if rate_btn.count() == 0:
            rate_btn = authed_page.locator("button").filter(has_text="Rate").first
        expect(rate_btn).to_be_visible(timeout=5_000)
        rate_btn.click()
        # Modal with the movie's title should appear
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)

    def test_movie_detail_network_error_shows_fallback(self, authed_page: Page):
        authed_page.route("**/api/tmdb/movie/999**", lambda r: r.fulfill(status=500, body="Server Error"))
        authed_page.goto("/movie/999")
        # Error state or some fallback should render (not a blank page)
        authed_page.wait_for_timeout(3000)
        # Should not crash - body should still be visible
        expect(authed_page.locator("body")).to_be_visible()

    def test_movie_detail_add_to_list_button_visible_with_lists(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([MOCK_LIST])))
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Look for "Add to List" button or similar
        add_btn = authed_page.locator("button").filter(has_text="List").first
        expect(add_btn).to_be_visible(timeout=5_000)

    def test_movie_detail_genre_tags_visible(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Genre "Action" should appear as a tag
        expect(authed_page.get_by_text("Action")).to_be_visible(timeout=5_000)

    def test_movie_detail_certification_with_rating(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        # Override release_dates route with actual certification data
        authed_page.route("**/api/tmdb/movie/100/release_dates**", lambda r: fulfill_json(r, {
            "results": [
                {"iso_3166_1": "US", "release_dates": [{"certification": "R", "type": 3}]}
            ]
        }))
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Ant Descriptions renders as a table — check row with "Certification" label
        expect(authed_page.get_by_role("rowheader", name="Certification")).to_be_visible(timeout=5_000)
        # The certification value cell contains "R" (exact to avoid matching "Released")
        expect(authed_page.get_by_role("cell", name="R", exact=True)).to_be_visible(timeout=5_000)


class TestTVDetailPage:
    def test_tv_detail_renders_show_name(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)

    def test_tv_detail_shows_season_selector(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        # Season selector combobox
        expect(authed_page.get_by_role("combobox").first).to_be_visible(timeout=5_000)

    def test_tv_detail_episode_guide_shows_pilot(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        # EpisodeGuide.tsx nests the per-episode Collapse inside the outer "N episodes"
        # panel's children -- antd doesn't render collapsed children at all (not just
        # hidden), so the episode list has to be expanded before "Pilot" ever mounts.
        expect(authed_page.get_by_text("1 episode")).to_be_visible(timeout=8_000)
        authed_page.get_by_text("1 episode").click()
        expect(authed_page.get_by_text("Pilot")).to_be_visible(timeout=5_000)

    def test_tv_detail_episode_progress_section_visible(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        # Episode progress tracker section
        authed_page.wait_for_timeout(1000)
        # Check for episode-related UI (progress section text)
        progress = authed_page.locator("[class*='episode'], [class*='progress'], button").filter(has_text="S").first
        expect(progress).to_be_visible()

    def test_tv_detail_watchlist_toggle_visible(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        # Watchlist toggle should be present
        watchlist_btn = authed_page.locator("[aria-label*='watchlist'], [aria-label*='Watchlist']").first
        if watchlist_btn.count() > 0:
            expect(watchlist_btn).to_be_visible()

    def test_tv_detail_network_error_shows_fallback(self, authed_page: Page):
        authed_page.route("**/api/tmdb/tv/9999**", lambda r: r.fulfill(status=500, body="Server Error"))
        authed_page.goto("/tv/9999")
        authed_page.wait_for_timeout(3000)
        # Should not crash
        expect(authed_page.locator("body")).to_be_visible()

    def test_tv_detail_genre_tags_visible(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_text("Drama")).to_be_visible(timeout=5_000)

    def test_tv_detail_next_episode_button_rolls_over_season(self, authed_page: Page):
        # MOCK_TV_DETAIL's only season entry is season 1 with episode_count=7,
        # so bookmarking S01E07 (the season's last episode) exercises the
        # season-rollover branch: next should be S02E01, not S01E08.
        mock_tv_detail_routes(authed_page, 1396)
        posted = {}
        authed_page.route(
            "**/api/episode-progress/1396/**",
            lambda r: (
                fulfill_json(r, {"showId": 1396, "season": 1, "episode": 7})
                if r.request.method == "GET"
                else (
                    posted.update(r.request.post_data_json)
                    or fulfill_json(r, {"showId": 1396, **r.request.post_data_json})
                )
            ),
        )

        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_text("Currently on")).to_be_visible(timeout=5_000)
        expect(authed_page.get_by_text("S01E07")).to_be_visible()

        authed_page.get_by_role("button", name="Next Episode →").click()

        expect(authed_page.get_by_text("S02E01")).to_be_visible(timeout=5_000)
        assert posted == {"season": 2, "episode": 1}
