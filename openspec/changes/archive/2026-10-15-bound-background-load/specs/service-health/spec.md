## ADDED Requirements

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
