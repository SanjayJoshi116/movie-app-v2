## MODIFIED Requirements

### Requirement: Notifications cover every followed person
New-release notifications SHALL consider the recent credits of every person
the user follows, regardless of how many people they follow or when they
followed them. When many followed people have no cached credits, a single
poll MAY cover only some of them, but each poll SHALL cover people not yet
covered, so that every followed person is covered within a bounded number of
consecutive polls.

#### Scenario: Early follow
- **WHEN** a user follows 15 people, and only the first person they followed has a release in the last 30 days
- **THEN** that release appears in their notifications

#### Scenario: Many follows with a cold cache
- **WHEN** a user follows 500 people, none of whose credits are cached, and the notifications endpoint is polled repeatedly
- **THEN** each poll covers people the previous polls didn't, and after a bounded number of polls every followed person's releases can appear

## ADDED Requirements

### Requirement: A notifications poll finishes within a bounded time
The notifications endpoint SHALL respond within a fixed time budget that is shorter than the server's request timeout, however many people the user follows and however slow TMDB is. Credits fetched during a poll SHALL be cached as they arrive, so a poll cut short by its budget still saves what it fetched.

#### Scenario: Slow TMDB
- **WHEN** every TMDB credits request takes the full request timeout to answer
- **THEN** the notifications endpoint still responds within its budget, without the server killing the request

#### Scenario: Budget reached mid-batch
- **WHEN** a poll reaches its time budget after some people's credits have arrived
- **THEN** those people's credits are cached, and the next poll doesn't fetch them again
