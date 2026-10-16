## MODIFIED Requirements

### Requirement: Poster lookups during imports respect the rate limit
Looking up posters and scores for imported rows SHALL stay within the per-user rate limit of the TMDB passthrough, leaving room for the user's other browsing. A rate-limited lookup SHALL be retried after the wait the server asks for, not dropped. When any lookup is rate-limited, no further lookups SHALL be sent until that wait has passed, from any import running in the tab. In every import (the Watched CSV import, a CSV import into a list, and a backup restore), a row whose file already gives both a poster and a score SHALL NOT be looked up, and a value the file gives SHALL be kept over the lookup's. While lookups run, the import SHALL show its progress. When the import finishes, its result SHALL say how many rows were saved without a poster.

#### Scenario: Large CSV import
- **WHEN** a user imports a 300-row watched CSV without posters
- **THEN** every row is saved with its poster and score when TMDB has one, no lookup is abandoned because of the rate limit, and progress is shown while the lookups run

#### Scenario: Re-importing the app's own export
- **WHEN** a user imports a 900-row watched CSV exported from the Watched page, where every row has a poster and a score
- **THEN** no TMDB lookup is made, and every row is saved with the file's poster and score

#### Scenario: The Watched export imported into a list
- **WHEN** a user imports a watched CSV exported from the Watched page into one of their lists
- **THEN** no TMDB lookup is made, and every list item has the file's poster and score

#### Scenario: Some rows lack a poster or score
- **WHEN** an imported file has a poster and a score on some rows and not on others
- **THEN** only the rows missing either are looked up

#### Scenario: A lookup fails for a row that has a poster
- **WHEN** an imported row has a poster but no score, and its lookup fails
- **THEN** the row is saved with the file's poster, not without one

#### Scenario: A lookup is rate-limited
- **WHEN** a poster lookup during an import is answered with `429` and a `Retry-After` of 5 seconds
- **THEN** the lookup is retried after about 5 seconds and the row gets its poster

#### Scenario: Other lookups wait out the same 429
- **WHEN** several lookups are running and one is answered with `429` and a `Retry-After` of 5 seconds
- **THEN** no lookup request of any kind is sent for about 5 seconds, and afterwards the lookups continue without any row losing its poster to the rate limit

#### Scenario: A title TMDB doesn't know
- **WHEN** one imported row's id doesn't exist on TMDB
- **THEN** the row is still imported, and the result says 1 row has no poster

## ADDED Requirements

### Requirement: A bad value in a backup row is dropped for that row only
Restoring a backup SHALL drop a poster value the server would reject (not starting with `/`, or longer than 500 characters) and a score outside 0–10 or not a number, for that row only. The rest of the row, and of the backup, SHALL be restored. A row whose poster was dropped SHALL get its poster from the lookup.

#### Scenario: One oversized poster value in a backup
- **WHEN** a backup's `watched.csv` has 600 rows and one of them has a 600-character `poster_path`
- **THEN** all 600 watches are restored, and that row's poster comes from the TMDB lookup

#### Scenario: Out-of-range score in a backup
- **WHEN** a backup's `watchlist.csv` has a row with `vote_average` 11
- **THEN** that row is restored with a score of 0 and every other row is restored as in the file
