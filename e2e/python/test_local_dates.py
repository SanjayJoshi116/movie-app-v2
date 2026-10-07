"""
Local dates: the app sends the device's time zone, and the Watched page shows
each watch's day in the zone it was logged in (labelled when that differs).
Every test here runs in a browser whose time zone is Europe/London.
"""
import pytest
from playwright.sync_api import Page, expect

from conftest import fulfill_json, paginated

# 19:30 UTC on 6 Oct 2026: 01:00 on the 7th in Kolkata, 20:30 on the 6th in London.
INSTANT = "2026-10-06T19:30:00Z"


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {**browser_context_args, "timezone_id": "Europe/London"}


def watched(media_id, title, tz):
    return {
        "id": media_id, "mediaId": media_id, "mediaType": "movie", "title": title,
        "posterPath": None, "voteAverage": 7.0, "watchedAt": INSTANT, "watchedTz": tz,
    }


def card(page: Page, title: str):
    return page.locator(".ant-card").filter(has_text=title)


class TestWatchedPageDates:
    def test_dates_use_logged_zone_and_label_only_when_different(self, authed_page: Page):
        sent_zones = []

        def watched_route(route):
            sent_zones.append(route.request.headers.get("x-timezone"))
            fulfill_json(route, paginated([
                watched(1, "Logged In Kolkata", "Asia/Kolkata"),
                watched(2, "Logged In London", "Europe/London"),
                watched(3, "Logged Via Alias", "Europe/Belfast"),  # alias of Europe/London
                watched(4, "Logged Before Zones", ""),
            ]))

        authed_page.route("**/api/watched/**", watched_route)
        authed_page.goto("/watched")

        expect(card(authed_page, "Logged In Kolkata")).to_contain_text("07-10-2026 · GMT+5:30", timeout=10_000)
        for title in ("Logged In London", "Logged Via Alias", "Logged Before Zones"):
            item = card(authed_page, title)
            expect(item).to_contain_text("06-10-2026")
            expect(item).not_to_contain_text("·")

        assert sent_zones and all(z == "Europe/London" for z in sent_zones), sent_zones
