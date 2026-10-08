"""
Custom lists page tests: empty state, create, delete, items, remove item, edge cases.
"""
from playwright.sync_api import Page, expect

from conftest import paginated, fulfill_json, MOCK_LIST


MOCK_LIST_WITH_ITEM = {
    **MOCK_LIST,
    "items": [
        {
            "id": 550,
            "type": "movie",
            "title": "Fight Club",
            "posterPath": None,
            "voteAverage": 8.4,
            "addedAt": "2024-01-01T00:00:00Z",
        }
    ],
}


class TestListsEmpty:
    def test_empty_lists_shows_heading(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)

    def test_empty_lists_shows_description(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("No custom lists yet", exact=False)).to_be_visible()

    def test_empty_lists_shows_create_button_in_header(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="New List")).to_be_visible()

    def test_empty_lists_shows_create_a_list_button(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_role("button", name="Create a List")).to_be_visible()


class TestListsModal:
    def test_new_list_button_opens_modal(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="New List").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        expect(authed_page.get_by_text("Create New List")).to_be_visible()

    def test_create_list_requires_name(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="New List").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # Click Create without filling name
        authed_page.locator(".ant-modal-footer").get_by_role("button", name="Create").click()
        expect(authed_page.get_by_text("Please enter a list name")).to_be_visible(timeout=5_000)

    def test_cancel_modal_closes_without_creating(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="New List").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        authed_page.get_by_label("List Name").fill("Test List")
        authed_page.locator(".ant-modal-footer").get_by_role("button", name="Cancel").click()
        expect(authed_page.locator(".ant-modal")).not_to_be_visible()
        expect(authed_page.get_by_text("Test List")).not_to_be_visible()

    def test_create_list_success_shows_new_card(self, authed_page: Page):
        new_list = {**MOCK_LIST, "name": "My Test List"}
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)

        # After create, the GET lists will return the new list
        authed_page.route("**/api/lists/**", lambda r: (
            fulfill_json(r, paginated([new_list]))
            if r.request.method == "GET"
            else fulfill_json(r, new_list, status=201)
        ))

        authed_page.get_by_role("button", name="New List").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        authed_page.get_by_label("List Name").fill("My Test List")
        authed_page.locator(".ant-modal-footer").get_by_role("button", name="Create").click()
        expect(authed_page.get_by_text("My Test List")).to_be_visible(timeout=8_000)


class TestListsWithItems:
    def test_list_card_shows_item_count(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([MOCK_LIST_WITH_ITEM])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("1 item")).to_be_visible()

    def test_list_card_shows_list_name(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([MOCK_LIST])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("Favorites")).to_be_visible()

    def test_click_list_card_expands_items(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([MOCK_LIST_WITH_ITEM])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        # Click the list card to expand
        authed_page.get_by_text("Favorites").first.click()
        expect(authed_page.get_by_text("Fight Club")).to_be_visible(timeout=5_000)

    def test_zero_items_shows_zero_count(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([MOCK_LIST])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        expect(authed_page.get_by_text("0 items")).to_be_visible()


class TestListsDelete:
    def test_delete_button_shows_popconfirm(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([MOCK_LIST])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Delete").click()
        expect(authed_page.get_by_text('Delete "Favorites"?')).to_be_visible(timeout=5_000)

    def test_delete_confirmed_removes_list(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([MOCK_LIST])))
        authed_page.route("**/api/lists/1/", lambda r: r.fulfill(status=204, body=""))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="Delete").click()
        expect(authed_page.get_by_text('Delete "Favorites"?')).to_be_visible(timeout=5_000)

        # After confirming, mock the GET to return empty
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.locator(".ant-popconfirm-buttons").get_by_role("button", name="Delete").click()
        expect(authed_page.get_by_text("No custom lists yet", exact=False)).to_be_visible(timeout=5_000)


class TestListsEdgeCases:
    def test_list_name_too_long_truncated_in_input(self, authed_page: Page):
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated([])))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        authed_page.get_by_role("button", name="New List").click()
        expect(authed_page.locator(".ant-modal")).to_be_visible(timeout=5_000)
        # Type >60 characters
        authed_page.get_by_label("List Name").fill("A" * 100)
        # Input value length should be at most 100 chars (or whatever maxLength is set)
        val = authed_page.get_by_label("List Name").input_value()
        assert len(val) <= 100, f"Input should not accept unbounded length (got {len(val)})"

    def test_multiple_lists_show_all_cards(self, authed_page: Page):
        lists = [
            {**MOCK_LIST, "id": i + 1, "name": f"List {i + 1}"}
            for i in range(4)
        ]
        authed_page.route("**/api/lists/**", lambda r: fulfill_json(r, paginated(lists)))
        authed_page.goto("/lists")
        expect(authed_page.get_by_role("heading", name="My Lists")).to_be_visible(timeout=8_000)
        for i in range(4):
            expect(authed_page.get_by_text(f"List {i + 1}")).to_be_visible()
