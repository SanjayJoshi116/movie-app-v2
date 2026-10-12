## ADDED Requirements

### Requirement: A failed next page stops auto-loading until the user retries
When an infinite-scrolling grid's request for its next page fails, the grid SHALL keep the results already shown, SHALL show an inline message with a Retry control at the end of the results, and SHALL NOT request that page again until the user activates Retry, however long the end of the grid stays in view. Activating Retry SHALL request the same page again. Changing the category or query SHALL clear the message.

#### Scenario: Next page fails while the end of the grid is visible
- **WHEN** the user scrolls to the end of a browse, people or search grid and the next-page request fails
- **THEN** exactly one request for that page is sent, the earlier results stay, and a "couldn't load more" message with Retry shows below them

#### Scenario: Retry after a failure
- **WHEN** the user activates Retry and the request succeeds
- **THEN** the next page's results are appended, the message disappears, and scrolling loads further pages again

#### Scenario: Query change after a failure
- **WHEN** a next-page request has failed and the user switches category or search query
- **THEN** the message is gone and the new results load normally
