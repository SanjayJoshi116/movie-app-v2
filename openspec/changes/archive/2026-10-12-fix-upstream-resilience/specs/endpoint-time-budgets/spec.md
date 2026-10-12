## Purpose

Keeps every API request that waits on TMDB inside a fixed time budget below the server's request timeout, so a slow TMDB yields a partial or fallback answer instead of a killed server worker.

## ADDED Requirements

### Requirement: Followed-people recommendations respond within a bounded time
The followed-people recommendations endpoint SHALL respond within a fixed time budget that is shorter than the server's request timeout, however slow TMDB is. People whose credits haven't arrived by the deadline SHALL be left out of that response, and credits that did arrive SHALL be cached as they arrive.

#### Scenario: Slow TMDB
- **WHEN** every TMDB credits request takes the full request timeout to answer
- **THEN** the endpoint still responds within its budget, without the server killing the request

#### Scenario: Budget reached mid-batch
- **WHEN** some followed people's credits arrive before the deadline and others don't
- **THEN** the response has sections for the people whose credits arrived, and the next call doesn't fetch those people again

### Requirement: Stats respond within a bounded time
The stats endpoint SHALL respond within a fixed time budget that is shorter than the server's request timeout, even when its genre-name lookup has to reach a slow or unreachable TMDB. When the lookup fails, genres SHALL be named from a built-in list, and the endpoint SHALL try TMDB again within minutes rather than keep the built-in names for the full cache period.

#### Scenario: TMDB unreachable on a cold cache
- **WHEN** the stats endpoint needs genre names and every TMDB request times out
- **THEN** the endpoint responds within its budget, with genres named from the built-in list

#### Scenario: TMDB recovers
- **WHEN** a stats request fell back to the built-in genre names and TMDB is reachable again a few minutes later
- **THEN** a later stats request fetches the genre names from TMDB again
