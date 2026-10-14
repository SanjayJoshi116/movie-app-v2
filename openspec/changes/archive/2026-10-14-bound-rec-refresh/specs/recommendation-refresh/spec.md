## ADDED Requirements

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
