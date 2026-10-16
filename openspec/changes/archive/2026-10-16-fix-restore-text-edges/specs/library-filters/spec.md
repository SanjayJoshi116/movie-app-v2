## MODIFIED Requirements

### Requirement: The Watchlist paginates
The Watchlist SHALL show its titles a page at a time, with the page and page size in the address like Watched, so reload and Back keep them. Changing the search, sort or a filter SHALL return to the first page. When the current page has no items, because titles were removed or a filter narrowed the results, the page SHALL move to the last page that has items. That move SHALL wait until everything the active filters depend on has loaded (the watched history, when the Watched/Unwatched filter is on), including any reload of that data in progress, and SHALL NOT happen while that data failed to load.

#### Scenario: Large watchlist
- **WHEN** a user with 300 titles in their watchlist opens it
- **THEN** one page of titles is shown with page controls, not all 300 cards

#### Scenario: Remove the last item on the last page
- **WHEN** the user is on the last Watchlist page, which has one title, and removes it
- **THEN** the previous page is shown with its titles

#### Scenario: Deep link with the watched filter on
- **WHEN** the user reloads `/watchlist?page=3` with the "Watched" filter on, enough watched titles for three pages, and the watchlist loads before the watched history
- **THEN** page 3 is shown once the watched history loads, and the address still says page 3

#### Scenario: Watched history reloading
- **WHEN** the user is on `/watchlist?page=3` with the "Watched" filter on, and the watched history is reloading after an import that added watched titles
- **THEN** the page stays on page 3 until the reload finishes, and moves only if page 3 is still empty after it
