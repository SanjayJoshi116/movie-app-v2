## ADDED Requirements

### Requirement: The startup warm-up honours the refresh backoff
The recommendation warm-up that runs at server start SHALL treat a refused result the way a background refresh does: when a user's result is not stored because TMDB requests failed, that user enters the same 10-minute failure backoff. The warm-up SHALL skip users who are already in that backoff.

#### Scenario: TMDB down during the warm-up
- **WHEN** the server starts while TMDB is failing and the warm-up's result for a user with stale recommendations is refused
- **THEN** that user's next recommendation polls within 10 minutes start no refresh and return the stored recommendations as ready

#### Scenario: User already backing off
- **WHEN** the server restarts while a user is in the failure backoff
- **THEN** the warm-up does not compute that user's recommendations
