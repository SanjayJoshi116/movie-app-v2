# title-metadata Specification

## Purpose

Defines how per-title metadata from TMDB (genres, top cast, original language,
release year) is fetched, cached and backfilled for a user's watched titles, so
stats and recommendations are built on complete data and a failed upstream call
never replaces good data.

## Requirements

### Requirement: A failed TMDB fetch never replaces cached metadata
When refreshing a title's cached metadata fails, the system SHALL keep the
existing cached metadata unchanged and use it, even if it is past its
freshness window. When no cached metadata exists, the system SHALL store
nothing for that title, so a later request fetches it again. TMDB answering
that the title doesn't exist is not a failure: the system SHALL store empty
genres and cast for that title, and SHALL NOT fetch it again until that entry
is past its freshness window.

#### Scenario: Refresh fails for a title with good cached data
- **WHEN** a title's cached genres and cast are older than the freshness window and the TMDB fetch to refresh them fails
- **THEN** the cached genres and cast are unchanged and are used for that computation

#### Scenario: First fetch fails
- **WHEN** a title has no cached metadata and the TMDB fetch fails
- **THEN** no empty metadata row is stored, and the next computation fetches it again

#### Scenario: Title not found on TMDB
- **WHEN** TMDB reports a watched title as not found while its cached metadata is fetched
- **THEN** empty genres and cast are stored for it, and the next computation within the freshness window doesn't request it from TMDB

### Requirement: Watched titles get genres regardless of library size
The system SHALL fill in genres, original language and release year for a
user's watched titles regardless of how many titles the user has watched. A
user's stats SHALL include their top genres once that metadata is available.

#### Scenario: Two watched titles
- **WHEN** a user with exactly 2 watched titles requests their stats, and the background metadata fill completes
- **THEN** a later stats request lists top genres for those titles

### Requirement: Metadata backfill is bounded and single-flight per user
At most one metadata backfill SHALL run per user at a time, with a bounded number of concurrent TMDB requests. Repeated stats requests while a backfill is running SHALL NOT start another one. One backfill run SHALL fetch at most 100 titles. Titles left over are fetched by later runs. The in-memory record of recent transient failures SHALL be bounded in size.

#### Scenario: Rapid stats reloads
- **WHEN** a user with 200 titles missing metadata requests stats 5 times in a row while the first backfill is still running
- **THEN** only one backfill runs for that user

#### Scenario: Large import of unknown ids
- **WHEN** a user imports 500 watched titles with ids TMDB doesn't know and then opens stats
- **THEN** that backfill run makes at most 100 TMDB requests

#### Scenario: Library larger than one run
- **WHEN** a user with 250 titles missing metadata opens stats three times, each after the previous backfill finished
- **THEN** all 250 titles have their metadata filled

### Requirement: Unfillable titles are not retried on every request
A title that TMDB reports as not found SHALL be marked as settled in the database and SHALL NOT be fetched again, by any server worker, before or after a restart. A not-found title is stored with unknown language and release year. A title for which TMDB lists no genres SHALL be stored with what TMDB returned and SHALL NOT be fetched again until 30 days after that answer, by any worker or after a restart; then it SHALL be fetched again, so genres and a release year that TMDB adds later are filled in. A title whose fetch failed for any other reason SHALL NOT be retried until a backoff period has passed.

#### Scenario: Title removed from TMDB
- **WHEN** a watched title's TMDB lookup returns not found
- **THEN** it is stored with unknown language and year, and later stats requests don't fetch it again

#### Scenario: Restart after settling
- **WHEN** the backend restarts after a title was settled as not found, and the user opens stats again
- **THEN** no TMDB request is made for that title

#### Scenario: Transient failure
- **WHEN** a title's metadata fetch times out
- **THEN** a stats request a minute later does not fetch it again, and one made after the backoff period does

#### Scenario: Unreleased title without genres
- **WHEN** TMDB returns a watched title with no genres and no release date
- **THEN** stats requests during the next 30 days don't fetch it again, and the first one after 30 days does, storing the genres and release year TMDB has by then

#### Scenario: Title settled without genres before this change
- **WHEN** a title was settled earlier because TMDB listed no genres for it (not because it was missing)
- **THEN** it is fetched once more on a later run, and from then on follows the 30-day recheck

### Requirement: Marking a title watched keeps supplied metadata
When a client marks a title watched and supplies its original language or
release year, the system SHALL store those values on the new watched entry.

#### Scenario: Language and year supplied
- **WHEN** the client marks a movie watched with original language `ja` and release year 2001
- **THEN** the stored watched entry has language `ja` and release year 2001, and stats count it under Japanese and the 2000s without a backfill

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

### Requirement: Metadata backfills are capped per server process
Besides being single-flight per user, at most a fixed small number of metadata backfills SHALL run at the same time in one server process. Further backfills SHALL wait their turn and SHALL NOT hold a database connection or start TMDB requests while waiting. A waiting backfill SHALL still run once a slot frees.

#### Scenario: Many users open Stats at once
- **WHEN** 50 users who each have titles missing metadata open Stats within a few seconds
- **THEN** no more than the cap of backfills fetch from TMDB at once, the others wait without holding database connections, and every user's titles are eventually filled

#### Scenario: A slot frees
- **WHEN** a running backfill finishes while others are waiting
- **THEN** one waiting backfill starts
