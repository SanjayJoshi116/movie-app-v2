## MODIFIED Requirements

### Requirement: Library collections distinguish loading, failure and empty
The watchlist, watched history, ratings and lists collections SHALL report whether they are loading, failed to load, or loaded. When an authenticated user's collection hasn't finished its first load for the current session, it SHALL count as loading, not as loaded and empty, from the first render after sign-in. A failed load SHALL be recorded as an error that the user can retry. It SHALL NOT be shown as an empty collection.

#### Scenario: First render before data arrives
- **WHEN** an authenticated user opens the Watchlist page and the watchlist request hasn't completed
- **THEN** the page shows a loading placeholder and doesn't show the empty-state call to action

#### Scenario: Load fails
- **WHEN** the watched-history request fails with a network error or 5xx
- **THEN** the Watched page shows an error message with a Retry control, and doesn't show the "nothing watched yet" empty state

#### Scenario: Retry after failure
- **WHEN** the user activates Retry after a failed library load and the request then succeeds
- **THEN** the page shows the loaded items (or the empty state, if there are none)

#### Scenario: Genuinely empty collection
- **WHEN** the watchlist request succeeds and returns zero items
- **THEN** the Watchlist page shows its empty-state call to action

#### Scenario: List detail before lists load
- **WHEN** a user opens a list's detail page and the lists haven't loaded yet
- **THEN** the page shows a loading placeholder, not "List not found."

#### Scenario: Background refresh fails after a successful load
- **WHEN** a collection already loaded successfully and a later reload of it fails
- **THEN** the items already shown stay visible and the user sees an error notification

#### Scenario: Signing in on a deep page
- **WHEN** a signed-out user opens `/watched?page=3`, signs in, and returns there, and their history has more than two pages
- **THEN** the page stays on page 3, and the empty state is never shown while the history loads

### Requirement: A failed next page stops auto-loading until the user retries
When an infinite-scrolling grid's request for its next page fails, the grid SHALL keep the results already shown, SHALL show an inline message with a Retry control at the end of the results, and SHALL NOT request that page again until the user activates Retry, however long the end of the grid stays in view. Activating Retry SHALL request the same page again. Changing the category or query SHALL clear the message. When the first page fails, the grid SHALL request no further pages, whatever is in view, until a retry of the first page succeeds.

#### Scenario: Next page fails while the end of the grid is visible
- **WHEN** the user scrolls to the end of a browse, people or search grid and the next-page request fails
- **THEN** exactly one request for that page is sent, the earlier results stay, and a "couldn't load more" message with Retry shows below them

#### Scenario: Retry after a failure
- **WHEN** the user activates Retry and the request succeeds
- **THEN** the next page's results are appended, the message disappears, and scrolling loads further pages again

#### Scenario: Query change after a failure
- **WHEN** a next-page request has failed and the user switches category or search query
- **THEN** the message is gone and the new results load normally

#### Scenario: First page fails on Home
- **WHEN** the first page of a Home or Anime category fails to load
- **THEN** the page shows its load error, and no request for any other page is sent while it does

#### Scenario: Category change whose first page fails
- **WHEN** the user has loaded five pages of one Home category, switches to another, and that category's first page fails
- **THEN** no request for page 6 (or any other page) of either category is sent
