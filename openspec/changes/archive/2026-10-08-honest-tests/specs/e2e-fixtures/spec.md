## ADDED Requirements

### Requirement: Mocked records use the API's field names
Every e2e mock record standing in for an API resource (user, watchlist entry, watched entry, rating, stats) SHALL carry the field names the API actually returns for that resource, with values in the formats the API uses. It SHALL NOT carry fields the API no longer sends. An automated check SHALL fail when a mock record's fields differ from the API's.

#### Scenario: Serializer gains a field
- **WHEN** a field is added to or removed from the watched-entry API response and the e2e watched mock isn't updated
- **THEN** the test suite fails, naming the mock and the differing fields

#### Scenario: Stats month format
- **WHEN** an e2e test renders the stats page from the shared stats mock
- **THEN** the mocked monthly activity uses the same month label format as the API, and the page shows no `NaN`

### Requirement: E2E assertions cannot pass without checking anything
An e2e test SHALL NOT make an assertion conditional on whether an element exists at that instant. It SHALL wait for the state it checks rather than sleep for a fixed time. An assertion that something is absent, empty or zero SHALL only run after the page has finished loading the data it depends on. A test that checks an error state SHALL assert the visible error UI, not merely that the page rendered.

#### Scenario: Slow render
- **WHEN** the element a test checks renders later than usual
- **THEN** the test waits for it and either passes on its real content or fails, and is never skipped silently

#### Scenario: Empty result asserted during loading
- **WHEN** a test asserts that a search shows no results, and the results request is still in flight
- **THEN** the assertion doesn't run until loading has finished

#### Scenario: Network error test
- **WHEN** a detail-page test makes the data request fail
- **THEN** it asserts the error message and its Retry button are shown
