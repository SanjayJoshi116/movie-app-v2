## ADDED Requirements

### Requirement: No result and no running refresh is reported as unavailable
When a user has no stored recommendations and no refresh is running or can start (the failure backoff is set, or a refresh thread couldn't be started), both recommendation endpoints SHALL answer with status `"unavailable"` and no sections, not `"pending"`. The Recommendations page SHALL show that group's load-error state with a Retry action, not the "still computing" state.

#### Scenario: First compute hit a TMDB outage
- **WHEN** a new user's first recommendations compute was refused because TMDB failed, and the user opens Recommendations within the backoff period
- **THEN** the endpoints answer `{"status": "unavailable", "sections": []}` and the page shows "Couldn't load recommendations" with Retry

#### Scenario: Backoff over
- **WHEN** the same user opens Recommendations after the backoff period
- **THEN** a refresh starts and the endpoints answer `"pending"` until it saves

### Requirement: Only a failure in this compute marks it as an outage
A recommendation compute SHALL count as hit by a TMDB failure only when a TMDB call made during that compute failed. A watched title skipped because an earlier fetch of it failed and is still in its backoff period SHALL NOT, on its own, mark the compute as failed.

#### Scenario: History cleared while one title is in backoff
- **WHEN** one watched title's metadata fetch failed 10 minutes ago, the user then removes most of their watched history, and the triggered refresh makes no failing TMDB call
- **THEN** the refresh saves its result even though it has fewer sections than the stored one
