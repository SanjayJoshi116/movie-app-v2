# data-backup Specification

## Purpose

Lets users export their whole library to a single backup file and restore it faithfully, and import titles from CSV files, with honest reporting of what each import actually saved.

## Requirements

### Requirement: A backup contains the whole library
"Export All" SHALL produce one backup file that contains:
- the watchlist: id, type, title, vote average, added time, poster
- the watched history: id, type, title, vote average, watched time, runtime, platform, poster
- all ratings: id, type, title, rating, review, rated time
- every list, including empty ones: original name, description and items

The backup SHALL identify its format and version.

#### Scenario: Ratings and reviews are exported
- **WHEN** a user with a rating of 8 and the review "Great, \"must\" see,\nreally" on movie 550 exports a backup
- **THEN** the backup contains that rating with the review text intact, including the quotes, comma and line break

#### Scenario: Empty list and special-character name are exported
- **WHEN** a user with an empty list named `Sci-Fi / Horror` exports a backup
- **THEN** the backup records a list named exactly `Sci-Fi / Horror` with no items

### Requirement: Restoring a backup is faithful
Importing a backup SHALL restore each entry's original timestamps (added, watched, rated), watched runtime and platform, ratings with their reviews, and list names, descriptions and empty lists. Imported watched entries SHALL count in stats on their original dates, not the import date.

#### Scenario: Round trip into an empty account
- **WHEN** a user exports a backup, and a new account imports it
- **THEN** the new account's watchlist, watched history (with watched dates, runtime and platform), ratings (with reviews) and lists (with names, descriptions and items, including empty lists) match the exported account

### Requirement: Restore never overwrites and is idempotent
Importing SHALL skip any watchlist entry, watched entry, rating or list item that already exists for the same title and type, leaving the existing entry unchanged, including an existing rating's value and review. Lists SHALL be matched by exact name: an existing list with that name receives the items, and no second list is created. Importing the same backup twice SHALL produce the same library as importing it once.

#### Scenario: Existing rating is kept
- **WHEN** a user who rated movie 550 a 9 imports a backup where movie 550 is rated 6
- **THEN** the rating stays 9, and the import reports it as skipped

#### Scenario: Import twice
- **WHEN** a user imports the same backup twice
- **THEN** after the second import there are no duplicate lists or entries, and the second import reports everything as skipped

### Requirement: Older backups remain importable
A backup made before this format version (no format manifest, no ratings file, no runtime/platform columns) SHALL still import its watchlist, watched history and lists. Missing data SHALL simply be absent; it SHALL NOT be treated as an error.

#### Scenario: Version 1 backup
- **WHEN** a user imports a backup containing only `watchlist.csv`, `watched.csv` and `lists/*.csv` in the old column layout
- **THEN** all of its entries are imported, list names come from the file names, and no ratings are touched

### Requirement: Import results are reported accurately
After an import, the user SHALL see how many entries were actually added, how many were skipped as already present, and how many failed, per section (watchlist, watched, ratings, lists). A failure in one section SHALL NOT prevent the other sections from being imported. The message SHALL NOT report success for entries that weren't saved.

#### Scenario: One section fails
- **WHEN** a backup import's watchlist step fails with a server error but the watched and list steps succeed
- **THEN** the watched entries and list items are saved, and the result message shows the watchlist step as failed and the actual counts for the others

#### Scenario: New list in the backup
- **WHEN** a user imports a backup containing a list that doesn't exist in their account
- **THEN** the list is created once, its items are added, and the import completes without an error

### Requirement: CSV files are parsed robustly
Every CSV import SHALL correctly read fields containing quoted commas, quotes and line breaks. It SHALL accept CRLF or LF line endings, ignore a leading UTF-8 byte-order mark, and accept comma, semicolon or tab as the delimiter, detected from the header row.

#### Scenario: Semicolon-delimited file
- **WHEN** a user imports a watched CSV whose header is `id;title` with rows like `550;Fight Club`
- **THEN** the rows are recognized and imported

#### Scenario: Quoted line break
- **WHEN** a CSV row has a quoted title or review containing a line break
- **THEN** it is read as one row with the line break preserved, not split into two rows

