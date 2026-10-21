"""
Detail page tests: movie detail, TV detail, episode guide, toggles, error states.
"""
import re

from playwright.sync_api import Page, expect

from conftest import (
    paginated,
    fulfill_json, MOCK_LIST, MOCK_MOVIE_DETAIL, MOCK_TV_DETAIL, mock_movie_detail_routes, mock_tv_detail_routes,
)


def _detail_requests(page: Page, path: str) -> list:
    """Collect requests for exactly `/api/tmdb/<path>` (sub-paths excluded)."""
    seen = []
    pattern = re.compile(r"/api/tmdb/" + re.escape(path) + r"(\?|$)")
    page.on("request", lambda req: seen.append(req.url) if pattern.search(req.url) else None)
    return seen


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
            "posterPath": None, "voteAverage": 7.5, "addedAt": "2024-01-01T00:00:00Z",
        }
        posts = []
        authed_page.route("**/api/watchlist/**", lambda r: (
            fulfill_json(r, paginated([]))
            if r.request.method == "GET"
            else (posts.append(r.request.post_data_json) or fulfill_json(r, added_item, status=201))
        ))
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        authed_page.get_by_role("button", name="Add to watchlist").click()
        expect(authed_page.get_by_role("button", name="Remove from watchlist")).to_be_visible(timeout=5_000)
        assert len(posts) == 1 and posts[0]["mediaId"] == 100

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
        authed_page.get_by_role("button", name="Mark as watched").click()
        # Marking as watched opens a confirm modal (MarkWatchedModal) rather than
        # firing instantly -- only unmarking is a direct toggle with no modal.
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        authed_page.get_by_role("button", name="Mark Watched").click()
        expect(authed_page.get_by_role("button", name="Unmark as watched")).to_be_visible(timeout=5_000)

    def test_movie_detail_rate_button_opens_modal(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        rate_btn = authed_page.get_by_role("button", name="Rate this movie")
        expect(rate_btn).to_be_visible(timeout=5_000)
        rate_btn.click()
        # Modal with the movie's title should appear
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)

    def test_movie_detail_network_error_shows_fallback(self, authed_page: Page):
        authed_page.route("**/api/tmdb/movie/999**", lambda r: r.fulfill(status=500, body="Server Error"))
        authed_page.goto("/movie/999")
        expect(authed_page.get_by_text("Failed to load movie details")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("button", name="Retry")).to_be_visible()

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
        # Certification data arrives in the combined response's release_dates part
        mock_movie_detail_routes(authed_page, 100, {**MOCK_MOVIE_DETAIL, "release_dates": {
            "results": [
                {"iso_3166_1": "US", "release_dates": [{"certification": "R", "type": 3}]}
            ]
        }})
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        # Ant Descriptions renders as a table — check row with "Certification" label
        expect(authed_page.get_by_role("rowheader", name="Certification")).to_be_visible(timeout=5_000)
        # The certification value cell contains "R" (exact to avoid matching "Released")
        expect(authed_page.get_by_role("cell", name="R", exact=True)).to_be_visible(timeout=5_000)


    def test_movie_detail_loads_in_one_tmdb_request(self, authed_page: Page):
        mock_movie_detail_routes(authed_page, 100)
        seen = _detail_requests(authed_page, "movie/100")
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("rowheader", name="Certification")).to_be_visible()
        # One request even under the dev build's double mount (in-flight sharing),
        # carrying every section the page shows.
        assert len(seen) == 1, seen
        for part in ("reviews", "similar", "watch%2Fproviders", "release_dates", "credits", "recommendations"):
            assert part in seen[0], (part, seen[0])

    def test_movie_detail_missing_or_malformed_parts_degrade_per_section(self, authed_page: Page):
        detail = {k: v for k, v in MOCK_MOVIE_DETAIL.items() if k not in ("reviews", "release_dates")}
        detail.update({"similar": "oops", "watch/providers": None, "credits": {"cast": "bad"}, "videos": {}})
        mock_movie_detail_routes(authed_page, 100, detail)
        authed_page.goto("/movie/100")
        expect(authed_page.get_by_text("Movie 1")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_text("Action")).to_be_visible()
        expect(authed_page.get_by_text("Failed to load movie details")).to_have_count(0)

    def test_trailers_load_only_when_played_from_the_keyboard(self, authed_page: Page):
        videos = {"results": [
            {"id": "v1", "key": "KEY1", "name": "Teaser", "site": "YouTube", "type": "Trailer"},
            {"id": "v2", "key": "KEY2", "name": "Final Trailer", "site": "YouTube", "type": "Trailer"},
        ]}
        mock_movie_detail_routes(authed_page, 100, {**MOCK_MOVIE_DETAIL, "videos": videos})
        authed_page.route("https://i.ytimg.com/**", lambda r: r.fulfill(status=204))
        authed_page.route("https://www.youtube-nocookie.com/**", lambda r: r.fulfill(status=200, body="", content_type="text/html"))
        authed_page.goto("/movie/100")
        teaser = authed_page.get_by_role("button", name="Play trailer: Teaser")
        expect(teaser).to_be_visible(timeout=10_000)
        expect(authed_page.locator("iframe")).to_have_count(0)

        teaser.focus()
        authed_page.keyboard.press("Enter")
        expect(authed_page.locator('iframe[title="Teaser"]')).to_have_attribute(
            "src", "https://www.youtube-nocookie.com/embed/KEY1?autoplay=1")
        expect(authed_page.locator("iframe")).to_have_count(1)

        authed_page.get_by_role("button", name="Play trailer: Final Trailer").focus()
        authed_page.keyboard.press("Space")
        expect(authed_page.locator('iframe[title="Final Trailer"]')).to_be_attached()

    def test_movie_detail_not_found(self, authed_page: Page):
        authed_page.route("**/api/tmdb/movie/998**", lambda r: fulfill_json(r, {"status_code": 34}, status=404))
        authed_page.goto("/movie/998")
        expect(authed_page.get_by_text("Movie not found")).to_be_visible(timeout=10_000)


