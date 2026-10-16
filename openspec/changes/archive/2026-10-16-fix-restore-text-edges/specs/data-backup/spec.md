## MODIFIED Requirements

### Requirement: Poster lookups during imports respect the rate limit
Looking up posters and scores for imported rows SHALL stay within the per-user rate limit of the TMDB passthrough, leaving room for the user's other browsing. A rate-limited lookup SHALL be retried after the wait the server asks for, not dropped. When any lookup is rate-limited, no further lookups SHALL be sent until that wait has passed, from any import running in the tab. In every import (the Watched CSV import, a CSV import into a list, and a backup restore), a row whose file already gives both a poster and a score SHALL NOT be looked up, and a value the file gives SHALL be kept over the lookup's. Each title (media type and id) SHALL be looked up at most once per import, however many rows or backup sections it appears in, and every row of that title SHALL get that lookup's result. While lookups run, the import SHALL show its progress. When the import finishes, its result SHALL say how many titles were saved without a poster, counting each title once.

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
- **THEN** the row is still imported, and the result says 1 title has no poster

#### Scenario: The same title in several backup sections
- **WHEN** a backup without posters has one title in its watchlist, its watched history and two lists
- **THEN** that title is looked up once, all four entries get its poster, and if TMDB has no poster the result says 1 title has no poster, not 4

### Requirement: A bad value in a backup row is dropped for that row only
Restoring a backup SHALL drop, for that row only, every value the server would reject: a poster that doesn't start with `/` or is longer than 500 characters, a score outside 0–10 or not a number, a runtime that isn't a non-negative whole number, a platform longer than 100 characters, a time zone longer than 64 characters, an added, watched or rated time that isn't a valid time between 1900 and 5 minutes after the device's current time, and a review longer than 5,000 characters. A personal rating outside 0.5–10 or not on a half step SHALL NOT be restored, and the other ratings SHALL be. A title longer than 500 characters SHALL be shortened to its first 500. The rest of the row, and of the backup, SHALL be restored. A row whose poster was dropped SHALL get its poster from the lookup. A row whose time was dropped SHALL get the restore time. A backup row's score SHALL be taken from the file; a blank or dropped score SHALL be read as 0. A row that has a poster SHALL NOT be looked up for its score. A row looked up for its poster whose score is 0 SHALL be restored with the score the lookup returned, and with 0 when the lookup gives none.

#### Scenario: One oversized poster value in a backup
- **WHEN** a backup's `watched.csv` has 600 rows and one of them has a 600-character `poster_path`
- **THEN** all 600 watches are restored, and that row's poster comes from the TMDB lookup

#### Scenario: Out-of-range score in a backup
- **WHEN** a backup's `watchlist.csv` has a row with a poster and `vote_average` 11
- **THEN** that row is restored with a score of 0, no TMDB lookup is made for it, and every other row is restored as in the file

#### Scenario: Blank score on a row looked up for its poster
- **WHEN** a backup's `watchlist.csv` has a row with no `poster_path` and a blank `vote_average`, and TMDB gives that title a poster and a score of 7.8
- **THEN** the row is restored with TMDB's poster and a score of 7.8

#### Scenario: Backup score kept over the lookup
- **WHEN** a backup's `watchlist.csv` has a row with no `poster_path` and `vote_average` 6.5, and TMDB gives that title a score of 7.8
- **THEN** the row is restored with TMDB's poster and a score of 6.5

#### Scenario: One bad runtime in a backup
- **WHEN** a backup's `watched.csv` has 600 rows and one of them has `runtime_minutes` -5
- **THEN** all 600 watches are restored, and that one has no runtime

#### Scenario: Out-of-range personal rating in a backup
- **WHEN** a backup's `ratings.csv` has 3 rows and one has `user_rating` 11
- **THEN** the other 2 ratings are restored, and the result doesn't report the section as failed

#### Scenario: Oversized review in a backup
- **WHEN** a backup's `ratings.csv` has a row with a 6,000-character review
- **THEN** that rating is restored without its review, and every other rating with its own

#### Scenario: Review with many emoji in a backup
- **WHEN** a backup's `ratings.csv` has a 4,000-character review of which 1,100 characters are emoji
- **THEN** that rating is restored with its whole review

#### Scenario: Future watched time in a backup
- **WHEN** a backup's `watched.csv` has a row whose `watched_at` is next year
- **THEN** that watch is restored with the restore time, and every other row with its own

#### Scenario: Backup made on a clock slightly ahead
- **WHEN** a backup's `watchlist.csv` has a row whose `added_at` is 2 minutes after the restoring device's current time
- **THEN** that row is restored with its own added time, not the restore time

### Requirement: Imported titles longer than the server accepts are shortened
Every CSV import (the Watched CSV import, a CSV import into a list, and a backup restore) SHALL shorten a title longer than 500 characters to its first 500, instead of sending a value that would fail the whole batch. Characters SHALL be counted as the server counts them (one per Unicode code point, so an emoji is one character), and a shortened title SHALL NOT end in part of a character.

#### Scenario: Very long title in a Watched CSV
- **WHEN** a user imports a 300-row watched CSV where one row's title is 700 characters
- **THEN** all 300 rows are imported, and that row's title is its first 500 characters

#### Scenario: Emoji at the cut
- **WHEN** a backup's `watchlist.csv` has 600 rows and one row's title is 520 characters with an emoji as its 500th character
- **THEN** all 600 rows are restored, and that row's title is its first 500 characters with the whole emoji at the end

## ADDED Requirements

### Requirement: Import length limits count characters as the server does
Every length limit an import applies to a value before sending it (review, platform, time zone, poster, title) SHALL count Unicode code points, as the server's limits do, so a value the server accepts is never dropped or shortened because it contains emoji or other characters outside the Basic Multilingual Plane.

#### Scenario: Platform name with emoji
- **WHEN** a user imports a watched CSV whose `platform` value is 60 emoji (60 characters, 120 UTF-16 code units)
- **THEN** the row is imported with that platform
