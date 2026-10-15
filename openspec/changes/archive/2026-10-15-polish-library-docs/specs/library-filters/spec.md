## ADDED Requirements

### Requirement: The Watchlist paginates
The Watchlist SHALL show its titles a page at a time, with the page and page size in the address like Watched, so reload and Back keep them. Changing the search, sort or a filter SHALL return to the first page. When the current page has no items, because titles were removed or a filter narrowed the results, the page SHALL move to the last page that has items.

#### Scenario: Large watchlist
- **WHEN** a user with 300 titles in their watchlist opens it
- **THEN** one page of titles is shown with page controls, not all 300 cards

#### Scenario: Remove the last item on the last page
- **WHEN** the user is on the last Watchlist page, which has one title, and removes it
- **THEN** the previous page is shown with its titles
