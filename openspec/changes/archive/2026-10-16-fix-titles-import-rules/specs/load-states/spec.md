## ADDED Requirements

### Requirement: A library filter whose data failed to load says so
When a library page's active filter depends on another collection that failed to load (the Watchlist's Watched/Unwatched filter on the watched history), the page SHALL show that failure with a Retry control in place of the item grid. It SHALL NOT show a grid filtered on the missing data, nor that filter's empty state. Turning the filter off SHALL show the grid again without a retry.

#### Scenario: Watched filter with a failed watched history
- **WHEN** the user opens the Watchlist with the "Watched" filter on, the watchlist loads and the watched-history request fails
- **THEN** the page shows an error with Retry instead of the grid, and doesn't show "No items match your filters."

#### Scenario: Retry succeeds
- **WHEN** the user activates that Retry and the watched history then loads
- **THEN** the filtered grid is shown, on the page in the address if it has items

#### Scenario: Filter turned off
- **WHEN** the user switches the filter to "All" while the watched history is still failed
- **THEN** the full watchlist grid is shown
