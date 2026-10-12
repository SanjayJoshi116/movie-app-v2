## MODIFIED Requirements

### Requirement: Refresh status is the same on every server process
While a recommendation refresh for a user is running on any server process, both recommendation endpoints SHALL report the user's recommendations as `pending`, whichever process answers the request. A refresh that crashed or was killed SHALL stop counting as running after a bounded time. A refresh that finishes SHALL NOT end the `pending` status of a refresh for the same user that another process started after it.

#### Scenario: Poll answered by another process
- **WHEN** marking a title watched starts a refresh on one server process, and the next recommendations poll is answered by a different process
- **THEN** that poll reports `pending`, and the page keeps polling until the refresh has finished

#### Scenario: Refresh killed mid-run
- **WHEN** the process running a refresh is killed before it finishes
- **THEN** the recommendations stop being reported as `pending` once the bound has passed

#### Scenario: Overlapping refreshes on two processes
- **WHEN** a refresh is running on one process, another process starts a refresh for the same user, and the first one finishes while the second is still running
- **THEN** the recommendations are still reported as `pending` until the second refresh finishes

### Requirement: An upstream outage keeps the previous recommendations
A refresh during which TMDB requests fail SHALL NOT replace the stored recommendations with a result that has fewer non-empty sections than the stored ones. The previously stored recommendations SHALL stay in place, and a later refresh SHALL try again. TMDB answering that a title or person doesn't exist SHALL NOT count as a failure. Filling missing genres for watched titles counts as a TMDB request: when it fails, or leaves titles unfilled because of an earlier failure, the refresh SHALL count as having had a failure.

#### Scenario: TMDB down during a refresh
- **WHEN** a user has stored recommendations and a refresh runs while every TMDB request fails
- **THEN** the user still sees their previous recommendations afterwards

#### Scenario: Partial outage
- **WHEN** some TMDB requests fail during a refresh and the new result has as many non-empty sections as the stored one
- **THEN** the new result is stored

#### Scenario: A watched title was removed from TMDB
- **WHEN** a user's watched history includes a title TMDB reports as not found, and the user's data changed so the new result has fewer non-empty sections than the stored one
- **THEN** the new result is stored, and the next For You visit doesn't start another refresh because of it

#### Scenario: A favourite actor was removed from TMDB
- **WHEN** one of the actors used for "Because you like" sections is reported as not found by TMDB
- **THEN** that actor contributes no section, and the refresh doesn't count as failed

#### Scenario: Genre backfill fails during a refresh
- **WHEN** some watched titles still lack genres and fetching them fails during a refresh that produces fewer non-empty sections than the stored result
- **THEN** the stored recommendations stay in place
