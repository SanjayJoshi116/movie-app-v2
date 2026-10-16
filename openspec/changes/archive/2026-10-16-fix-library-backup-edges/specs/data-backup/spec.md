## MODIFIED Requirements

### Requirement: A bad value in a backup row is dropped for that row only
Restoring a backup SHALL drop, for that row only, every value the server would reject: a poster that doesn't start with `/` or is longer than 500 characters, a score outside 0–10 or not a number, a runtime that isn't a non-negative whole number, a platform longer than 100 characters, a time zone longer than 64 characters, an added, watched or rated time that isn't a valid time between 1900 and now, and a review longer than 5,000 characters. A personal rating outside 0.5–10 or not on a half step SHALL NOT be restored, and the other ratings SHALL be. A title longer than 500 characters SHALL be shortened to its first 500. The rest of the row, and of the backup, SHALL be restored. A row whose poster was dropped SHALL get its poster from the lookup. A row whose time was dropped SHALL get the restore time. A backup row's score SHALL be taken from the file and SHALL NOT be looked up; a blank or dropped score SHALL be restored as 0.

#### Scenario: One oversized poster value in a backup
- **WHEN** a backup's `watched.csv` has 600 rows and one of them has a 600-character `poster_path`
- **THEN** all 600 watches are restored, and that row's poster comes from the TMDB lookup

#### Scenario: Out-of-range score in a backup
- **WHEN** a backup's `watchlist.csv` has a row with `vote_average` 11
- **THEN** that row is restored with a score of 0, no TMDB lookup is made for its score, and every other row is restored as in the file

#### Scenario: One bad runtime in a backup
- **WHEN** a backup's `watched.csv` has 600 rows and one of them has `runtime_minutes` -5
- **THEN** all 600 watches are restored, and that one has no runtime

#### Scenario: Out-of-range personal rating in a backup
- **WHEN** a backup's `ratings.csv` has 3 rows and one has `user_rating` 11
- **THEN** the other 2 ratings are restored, and the result doesn't report the section as failed

#### Scenario: Oversized review in a backup
- **WHEN** a backup's `ratings.csv` has a row with a 6,000-character review
- **THEN** that rating is restored without its review, and every other rating with its own

#### Scenario: Future watched time in a backup
- **WHEN** a backup's `watched.csv` has a row whose `watched_at` is next year
- **THEN** that watch is restored with the restore time, and every other row with its own

## ADDED Requirements

### Requirement: Imported titles longer than the server accepts are shortened
Every CSV import (the Watched CSV import, a CSV import into a list, and a backup restore) SHALL shorten a title longer than 500 characters to its first 500, instead of sending a value that would fail the whole batch.

#### Scenario: Very long title in a Watched CSV
- **WHEN** a user imports a 300-row watched CSV where one row's title is 700 characters
- **THEN** all 300 rows are imported, and that row's title is its first 500 characters
