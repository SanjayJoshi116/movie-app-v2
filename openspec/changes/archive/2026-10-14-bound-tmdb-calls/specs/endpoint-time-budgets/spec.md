## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Connecting a TMDB account responds within a bounded time
Starting a TMDB connection (requesting a token) and completing it (creating a session) SHALL each respond within a fixed time budget shorter than the server's request timeout, however slow or unreachable TMDB is. When TMDB doesn't answer in time, the endpoint SHALL return its "Couldn't reach TMDB" error (`502`), and no new session SHALL be stored.

#### Scenario: TMDB hangs while creating the session
- **WHEN** a user completes a TMDB connection and TMDB never answers the create-session request
- **THEN** the endpoint returns `502` with "Couldn't reach TMDB. Try again." before the server's request timeout, and the user's stored TMDB session is unchanged

#### Scenario: TMDB hangs while issuing a token
- **WHEN** a user starts a TMDB connection and TMDB never answers the token request
- **THEN** the endpoint returns `502` within its budget
