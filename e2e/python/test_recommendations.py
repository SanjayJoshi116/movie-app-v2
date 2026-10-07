"""
For You (recommendations) page: a failed load offers Retry that refetches in place.
"""
from playwright.sync_api import Page, expect

from conftest import paginated, fulfill_json, MOCK_WATCHED_ITEM

REC_SECTION = {
    "key": "because-550",
    "label": "Because you watched Fight Club",
    "items": [
        {"id": 807, "type": "movie", "title": "Se7en", "posterPath": None, "voteAverage": 8.4},
    ],
}


def _mock_recommendations(page: Page, state: dict) -> None:
    def for_you(r):
        if state["fail"]:
            r.fulfill(status=500, content_type="application/json", body='{"detail": "Server error"}')
        else:
            fulfill_json(r, {"status": "ready", "sections": [REC_SECTION]})

    def personalized(r):
        if state["fail"]:
            r.fulfill(status=500, content_type="application/json", body='{"detail": "Server error"}')
        else:
            fulfill_json(r, {"status": "ready", "sections": []})

    def followed(r):
        if state["fail"]:
            r.fulfill(status=500, content_type="application/json", body='{"detail": "Server error"}')
        else:
            fulfill_json(r, [])

    page.route("**/api/recommendations/for-you/**", for_you)
    page.route("**/api/recommendations/personalized/**", personalized)
    page.route("**/api/recommendations/followed-people/**", followed)


class TestRecommendationsRetry:
    def test_failed_load_shows_error_with_retry(self, authed_page: Page):
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        _mock_recommendations(authed_page, {"fail": True})
        authed_page.goto("/recommendations")
        expect(authed_page.get_by_text("Couldn't load recommendations")).to_be_visible(timeout=15_000)
        expect(authed_page.get_by_role("button", name="Retry")).to_be_visible()
        expect(authed_page.get_by_text("No recommendations found", exact=False)).to_have_count(0)

    def test_retry_refetches_in_place_without_reload(self, authed_page: Page):
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        state = {"fail": True}
        _mock_recommendations(authed_page, state)
        authed_page.goto("/recommendations")
        expect(authed_page.get_by_text("Couldn't load recommendations")).to_be_visible(timeout=15_000)

        # A full page reload would wipe this marker.
        authed_page.evaluate("window.__noReload = true")
        state["fail"] = False
        authed_page.get_by_role("button", name="Retry").click()

        expect(authed_page.get_by_text(REC_SECTION["label"])).to_be_visible(timeout=10_000)
        expect(authed_page.get_by_text("Se7en")).to_be_visible()
        expect(authed_page.get_by_text("Couldn't load recommendations")).to_have_count(0)
        assert authed_page.evaluate("window.__noReload === true")

    def test_retry_that_fails_again_shows_error_again(self, authed_page: Page):
        authed_page.route("**/api/watched/**", lambda r: fulfill_json(r, paginated([MOCK_WATCHED_ITEM])))
        _mock_recommendations(authed_page, {"fail": True})
        authed_page.goto("/recommendations")
        expect(authed_page.get_by_text("Couldn't load recommendations")).to_be_visible(timeout=15_000)
        authed_page.evaluate("window.__noReload = true")
        authed_page.get_by_role("button", name="Retry").click()
        expect(authed_page.get_by_text("Couldn't load recommendations")).to_be_visible(timeout=15_000)
        expect(authed_page.get_by_role("button", name="Retry")).to_be_visible()
        assert authed_page.evaluate("window.__noReload === true")
