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
nothing for that title, so a later request fetches it again.

#### Scenario: Refresh fails for a title with good cached data
- **WHEN** a title's cached genres and cast are older than the freshness window and the TMDB fetch to refresh them fails
- **THEN** the cached genres and cast are unchanged and are used for that computation

#### Scenario: First fetch fails
- **WHEN** a title has no cached metadata and the TMDB fetch fails
- **THEN** no empty metadata row is stored, and the next computation fetches it again

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
A title that TMDB reports as not found, or for which TMDB lists no genres, SHALL be marked as settled in the database and SHALL NOT be fetched again, by any server worker, before or after a restart. A not-found title is stored with unknown language and release year. A title whose fetch failed for any other reason SHALL NOT be retried until a backoff period has passed.

#### Scenario: Title removed from TMDB
- **WHEN** a watched title's TMDB lookup returns not found
- **THEN** it is stored with unknown language and year, and later stats requests don't fetch it again

#### Scenario: Restart after settling
- **WHEN** the backend restarts after a title was settled as not found, and the user opens stats again
- **THEN** no TMDB request is made for that title

#### Scenario: Transient failure
- **WHEN** a title's metadata fetch times out
- **THEN** a stats request a minute later does not fetch it again, and one made after the backoff period does

### Requirement: Marking a title watched keeps supplied metadata
When a client marks a title watched and supplies its original language or
release year, the system SHALL store those values on the new watched entry.

#### Scenario: Language and year supplied
- **WHEN** the client marks a movie watched with original language `ja` and release year 2001
- **THEN** the stored watched entry has language `ja` and release year 2001, and stats count it under Japanese and the 2000s without a backfill
