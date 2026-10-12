## MODIFIED Requirements

### Requirement: Per-person credit lookups are cached without caching failures
The system SHALL reuse a person's fetched credits for a limited time, so
repeated polls don't refetch every followed person from TMDB. A failed fetch
SHALL NOT be cached: the next poll SHALL try that person again. TMDB
answering that a person doesn't exist is not a failure: that person SHALL be
cached as having no credits, for the same limited time.

#### Scenario: Repeated polls
- **WHEN** the notifications endpoint is called twice within a few minutes
- **THEN** the second call makes no TMDB credit requests for people already fetched successfully

#### Scenario: Failed fetch
- **WHEN** fetching one person's credits fails during a poll
- **THEN** the next poll fetches that person's credits again

#### Scenario: Followed person removed from TMDB
- **WHEN** TMDB reports a followed person as not found during a poll
- **THEN** that person shows no new releases, and the next poll within the cache time makes no TMDB request for them
