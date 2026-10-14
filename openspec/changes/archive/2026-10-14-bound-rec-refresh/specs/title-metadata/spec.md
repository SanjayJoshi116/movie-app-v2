## ADDED Requirements

### Requirement: Background title fetches share a per-user daily budget
TMDB requests made in the background for one user's titles (genre and metadata backfill, and the recommendation cache fill) SHALL together be limited to 1,000 per user per day. The count SHALL be kept in the database and updated atomically, so concurrent processes can't exceed it. When the budget is used up, the remaining titles SHALL be left for the next day, and that SHALL NOT count as a failure of the refresh or backfill.

#### Scenario: Repeated clear-and-import of unknown ids
- **WHEN** a user repeatedly clears their watched list, imports 500 titles with ids TMDB doesn't know, and opens stats
- **THEN** no more than 1,000 background title requests are made for that user in one day

#### Scenario: Budget used up during a refresh
- **WHEN** a user's daily budget runs out while their recommendations are being refreshed
- **THEN** the refresh still stores its result, using the details already cached

#### Scenario: Next day
- **WHEN** a user whose budget ran out opens stats the next day
- **THEN** the remaining titles are fetched again, up to the per-run cap
