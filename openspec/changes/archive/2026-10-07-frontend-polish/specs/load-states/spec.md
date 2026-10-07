## ADDED Requirements

### Requirement: Recommendations failure retries in place
When the For You page fails to load recommendations and has nothing to show,
it SHALL show an error with a Retry control. Retry SHALL refetch the
recommendations in place and show the loading state while it does. It SHALL NOT
reload the browser tab, so the rest of the app's in-memory state (search term,
filters, other pages' caches) survives.

#### Scenario: Retry after a failed load
- **WHEN** the recommendations requests fail and the user presses Retry
- **THEN** the page shows its loading state, requests recommendations again without a full page reload, and shows them if the new requests succeed

#### Scenario: Retry fails again
- **WHEN** the user presses Retry and the requests fail again
- **THEN** the error with Retry is shown again
