# e2e-fixtures Specification

## Purpose

Defines how end-to-end tests stand in for the backend, so mocked responses look
like real API responses and a request a test forgot to mock is reported
clearly instead of silently changing what the test exercises.

## Requirements

### Requirement: Mocked list endpoints use the real response shape
Every e2e mock for a paginated API endpoint (watchlist, watched, ratings,
lists, followed people) SHALL return the same paginated shape as the real
API: `count`, `next`, `previous` and `results`.

#### Scenario: Empty watchlist mock
- **WHEN** an e2e test mocks an empty watchlist
- **THEN** the mocked response is a paginated object with an empty `results` list, not a bare array

### Requirement: Unmocked API calls fail the test with the URL
In every e2e test that renders an authenticated page, an app API request
(anything under `/api/` other than the TMDB proxy) that no test-specific mock
handles SHALL be answered with an "unmocked" error response, and the test
SHALL fail with a message naming each unmocked URL. An unmocked TMDB proxy
request (`/api/tmdb/...`) SHALL get a fixed empty result instead, so a test is
never affected by whether a real backend happens to be reachable.

#### Scenario: Forgotten mock
- **WHEN** a new page calls `/api/foo/` and an e2e test visits it without mocking that call
- **THEN** the test fails and its failure message includes `/api/foo/`

#### Scenario: Specific mock wins
- **WHEN** a test mocks `/api/watchlist/` itself
- **THEN** that mock answers the request, not the catch-all

#### Scenario: Unmocked TMDB call
- **WHEN** a test doesn't mock the hero banner's trending request
- **THEN** the request gets an empty result page, and the test isn't failed for it

### Requirement: App-wide background calls are mocked in every base fixture
Every e2e base fixture for authenticated pages SHALL mock each API call the app
makes on every authenticated page (library loads, notifications poll,
notifications mark-seen), matching any query string the app appends.

#### Scenario: Notification bell
- **WHEN** an authenticated e2e test opens and closes the notification bell
- **THEN** both the poll and the mark-seen request are answered by base-fixture mocks

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