### Requirement: Each CSV row can carry its own media type
When a CSV being imported into the watched history or a list has a `type` or `media_type` column, each row's value (`movie` or `tv`) SHALL decide that row's media type. The type selected in the import dialog SHALL apply only to rows without one. The import preview SHALL show each row's type.

#### Scenario: Mixed file
- **WHEN** a user imports a CSV with a `type` column holding `movie` for some rows and `tv` for others, with "Movies" selected
- **THEN** the `tv` rows are imported as TV shows and the `movie` rows as movies

### Requirement: Large imports and retries work
A CSV or backup import SHALL succeed for any number of rows, even beyond the per-request bulk limit. After a failed or rejected file selection, choosing the same file again SHALL be read again.

#### Scenario: More than 500 rows
- **WHEN** a user imports a watched CSV with 1,200 valid rows
- **THEN** all 1,200 are imported, and the reported counts total 1,200

#### Scenario: Re-select the same file
- **WHEN** a user picks a CSV that shows a parse error, fixes nothing, and picks the same file again
- **THEN** the file is read again and the error is shown again

### Requirement: Bulk imports keep supplied timestamps and refresh recommendations
The bulk watchlist, watched and rating import endpoints SHALL store a supplied added/watched/rated time instead of the current time, and SHALL reject a time in the future. They SHALL only create entries; existing ones are skipped. The counts they return SHALL match what was actually created. A bulk watched import that creates at least one entry SHALL schedule a refresh of that user's recommendations. A bulk rating import SHALL NOT send ratings to a connected TMDB account. Paginated reads of a user's watchlist, watched history, ratings, followed people and lists SHALL return every entry exactly once, even when many entries share the same timestamp.

#### Scenario: Watched date preserved
- **WHEN** a client bulk-imports a watched entry with `watchedAt` of 2024-03-01T20:00:00Z
- **THEN** the stored entry's watched time is 2024-03-01T20:00:00Z

#### Scenario: Future timestamp
- **WHEN** a client bulk-imports an entry with a timestamp one day in the future
- **THEN** the request is rejected with `400` and nothing is written

#### Scenario: Imported entries page without duplicates
- **WHEN** a bulk import gives 250 watched entries the same watched time, and the client reads the watched history page by page
- **THEN** every entry appears exactly once across the pages; the same holds for the watchlist, ratings, followed people and lists

#### Scenario: Recommendations refresh after import
- **WHEN** a bulk watched import creates new watched entries
- **THEN** exactly one recommendation refresh is scheduled for that user after the import commits

### Requirement: Watched exports keep the logged time zone
Watched history exported as CSV or inside a backup SHALL include each entry's
logged time zone. Importing such a file SHALL restore that time zone on the
imported entries. A file without the time zone column, including every
backup made before this change, SHALL still import, with no time zone on its
entries.

#### Scenario: Round trip
- **WHEN** a user exports a backup containing a watch logged in `Asia/Kolkata` and imports it into an empty account
- **THEN** the imported entry's logged time zone is `Asia/Kolkata` and it shows on the same day as before

#### Scenario: Old backup
- **WHEN** a user imports a backup whose watched file has no time zone column
- **THEN** every watched entry is imported, with no logged time zone

### Requirement: Exported CSVs can't run as spreadsheet formulas
Every CSV the app exports (watchlist, watched, ratings, lists and the backup) SHALL neutralize cells a spreadsheet would treat as a formula: values starting with `=`, `+`, `-`, `@`, a tab or a carriage return. Importing a file the app exported SHALL restore every value exactly, and files exported before this change SHALL still import unchanged.

#### Scenario: Formula-looking title
- **WHEN** a title is `=HYPERLINK("https://example.com","x")` and the user exports their watchlist and opens it in a spreadsheet
- **THEN** the cell shows the text, not a formula result

#### Scenario: Round trip
- **WHEN** a library holding titles that start with `=`, `-`, `@` and `'` is exported as a backup and imported into an empty account
- **THEN** every title is restored exactly as it was

#### Scenario: Older backup
- **WHEN** a backup made before this change contains a title starting with `'`
- **THEN** it imports with that title unchanged
