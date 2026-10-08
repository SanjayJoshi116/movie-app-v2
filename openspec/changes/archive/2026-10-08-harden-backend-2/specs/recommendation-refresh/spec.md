## ADDED Requirements

### Requirement: Refresh status is the same on every server process
While a recommendation refresh for a user is running on any server process, both recommendation endpoints SHALL report the user's recommendations as `pending`, whichever process answers the request. A refresh that crashed or was killed SHALL stop counting as running after a bounded time.

#### Scenario: Poll answered by another process
- **WHEN** marking a title watched starts a refresh on one server process, and the next recommendations poll is answered by a different process
- **THEN** that poll reports `pending`, and the page keeps polling until the refresh has finished

#### Scenario: Refresh killed mid-run
- **WHEN** the process running a refresh is killed before it finishes
- **THEN** the recommendations stop being reported as `pending` once the bound has passed

### Requirement: An upstream outage keeps the previous recommendations
A refresh during which TMDB requests fail SHALL NOT replace the stored recommendations with a result that has fewer non-empty sections than the stored ones. The previously stored recommendations SHALL stay in place, and a later refresh SHALL try again.

#### Scenario: TMDB down during a refresh
- **WHEN** a user has stored recommendations and a refresh runs while every TMDB request fails
- **THEN** the user still sees their previous recommendations afterwards

#### Scenario: Partial outage
- **WHEN** some TMDB requests fail during a refresh and the new result has as many non-empty sections as the stored one
- **THEN** the new result is stored
