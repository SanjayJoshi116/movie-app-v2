## Purpose

Defines how changes to a user's watch history trigger recomputation of their cached recommendations, so the cache stays fresh without unbounded concurrent background work.

## ADDED Requirements

### Requirement: Watch-history changes trigger a recommendation refresh
When a user's watched entry is created or deleted, the system SHALL schedule a background refresh of that user's recommendation cache. The refresh SHALL start only after the transaction containing the change has committed, and SHALL NOT start if that transaction rolls back.

#### Scenario: Marking a title watched
- **WHEN** a user marks a title as watched and the request completes
- **THEN** a refresh of that user's recommendation cache is scheduled, and it sees the new watched entry

#### Scenario: Rolled-back change
- **WHEN** a watched entry is created inside a transaction that then rolls back
- **THEN** no recommendation refresh is scheduled for that change

### Requirement: Refreshes are coalesced per user
The system SHALL run at most one recommendation refresh at a time for any one user (per server process). If more refresh triggers arrive for a user while a refresh is running, the system SHALL run exactly one more refresh after the current one finishes, no matter how many triggers arrived, so the final cached result reflects the latest watch history.

#### Scenario: Clearing a large watched history
- **WHEN** a user clears a watched history of 500 entries in one request
- **THEN** at most two refreshes run for that user as a result (the first one triggered, plus one follow-up), not one per deleted entry

#### Scenario: Change arrives mid-refresh
- **WHEN** a refresh is running for a user and that user marks another title watched
- **THEN** after the running refresh finishes, one more refresh runs and its result includes the newly watched title

#### Scenario: Different users are independent
- **WHEN** two different users each trigger a refresh at the same time
- **THEN** both refreshes run; neither is suppressed by the other

### Requirement: Account deletion does not trigger refreshes
When a user account is deleted, removing that user's watched entries as part of the deletion SHALL NOT schedule any recommendation refresh.

#### Scenario: Deleting an account with watch history
- **WHEN** a user with 200 watched entries deletes their account
- **THEN** no recommendation refresh is scheduled for that user, and no background error is logged for a missing user