class TestTVDetailPage:
    def test_tv_detail_loads_in_one_tmdb_request(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        seen = _detail_requests(authed_page, "tv/1396")
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad").first).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("heading", name="Episode Guide")).to_be_visible(timeout=10_000)
        assert len(seen) == 1, seen
        for part in ("aggregate_credits", "images", "reviews", "watch%2Fproviders", "similar", "videos"):
            assert part in seen[0], (part, seen[0])

    def test_tv_detail_malformed_parts_degrade_per_section(self, authed_page: Page):
        detail = {**MOCK_TV_DETAIL, "aggregate_credits": "bad", "images": [], "reviews": None}
        mock_tv_detail_routes(authed_page, 1396, detail)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad").first).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_text("Drama")).to_be_visible()
        expect(authed_page.get_by_text("Failed to load TV show details")).to_have_count(0)

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

    def test_tv_detail_episode_guide_hides_episodes_past_progress(self, authed_page: Page):
        # spoiler-shield: tracked at S01E01, so E2's title is left out until revealed.
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.route("**/api/tmdb/tv/1396/season/**", lambda r: fulfill_json(r, {
            "id": 3572, "name": "Season 1", "season_number": 1,
            "episodes": [
                {"id": 1, "name": "Pilot", "episode_number": 1, "still_path": None,
                 "overview": "Pilot episode", "vote_average": 9.0, "air_date": "2008-01-20"},
                {"id": 2, "name": "Cat's in the Bag...", "episode_number": 2, "still_path": None,
                 "overview": "Second episode", "vote_average": 8.5, "air_date": "2008-01-27"},
            ],
        }))
        authed_page.route(
            "**/api/episode-progress/1396/**",
            lambda r: fulfill_json(r, {"showId": 1396, "season": 1, "episode": 1}),
        )

        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("2 episodes")).to_be_visible(timeout=10_000)
        authed_page.get_by_text("2 episodes").click()
        expect(authed_page.get_by_text("Pilot")).to_be_visible(timeout=5_000)
        expect(authed_page.get_by_text("Hidden to avoid spoilers")).to_be_visible()
        expect(authed_page.get_by_role("switch", name="Hide spoilers")).to_be_checked()
        expect(authed_page.get_by_text("Cat's in the Bag...")).to_have_count(0)

        authed_page.get_by_text("Hidden to avoid spoilers").click()
        authed_page.get_by_role("button", name="Show details for episode 2").click()
        expect(authed_page.get_by_text("Cat's in the Bag...")).to_be_visible()
        expect(authed_page.get_by_text("Second episode")).to_be_visible()

    def test_tv_detail_episode_progress_section_visible(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        # No saved progress (base mock returns null): the tracker offers to start.
        expect(authed_page.get_by_role("button", name="Track episode progress")).to_be_visible(timeout=5_000)

    def test_tv_detail_watchlist_toggle_visible(self, authed_page: Page):
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.route("**/api/watchlist/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("button", name="Add to watchlist")).to_be_visible()

    def test_tv_detail_network_error_shows_fallback(self, authed_page: Page):
        authed_page.route("**/api/tmdb/tv/9999**", lambda r: r.fulfill(status=500, body="Server Error"))
        authed_page.goto("/tv/9999")
        expect(authed_page.get_by_text("Failed to load TV show details")).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_role("button", name="Retry")).to_be_visible()

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

        # exact: the "Progress saved: S02E01" toast also contains the substring.
        expect(authed_page.get_by_text("S02E01", exact=True)).to_be_visible(timeout=5_000)
        expect(authed_page.get_by_text("Progress saved: S02E01")).to_be_visible()
        assert posted == {"season": 2, "episode": 1}

    def test_tv_detail_episode_progress_save_failure_keeps_editor(self, authed_page: Page):
        # write-feedback spec: a failed save shows an error and leaves the editor
        # open with the chosen values, so the user can retry.
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.route(
            "**/api/episode-progress/1396/**",
            lambda r: (
                fulfill_json(r, None)
                if r.request.method == "GET"
                else r.fulfill(status=500, content_type="application/json", body="{}")
            ),
        )
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        authed_page.get_by_role("button", name="Track episode progress").click()
        authed_page.get_by_role("button", name="Next episode").click()
        authed_page.get_by_role("button", name="Next episode").click()
        authed_page.get_by_role("button", name="Save", exact=True).click()

        expect(authed_page.locator(".ant-message-error")).to_contain_text(
            "Failed to save episode progress.", timeout=5_000
        )
        expect(authed_page.locator(".ant-message-success")).to_have_count(0)
        # Still editing, still on episode 3.
        expect(authed_page.get_by_role("button", name="Next episode")).to_be_visible()
        stepper = authed_page.get_by_role("button", name="Previous episode").locator("xpath=following-sibling::*[1]")
        expect(stepper).to_have_text("3")

    def test_tv_detail_episode_stepper_buttons_have_names(self, authed_page: Page):
        # accessibility spec: the icon-only stepper buttons are announced by name.
        mock_tv_detail_routes(authed_page, 1396)
        authed_page.goto("/tv/1396")
        expect(authed_page.get_by_text("Breaking Bad")).to_be_visible(timeout=10_000)
        authed_page.get_by_role("button", name="Track episode progress").click()
        for name in ("Previous season", "Next season", "Previous episode", "Next episode"):
            expect(authed_page.get_by_role("button", name=name, exact=True)).to_be_visible()
