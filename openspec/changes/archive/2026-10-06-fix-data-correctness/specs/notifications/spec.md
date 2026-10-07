## ADDED Requirements

### Requirement: Notifications cover every followed person
New-release notifications SHALL consider the recent credits of every person
the user follows, regardless of how many people they follow or when they
followed them.

#### Scenario: Early follow
- **WHEN** a user follows 15 people, and only the first person they followed has a release in the last 30 days
- **THEN** that release appears in their notifications

### Requirement: Per-person credit lookups are cached without caching failures
The system SHALL reuse a person's fetched credits for a limited time, so
repeated polls don't refetch every followed person from TMDB. A failed fetch
SHALL NOT be cached: the next poll SHALL try that person again.

#### Scenario: Repeated polls
- **WHEN** the notifications endpoint is called twice within a few minutes
- **THEN** the second call makes no TMDB credit requests for people already fetched successfully

#### Scenario: Failed fetch
- **WHEN** fetching one person's credits fails during a poll
- **THEN** the next poll fetches that person's credits again
