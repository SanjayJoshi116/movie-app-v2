## MODIFIED Requirements

### Requirement: Per-person credit lookups are cached without caching failures
The system SHALL reuse a person's fetched credits for a limited time, so
repeated polls don't refetch every followed person from TMDB. A failed fetch
SHALL NOT be cached: the next poll SHALL try that person again. TMDB
answering that a person doesn't exist is not a failure: that person SHALL be
cached as having no credits, for the same limited time. Cached credits SHALL
be stored apart from the server's rate-limit counters and TMDB proxy entries,
and their storage SHALL be bounded, so that no number of follows or polls can
evict a rate-limit counter.

#### Scenario: Repeated polls
- **WHEN** the notifications endpoint is called twice within a few minutes
- **THEN** the second call makes no TMDB credit requests for people already fetched successfully

#### Scenario: Failed fetch
- **WHEN** fetching one person's credits fails during a poll
- **THEN** the next poll fetches that person's credits again

#### Scenario: Followed person removed from TMDB
- **WHEN** TMDB reports a followed person as not found during a poll
- **THEN** that person shows no new releases, and the next poll within the cache time makes no TMDB request for them

#### Scenario: Credit cache fills up
- **WHEN** enough people's credits are cached to reach the credit cache's size limit
- **THEN** older credit entries are evicted, and no rate-limit counter or proxy entry is lost

## ADDED Requirements

### Requirement: A notifications poll's work grows with recent releases, not total credits
A notifications poll SHALL read, for each followed person, only the credits that can fall inside the notification window, not the person's full credit list. The amount of cached data one poll loads SHALL depend on how many recent and upcoming releases the followed people have, not on how many credits they have in total.

#### Scenario: Prolific followed people
- **WHEN** a user follows 1,000 people whose cached credit lists hold hundreds of titles each, and only a few of those titles were released in the last 30 days
- **THEN** a poll loads data for those few recent titles per person, not the full credit lists, and returns the same notifications as before

#### Scenario: A release moves into the window
- **WHEN** a followed person's title is dated tomorrow at the time their credits are cached, and the user polls the next day within the cache lifetime
- **THEN** the title appears as a new release

### Requirement: A same-day release that appears after marking seen is unread
Marking notifications seen SHALL cover the items the user had at that moment. A release dated the same day as the mark-seen that the user didn't have then SHALL be shown as unread when it appears later that day. Items dated before that day SHALL stay read.

#### Scenario: Release appears later the same day
- **WHEN** a user marks notifications seen in the morning, and later that day a followed person's credits gain a title released that day
- **THEN** that title is unread and counts toward the unread badge

#### Scenario: Same-day item already seen
- **WHEN** a user marks notifications seen while a title released that day is in their list
- **THEN** that title is read on the next poll that day
