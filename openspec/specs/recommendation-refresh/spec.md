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

### Requirement: Rating changes trigger a recommendation refresh
Creating a rating, changing a rating's score, deleting a rating, and a bulk ratings import that adds at least one rating SHALL each schedule a background refresh of that user's recommendation cache, under the same rules as watched-history changes: the refresh starts only after the transaction commits, never for a rollback, and refreshes are coalesced per user. Editing only a rating's review SHALL NOT schedule a refresh. Deleting an account SHALL NOT schedule one.

#### Scenario: Rating a title
- **WHEN** a user rates a watched title 9 and the request completes
- **THEN** a refresh of that user's recommendations is scheduled, and it sees the new rating

#### Scenario: Review-only edit
- **WHEN** a user changes only the review text of an existing rating
- **THEN** no recommendation refresh is scheduled

#### Scenario: Removing a rating
- **WHEN** a user removes a rating
- **THEN** a refresh of that user's recommendations is scheduled

#### Scenario: Backup restore
- **WHEN** a new account imports a backup with watched titles and ratings, the watched step first and then the ratings step
- **THEN** a refresh runs after the ratings are saved, so the restored account's recommendations reflect its ratings without waiting for the cache to expire

### Requirement: A refused refresh backs off instead of retrying on every poll
When a refresh's result is not stored because TMDB requests failed, recommendation polls for that user SHALL NOT start another refresh for a backoff period of 10 minutes. During the backoff, a stored result SHALL be served as ready even if it is stale, and a user with no stored result SHALL keep seeing "pending". A change to the user's watch history or ratings SHALL still start a refresh during the backoff. After the backoff, the next poll of a stale result SHALL start a refresh as before.

#### Scenario: Polling during a TMDB outage
- **WHEN** a user's stale recommendations are refreshed while TMDB fails, the result is refused, and the For You page keeps polling for a minute
- **THEN** no further refresh starts for that user during that minute, on any server process, and the polls return the stored recommendations as ready

#### Scenario: Data changes during the backoff
- **WHEN** a user marks a title watched during the backoff
- **THEN** a refresh starts

#### Scenario: Backoff over
- **WHEN** the backoff period has passed and the stored result is still stale
- **THEN** the next poll starts a refresh

### Requirement: One refresh fetches a bounded number of titles
One refresh SHALL fetch details from TMDB for at most 200 watched titles: titles never cached first, then the oldest cached ones. Titles left for later runs SHALL use their existing cached details, and leaving them SHALL NOT count as a failure. Looking up which titles are cached SHALL NOT build one query condition per watched title.

#### Scenario: Huge imported library
- **WHEN** a user with 50,000 watched titles, none cached, has their recommendations refreshed
- **THEN** that refresh makes at most 200 title-detail requests to TMDB, and the result is stored

#### Scenario: Weekly re-fetch of a large library
- **WHEN** a user's 3,000 cached titles are all older than the cache lifetime
- **THEN** one refresh re-fetches at most 200 of them, the oldest first, and still uses the cached details of the rest

### Requirement: Concurrent refreshes per process are bounded
A server process SHALL compute at most 4 recommendation refreshes at a time. Further refreshes SHALL wait for a free slot before using the database or TMDB, and SHALL still run afterwards. A refresh whose background thread can't be started SHALL release the user's refreshing state, so the user isn't reported as "pending" because of it.

#### Scenario: Burst of stale users
- **WHEN** 20 users with stale recommendations open For You at the same time on one process
- **THEN** at most 4 of their refreshes compute at once, and all 20 eventually finish

#### Scenario: Thread can't start
- **WHEN** starting a refresh's background thread raises an error
- **THEN** the user is not left marked as refreshing, and a later trigger starts a refresh

### Requirement: An older recompute never replaces a newer one
A recompute's result SHALL be stored only if no recompute that started later has already stored its result for that user. This SHALL hold across server processes.

#### Scenario: Two processes recompute the same user
- **WHEN** a recompute starts on one process, a watch on another process starts a second recompute that finishes and saves first, and then the first one finishes
- **THEN** the second recompute's result stays stored
