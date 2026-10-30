# service-health Specification

## Purpose

Guarantees that the backend's liveness signal stays accurate under continuous orchestrator polling and that the service always reaches a serving state even when best-effort pre-warm work fails or hangs.

## Requirements

### Requirement: Health endpoint is never rate-limited
The health endpoint (`GET /api/health/`) SHALL respond `200` with `{"status": "ok"}` to every request from a running, database-connected service, no matter how often or by whom it is called. It SHALL NOT be subject to any anonymous, per-user, or scoped request throttle.

#### Scenario: Sustained orchestrator polling
- **WHEN** the health endpoint is called more times than the anonymous daily throttle rate allows, from the same client address
- **THEN** every call returns `200`, and none returns `429`

#### Scenario: Health polling does not consume other throttle budgets
- **WHEN** a client calls the health endpoint repeatedly and then calls another anonymous endpoint
- **THEN** the second endpoint's throttle allowance is unaffected by the health calls

### Requirement: Best-effort pre-warm work cannot block startup
In every supported startup path (local `start.py` and the Docker entrypoint), the recommendation cache warm-up step SHALL be bounded to at most 30 seconds. If it fails, errors, or exceeds that bound, startup SHALL continue to the application server without failing.

#### Scenario: TMDB hangs during container start
- **WHEN** the container starts and the recommendation warm-up does not finish within 30 seconds
- **THEN** the warm-up is stopped, a message saying it was skipped is logged, and the application server starts and begins accepting requests

#### Scenario: Warm-up errors out
- **WHEN** the recommendation warm-up exits with a non-zero status
- **THEN** the application server still starts

### Requirement: Unhandled server errors are logged in production
With debug mode off, an unhandled exception while serving a request SHALL produce a server log entry that includes the request path and the exception traceback. Routine client-error responses (4xx) SHALL NOT produce log entries.

#### Scenario: Production 500
- **WHEN** debug mode is off and a view raises an unhandled exception
- **THEN** the API returns 500 and the server log has an ERROR entry with the path and traceback

#### Scenario: Expected 4xx is quiet
- **WHEN** a client gets a 401 on an expired token or a 404 for an unknown id
- **THEN** no log entry is written for that response

### Requirement: The startup warm-up spends its time on users who need it
The recommendation warm-up SHALL skip users whose stored recommendations are still fresh, and SHALL warm the remaining users with watch history oldest first: users with no stored recommendations, then the oldest stored results.

#### Scenario: Restart with mostly fresh users
- **WHEN** the server restarts and most users' recommendations were computed an hour ago
- **THEN** the warm-up makes no TMDB requests for those users

#### Scenario: Warm-up cut short
- **WHEN** the warm-up is stopped at its time bound after warming some users
- **THEN** the users it warmed were the ones with no stored recommendations or the oldest ones, and the next restart continues with the next oldest

### Requirement: Slow TMDB answers don't block the rest of the API
In production, requests waiting on TMDB SHALL NOT keep the server from answering other requests. The server SHALL handle many concurrent requests per process, enough that several requests each waiting the full TMDB budget leave sign-in, library loads and the health check answering normally. Each request's own TMDB wait stays bounded by its endpoint's budget.

#### Scenario: TMDB slowdown
- **WHEN** TMDB stops answering and five users open movie pages at once, each proxy request waiting up to its 20 s budget
- **THEN** another user can still sign in and load their watchlist without waiting for those requests

### Requirement: Expired session records are cleaned up at startup
Every backend start, in the Docker entrypoint and in the local `start.py`, SHALL remove session-token records that have expired. The step SHALL be best-effort and time-bounded: if it fails or runs too long, startup SHALL continue to the application server. Records for sessions that haven't expired SHALL be kept, so no signed-in user is signed out by it.

#### Scenario: Restart after weeks of use
- **WHEN** the backend restarts with thousands of expired token records stored
- **THEN** the expired records are deleted and every unexpired session keeps working

#### Scenario: Cleanup fails
- **WHEN** the cleanup step errors or exceeds its time bound
- **THEN** a message says it was skipped and the application server starts as usual

### Requirement: Unused title-cache rows are cleaned up at startup
Every backend start, in the Docker entrypoint and in the local `start.py`, SHALL delete cached title details that are past their refresh age and belong to no title in any user's watched history. The step SHALL be best-effort and time-bounded: if it fails or runs too long, startup SHALL continue to the application server. Cached details for watched titles SHALL be kept, whatever their age.

#### Scenario: Restart with stale, unwatched cache rows
- **WHEN** the backend restarts with cached details for titles nobody has watched that are past their refresh age, and stale details for a title someone has watched
- **THEN** the unwatched titles' rows are deleted and the watched title's row is kept

#### Scenario: Recent rows are kept
- **WHEN** the backend restarts with cached details for an unwatched title fetched within its refresh age
- **THEN** that row is kept

#### Scenario: Cleanup fails
- **WHEN** the cleanup step errors or exceeds its time bound
- **THEN** a message says it was skipped and the application server starts as usual
