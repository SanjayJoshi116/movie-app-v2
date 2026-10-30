# endpoint-time-budgets Specification

## Purpose

Keeps every API request that waits on TMDB inside a fixed time budget below the server's request timeout, so a slow TMDB yields a partial or fallback answer instead of a killed server worker.

## Requirements

### Requirement: Followed-people recommendations respond within a bounded time
The followed-people recommendations endpoint SHALL respond within a fixed time budget that is shorter than the server's request timeout, however slow TMDB is. People whose credits haven't arrived by the deadline SHALL be left out of that response, and credits that did arrive SHALL be cached as they arrive.

#### Scenario: Slow TMDB
- **WHEN** every TMDB credits request takes the full request timeout to answer
- **THEN** the endpoint still responds within its budget, without the server killing the request

#### Scenario: Budget reached mid-batch
- **WHEN** some followed people's credits arrive before the deadline and others don't
- **THEN** the response has sections for the people whose credits arrived, and the next call doesn't fetch those people again

### Requirement: Stats respond within a bounded time
The stats endpoint SHALL respond within a fixed time budget that is shorter than the server's request timeout, even when its genre-name lookup has to reach a slow or unreachable TMDB, and however many network addresses TMDB's host name resolves to. When the lookup fails, genres SHALL be named from a built-in list, and the endpoint SHALL try TMDB again within minutes rather than keep the built-in names for the full cache period.

#### Scenario: TMDB unreachable on a cold cache
- **WHEN** the stats endpoint needs genre names and every TMDB request times out
- **THEN** the endpoint responds within its budget, with genres named from the built-in list

#### Scenario: TMDB recovers
- **WHEN** a stats request fell back to the built-in genre names and TMDB is reachable again a few minutes later
- **THEN** a later stats request fetches the genre names from TMDB again

#### Scenario: Connection attempts hang on every address
- **WHEN** the stats endpoint needs genre names and connection attempts to every address of TMDB's host hang
- **THEN** the endpoint still responds within its budget, with genres named from the built-in list

### Requirement: Followed-people recommendations are rate limited per user
The followed-people recommendations endpoint, which can wait on several TMDB calls per request, SHALL have its own per-user rate limit in addition to its time budget. A request over the limit SHALL get `429` without contacting TMDB.

#### Scenario: Rapid repeated calls
- **WHEN** a signed-in user calls followed-people recommendations more often than the endpoint's limit allows
- **THEN** the extra calls get `429`, and no TMDB requests are made for them

#### Scenario: Two users
- **WHEN** one user is over the limit
- **THEN** another user's calls still succeed

### Requirement: Connecting a TMDB account responds within a bounded time
Starting a TMDB connection (requesting a token) and completing it (creating a session) SHALL each respond within a fixed time budget shorter than the server's request timeout, however slow or unreachable TMDB is. When TMDB doesn't answer in time, the endpoint SHALL return its "Couldn't reach TMDB" error (`502`), and no new session SHALL be stored.

#### Scenario: TMDB hangs while creating the session
- **WHEN** a user completes a TMDB connection and TMDB never answers the create-session request
- **THEN** the endpoint returns `502` with "Couldn't reach TMDB. Try again." before the server's request timeout, and the user's stored TMDB session is unchanged

#### Scenario: TMDB hangs while issuing a token
- **WHEN** a user starts a TMDB connection and TMDB never answers the token request
- **THEN** the endpoint returns `502` within its budget

### Requirement: A stalled TMDB proxy can't take other endpoints' time
TMDB proxy calls SHALL run on capacity of their own, separate from the TMDB calls other endpoints wait on (rating sync, TMDB connect, Stats' genre lookup). Proxy calls left running after their deadline SHALL only ever delay other proxy calls, so those endpoints keep their full time budget while TMDB is slow for the proxy.

#### Scenario: Proxy calls stall
- **WHEN** TMDB stops answering proxied requests and enough of them are in flight to fill the proxy's capacity, and a user then changes a rating with TMDB sync on
- **THEN** the rating's TMDB sync starts at once, within its own deadline, instead of waiting behind the stalled proxy calls
