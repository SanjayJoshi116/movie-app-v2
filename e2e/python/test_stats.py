"""
Stats page tests: empty state, stat cards, chart sections, edge cases.
"""
from playwright.sync_api import Page, expect

from conftest import fulfill_json, MOCK_STATS


class TestStatsEmpty:
    def test_empty_stats_shows_heading(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, {
            **MOCK_STATS, "totalWatched": 0, "moviesCount": 0, "tvCount": 0
        }))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)

    def test_empty_stats_shows_empty_description(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, {
            **MOCK_STATS, "totalWatched": 0
        }))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Start watching movies and TV shows", exact=False)).to_be_visible()

    def test_stats_loading_state_then_content(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: (
            authed_page.wait_for_timeout(500) or fulfill_json(r, MOCK_STATS)
        ))
        authed_page.goto("/stats")
        # Eventually the page renders
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=10_000)

    def test_stats_network_error_shows_error_with_retry(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: r.fulfill(
            status=500, content_type="application/json", body='{"detail": "Server error"}'
        ))
        authed_page.goto("/stats")
        # A failed request is an error with Retry, never the "start watching" empty state
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Couldn't load your stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Retry")).to_be_visible()
        expect(authed_page.get_by_text("Start watching movies and TV shows", exact=False)).to_have_count(0)

    def test_stats_retry_after_error_loads_stats(self, authed_page: Page):
        # Fail every request until the error state is up (userApi's own 500
        # retry and StrictMode's double effect make call counts unreliable).
        state = {"fail": True}

        def handler(r):
            if state["fail"]:
                r.fulfill(status=500, content_type="application/json", body='{"detail": "Server error"}')
            else:
                fulfill_json(r, MOCK_STATS)

        authed_page.route("**/api/stats/**", handler)
        authed_page.goto("/stats")
        expect(authed_page.get_by_text("Couldn't load your stats")).to_be_visible(timeout=15_000)
        state["fail"] = False
        authed_page.get_by_role("button", name="Retry").click()
        expect(authed_page.get_by_text("Total Watched", exact=False)).to_be_visible(timeout=8_000)


class TestStatsCards:
    def test_stats_total_watched_card_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        # "TOTAL WATCHED" rendered in uppercase via CSS; check case-insensitive
        expect(authed_page.get_by_text("Total Watched", exact=False)).to_be_visible(timeout=5_000)

    def test_stats_movies_card_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Movies", exact=False).first).to_be_visible(timeout=5_000)

    def test_stats_total_ratings_card_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Total Ratings", exact=False)).to_be_visible(timeout=5_000)

    def test_stats_total_watched_numeric_value_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        # The count-up animation eventually reaches 42
        expect(authed_page.get_by_text("42")).to_be_visible(timeout=5_000)


class TestStatsSections:
    def test_stats_library_overview_heading(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Library Overview")).to_be_visible(timeout=5_000)

    def test_stats_watch_history_heading(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Watch History")).to_be_visible(timeout=5_000)

    def test_stats_activity_heatmap_card_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Activity Heatmap", exact=False)).to_be_visible(timeout=5_000)

    def test_stats_ratings_distribution_card_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Your Ratings Distribution")).to_be_visible(timeout=5_000)

    def test_stats_top_rated_tab_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("tab", name="Top Rated")).to_be_visible(timeout=5_000)

    def test_stats_recently_watched_tab_visible(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("tab", name="Recently Watched")).to_be_visible(timeout=5_000)

    def test_stats_top_rated_shows_fight_club(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        # Top Rated tab should show Fight Club from MOCK_STATS.topRatedItems
        expect(authed_page.get_by_text("Fight Club")).to_be_visible(timeout=5_000)


class TestStatsEdgeCases:
    def test_pie_chart_hidden_when_only_movies(self, authed_page: Page):
        """Movies vs TV Shows pie chart only renders when both > 0."""
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, {
            **MOCK_STATS,
            "moviesCount": 10,
            "tvCount": 0,
        }))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        # "Movies vs TV Shows" card title should NOT be rendered
        expect(authed_page.get_by_text("Movies vs TV Shows")).not_to_be_visible(timeout=3_000)

    def test_pie_chart_shown_when_both_types_present(self, authed_page: Page):
        """Pie chart renders when moviesCount > 0 AND tvCount > 0."""
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Movies vs TV Shows")).to_be_visible(timeout=5_000)

    def test_stats_genres_section_shows_top_genre(self, authed_page: Page):
        authed_page.route("**/api/stats/**", lambda r: fulfill_json(r, MOCK_STATS))
        authed_page.goto("/stats")
        expect(authed_page.get_by_role("heading", name="Your Stats")).to_be_visible(timeout=8_000)
        # MOCK_STATS has "Action" in topGenres
        expect(authed_page.get_by_text("Action")).to_be_visible(timeout=5_000)
