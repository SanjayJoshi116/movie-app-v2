# recommendation-refresh Specification

## Purpose

Defines how changes to a user's watch history trigger recomputation of their cached recommendations, so the cache stays fresh without unbounded concurrent background work.

## Requirements

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

### Requirement: A failed refresh never blocks later refreshes
If a background recommendation refresh fails at any point, the system SHALL still release that user's in-flight refresh state. This includes failing before computation starts, e.g. because the database is briefly unreachable while loading the user. A later trigger for the same user SHALL then start a new refresh, and the recommendation endpoints SHALL NOT report the user's cache as "pending" indefinitely because of the earlier failure.

#### Scenario: Database unavailable when a refresh starts
- **WHEN** a refresh is triggered for a user and loading that user from the database raises an error
- **THEN** the failure is logged, the user's in-flight state is released, and the next watch-history change for that user starts a new refresh

#### Scenario: Queued follow-up after a failed refresh
- **WHEN** a refresh for a user fails early while a follow-up refresh was queued for that user
- **THEN** the follow-up refresh still runs (or the user's state is fully released), and the user is not left marked as refreshing with nothing running

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
