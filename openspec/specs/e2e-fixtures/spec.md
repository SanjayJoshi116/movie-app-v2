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
