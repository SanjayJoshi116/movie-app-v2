## MODIFIED Requirements

### Requirement: A library filter whose data failed to load says so
When a library page's active filter depends on another collection (the Watchlist's Watched/Unwatched filter on the watched history), the page SHALL NOT show a grid filtered on data it doesn't have, nor that filter's empty state. While that collection hasn't loaded yet in this session, the page SHALL show its loading state, including while a retry of a failed load is running. When that collection failed to load, has never loaded in this session and isn't loading, the page SHALL show that failure with a Retry control in place of the item grid. When a later reload of that collection fails after a successful load, the page SHALL keep showing the grid filtered on the data already loaded. Turning the filter off SHALL show the grid again without a retry.

#### Scenario: Watched filter with a failed watched history
- **WHEN** the user opens the Watchlist with the "Watched" filter on, the watchlist loads and the watched-history request fails
- **THEN** the page shows an error with Retry instead of the grid, and doesn't show "No items match your filters."

#### Scenario: Retry succeeds
- **WHEN** the user activates that Retry and the watched history then loads
- **THEN** the filtered grid is shown, on the page in the address if it has items

#### Scenario: Retry in progress
- **WHEN** the user activates that Retry and the watched-history request is still pending
- **THEN** the page shows its loading placeholder instead of the error, and shows the error again only if that retry fails

#### Scenario: Filter turned off
- **WHEN** the user switches the filter to "All" while the watched history is still failed
- **THEN** the full watchlist grid is shown

#### Scenario: Watched history still loading
- **WHEN** the user opens the Watchlist with the "Unwatched" filter on and the watchlist loads before the watched history
- **THEN** the page shows its loading placeholder, not every title and not "No items match your filters.", until the watched history arrives

#### Scenario: Background reload of the watched history fails
- **WHEN** the watched history loaded, the "Watched" filter shows 3 titles, and a later reload of the watched history fails
- **THEN** the same 3 titles stay shown, and the error with Retry isn't shown in their place
