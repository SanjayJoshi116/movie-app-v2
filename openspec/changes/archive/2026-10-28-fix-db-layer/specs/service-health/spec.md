## ADDED Requirements

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
