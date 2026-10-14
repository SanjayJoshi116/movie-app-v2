## MODIFIED Requirements

### Requirement: Poster lookups during imports respect the rate limit
Looking up posters and scores for imported rows SHALL stay within the per-user rate limit of the TMDB passthrough, leaving room for the user's other browsing. A rate-limited lookup SHALL be retried after the wait the server asks for, not dropped. When any lookup is rate-limited, no further lookups SHALL be sent until that wait has passed, from any import running in the tab. While lookups run, the import SHALL show its progress. When the import finishes, its result SHALL say how many rows were saved without a poster.

#### Scenario: Large CSV import
- **WHEN** a user imports a 300-row watched CSV without posters
- **THEN** every row is saved with its poster and score when TMDB has one, no lookup is abandoned because of the rate limit, and progress is shown while the lookups run

#### Scenario: A lookup is rate-limited
- **WHEN** a poster lookup during an import is answered with `429` and a `Retry-After` of 5 seconds
- **THEN** the lookup is retried after about 5 seconds and the row gets its poster

#### Scenario: Other lookups wait out the same 429
- **WHEN** several lookups are running and one is answered with `429` and a `Retry-After` of 5 seconds
- **THEN** no lookup request of any kind is sent for about 5 seconds, and afterwards the lookups continue without any row losing its poster to the rate limit

#### Scenario: A title TMDB doesn't know
- **WHEN** one imported row's id doesn't exist on TMDB
- **THEN** the row is still imported, and the result says 1 row has no poster

### Requirement: Watched CSV imports keep each row's watched time
Importing a watched-history CSV SHALL read a watched-time column (`watched_at`) and a time-zone column (`watched_tz`) when the file has them, and SHALL store each row's watched time and zone. A watched time SHALL be used only when it is an ISO 8601 date-time with a UTC offset (or `Z`), or an ISO date alone. A date alone SHALL be stored as noon UTC on that date. A row whose watched time is blank, unreadable, in any other format, or in the future SHALL be imported with the import time, without rejecting any other row of the file.

#### Scenario: Re-import the Watched page export
- **WHEN** a user exports their watched history from the Watched page and imports that CSV into an empty account
- **THEN** every entry keeps its original watched date and time zone, and Stats shows them in their original months

#### Scenario: One bad date
- **WHEN** a watched CSV has one row with a watched time in the future and 99 valid rows
- **THEN** all 100 rows are imported, the 99 with their own times and the other with the import time

#### Scenario: A non-ISO date
- **WHEN** a 300-row watched CSV has one row whose watched time is `05/01/2024` and 299 rows with ISO date-times
- **THEN** all 300 rows are imported, the 299 with their own times and the other with the import time

#### Scenario: A date without a time
- **WHEN** a watched CSV row has the watched time `2024-05-01` and no time zone, and the user's device is in a zone behind UTC
- **THEN** the entry shows as watched on 01-05-2024

## ADDED Requirements

### Requirement: An import ends with the session that started it
An import (backup restore, watched or watchlist CSV, list CSV) SHALL send its writes only while the session that started it is still signed in. If that session ends while the import is running, the import SHALL send no further writes and SHALL NOT show its results or reload anything in the app. Nothing from it SHALL be written to an account that signs in afterwards.

#### Scenario: Sign out and in as someone else mid-import
- **WHEN** user A starts restoring a backup, signs out while poster lookups are still running, and user B signs in in the same tab
- **THEN** no watchlist, watched, rating, list, follow or episode-progress write from A's import is sent with B's session, and B's account is unchanged

### Requirement: An import's dialog stays open while it runs
While an import is running, its dialog SHALL NOT be closable: its close button, Escape and a click outside it SHALL do nothing until the import finishes. The import SHALL show that it is still running.

#### Scenario: Try to close a running restore
- **WHEN** a user starts restoring a backup and presses Escape while the poster lookups run
- **THEN** the dialog stays open with its progress, and the restore runs once

#### Scenario: Close after it finishes
- **WHEN** the restore finishes and shows its results
- **THEN** the user can close the dialog
