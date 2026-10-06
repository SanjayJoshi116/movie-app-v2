## Purpose

Makes every data load in the UI end in a visible, honest state, so the user can tell "nothing here" apart from "still loading" and "failed to load", and never sees data that belongs to a different entity or query.

## ADDED Requirements

### Requirement: Library collections distinguish loading, failure and empty
The watchlist, watched history, ratings and lists collections SHALL report whether they are loading, failed to load, or loaded. When an authenticated user's collection hasn't finished its first load, it SHALL count as loading, not as loaded and empty. A failed load SHALL be recorded as an error that the user can retry. It SHALL NOT be shown as an empty collection.

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

### Requirement: Paginated grids show only the current query's results
Browse, search and people grids that load page by page SHALL show only results for the current category or query. Changing the category or query SHALL clear the previous results. A first page that fails to load SHALL show an error with Retry. A page response that arrives for an earlier category or query SHALL be discarded.

#### Scenario: Category switch
- **WHEN** the user switches from one browse category to another
- **THEN** the previous category's cards are removed and a loading state shows until the new category's first page arrives

#### Scenario: First page fails
- **WHEN** the first page for the new category or query fails to load
- **THEN** the grid shows an error with a Retry control instead of the previous results or an empty grid

#### Scenario: Stale load-more response
- **WHEN** a "load more" request is in flight and the user changes the query before it responds
- **THEN** that response is not appended to the new query's results and doesn't change its paging state

#### Scenario: Restored grid
- **WHEN** the user navigates back to a grid whose results and scroll position are restored
- **THEN** the restored results are shown without being cleared

### Requirement: Stats failure is not shown as an empty history
The Stats page SHALL show an error with Retry when its data request fails. The "start watching" empty state SHALL appear only when the request succeeds and reports zero watched titles.

#### Scenario: Stats request fails
- **WHEN** the stats request fails
- **THEN** the page shows an error with a Retry control

#### Scenario: No watched titles
- **WHEN** the stats request succeeds with zero watched titles
- **THEN** the page shows the "start watching" empty state

### Requirement: Detail pages degrade per section
Movie and TV detail pages SHALL treat only the title's main details as essential. When a secondary request fails (reviews, similar titles, watch providers, release dates, credits, images), only that section SHALL render empty or hidden, and the rest of the page SHALL render normally. When the main details request returns 404, the page SHALL show a "not found" state. Any other failure of the main request SHALL show an error with a Retry control that refetches without reloading the browser page.

#### Scenario: Reviews request fails
- **WHEN** the movie details request succeeds and the reviews request fails
- **THEN** the page renders the movie with its other sections, and the reviews section is empty

#### Scenario: Unknown title id
- **WHEN** the user opens a movie or TV id that TMDB reports as not found
- **THEN** the page shows a "not found" state, not the generic error

#### Scenario: Main request fails transiently
- **WHEN** the main details request fails with a network error or 5xx and the user activates Retry
- **THEN** the details are fetched again without a full browser reload

### Requirement: Person page shows only the requested person
The person page SHALL show a "not found" state for an unknown person id and an error with Retry for other failures. It SHALL NOT show a blank page. When the person id changes, data from the previous person SHALL NOT be displayed, and responses for a previous id SHALL be ignored. A title the person is credited on more than once SHALL appear once, with its roles combined.

#### Scenario: Unknown person id
- **WHEN** the user opens a person id that TMDB reports as not found
- **THEN** the page shows a "not found" state

#### Scenario: Navigating between people
- **WHEN** the user navigates from one person to another and the first person's request responds late
- **THEN** only the second person's data is shown

#### Scenario: Multiple roles in one title
- **WHEN** a person has two cast credits in the same title
- **THEN** that title appears once in their credits grid, with both roles in its subtitle

### Requirement: Episode guide season loading always settles
Each season in the episode guide SHALL end in a loaded or failed state. Switching to an already-loaded season SHALL show it immediately, even while another season's request is in flight. A failed season load SHALL show an error with Retry.

#### Scenario: Switch back to a cached season mid-load
- **WHEN** season 2 is loading and the user switches back to season 1, which already loaded
- **THEN** season 1's episodes show immediately and no loading skeleton stays on screen

#### Scenario: Season load fails
- **WHEN** a season's episodes request fails
- **THEN** the guide shows an error with a Retry control for that season

### Requirement: Episode progress belongs to the displayed show
A show's episode progress SHALL reset when the show changes. A progress response for a previously displayed show SHALL be ignored.

#### Scenario: Navigating between shows
- **WHEN** the user navigates from one TV show to another
- **THEN** the first show's episode progress isn't shown on the second show's page, including while the second show's progress is loading
