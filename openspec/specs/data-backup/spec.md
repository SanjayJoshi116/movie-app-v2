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
- every followed person: person id, name, profile picture path, followed time
- every show's episode progress: show id, season, episode

The backup SHALL identify its format and version.

#### Scenario: Ratings and reviews are exported
- **WHEN** a user with a rating of 8 and the review "Great, \"must\" see,\nreally" on movie 550 exports a backup
- **THEN** the backup contains that rating with the review text intact, including the quotes, comma and line break

#### Scenario: Empty list and special-character name are exported
- **WHEN** a user with an empty list named `Sci-Fi / Horror` exports a backup
- **THEN** the backup records a list named exactly `Sci-Fi / Horror` with no items

#### Scenario: Follows and episode progress survive a new account
- **WHEN** a user who follows two people and is on S02E05 of show 1396 exports a backup, and a new account imports it
- **THEN** the new account follows the same two people in the same order and is on S02E05 of show 1396

#### Scenario: Restore never overwrites progress
- **WHEN** a user who is on S03E01 of show 1396 imports a backup that has S02E05 for that show
- **THEN** their progress stays S03E01, and the import reports it as skipped

### Requirement: Restoring a backup is faithful
Importing a backup SHALL restore each entry's original timestamps (added, watched, rated), watched runtime and platform, ratings with their reviews, and list names, descriptions and empty lists. Each list SHALL keep its creation time when the backup has it, and each list item SHALL keep its added time, so lists and their items show in the same order as in the exported account. Imported watched entries SHALL count in stats on their original dates, not the import date.

#### Scenario: Round trip into an empty account
- **WHEN** a user exports a backup, and a new account imports it
- **THEN** the new account's watchlist, watched history (with watched dates, runtime and platform), ratings (with reviews) and lists (with names, descriptions and items, including empty lists) match the exported account

#### Scenario: List order survives a restore
- **WHEN** a user exports a backup with a list whose items were added on three different days, and a new account imports it
- **THEN** the restored list shows the items in the same order with the same added dates, and the lists themselves are in the same order as before

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
After an import, the user SHALL see how many entries were actually added, how many were skipped as already present, and how many failed, per section (watchlist, watched, ratings, lists). A failure in one section SHALL NOT prevent the other sections from being imported. The message SHALL NOT report success for entries that weren't saved, and a list that couldn't be created SHALL be reported as failed even when it has no entries.

#### Scenario: One section fails
- **WHEN** a backup import's watchlist step fails with a server error but the watched and list steps succeed
- **THEN** the watched entries and list items are saved, and the result message shows the watchlist step as failed and the actual counts for the others

#### Scenario: New list in the backup
- **WHEN** a user imports a backup containing a list that doesn't exist in their account
- **THEN** the list is created once, its items are added, and the import completes without an error

#### Scenario: Empty list can't be created
- **WHEN** a backup holds an empty list and creating it fails
- **THEN** the result reports that list as failed, not a success

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
A CSV or backup import SHALL succeed for any number of rows, even beyond the per-request bulk limit, and for rows of any size the import accepts, such as reviews at the maximum length in any script. No single import request SHALL be rejected for its body size. After a failed or rejected file selection, choosing the same file again SHALL be read again.

#### Scenario: More than 500 rows
- **WHEN** a user imports a watched CSV with 1,200 valid rows
- **THEN** all 1,200 are imported, and the reported counts total 1,200

#### Scenario: Many long reviews
- **WHEN** a user restores a backup with 500 ratings, each with a 5,000-character review written in CJK characters or emoji
- **THEN** all 500 ratings and their reviews are imported, and none is reported as failed

#### Scenario: Re-select the same file
- **WHEN** a user picks a CSV that shows a parse error, fixes nothing, and picks the same file again
- **THEN** the file is read again and the error is shown again

### Requirement: Bulk imports keep supplied timestamps and refresh recommendations
The bulk watchlist, watched, rating, list-item, followed-people and episode-progress import endpoints SHALL store a supplied added/watched/rated/followed time instead of the current time, and SHALL reject a time in the future. They SHALL only create entries; existing ones are skipped. The counts they return SHALL match what was actually created, even when another request creates the same entry at the same moment. A bulk watched import that creates at least one entry SHALL schedule a refresh of that user's recommendations. A bulk rating import SHALL NOT send ratings to a connected TMDB account. Paginated reads of a user's watchlist, watched history, ratings, followed people, episode progress and lists SHALL return every entry exactly once, even when many entries share the same timestamp.

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

#### Scenario: List item added date preserved
- **WHEN** a client bulk-adds a list item with `addedAt` of 2023-05-10T12:00:00Z
- **THEN** the stored item's added time is 2023-05-10T12:00:00Z

#### Scenario: Concurrent create of the same entry
- **WHEN** a bulk import of movie 550 runs while another request adds movie 550 to the same watchlist, and the other request's row is stored first
- **THEN** the bulk import reports movie 550 as skipped, not added

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

### Requirement: Oversized backup files are rejected before decompression
The backup import SHALL refuse a file larger than 50 MB, or one whose entries declare an uncompressed size above 50 MB each or 200 MB in total. It SHALL do this before decompressing anything, and SHALL show a message saying the file is too large to be a backup.

#### Scenario: Zip bomb
- **WHEN** a user selects a 1 MB ZIP whose single entry expands to 2 GB
- **THEN** the import shows the too-large message, nothing is decompressed, and the tab stays responsive

#### Scenario: Normal backup
- **WHEN** a user selects a backup exported by the app
- **THEN** it is previewed and imported as before

### Requirement: Export All never saves an incomplete backup silently
"Export All" SHALL produce a file only when every part of the library it contains (watchlist, watched history, ratings, lists, followed people, episode progress) has finished loading successfully. While any part is still loading, the export SHALL NOT produce a file and SHALL say the library is still loading. If any part failed to load, the export SHALL NOT produce a file, SHALL say which data couldn't be loaded, and SHALL offer a way to load it again. If building the file fails, an error SHALL be shown.

#### Scenario: Watched history failed to load
- **WHEN** the user's watched history failed to load and they click "Export All Data (ZIP)"
- **THEN** no file is downloaded, and an error says the backup would be incomplete and offers to load the data again

#### Scenario: Episode progress failed to load
- **WHEN** loading the user's episode progress fails while they click "Export All Data (ZIP)"
- **THEN** no file is downloaded, and an error names the episode progress and offers to try again

#### Scenario: Library still loading
- **WHEN** the user opens the profile dialog while their ratings are still loading
- **THEN** the export control shows that the library is loading and produces no file until loading finishes

#### Scenario: Everything loaded
- **WHEN** every part of the library loaded and the user clicks "Export All Data (ZIP)"
- **THEN** the backup file is downloaded with the whole library

### Requirement: Exported CSVs open correctly in spreadsheet apps
Every CSV the app exports SHALL start with a UTF-8 byte order mark, so spreadsheet apps that otherwise assume a legacy encoding show non-ASCII titles correctly. Importing an exported CSV SHALL still give back the same rows.

#### Scenario: Non-ASCII title in Excel
- **WHEN** the user exports a watched history containing "Amélie" and opens the CSV in Excel on Windows
- **THEN** the title reads "Amélie"

#### Scenario: Round trip
- **WHEN** the user imports a CSV the app exported
- **THEN** the imported rows match the exported ones, with no stray character in the first column name

### Requirement: CSV import templates list only imported columns
The downloadable CSV import templates SHALL contain only columns that the CSV import reads. A column the import ignores SHALL NOT appear in a template.

#### Scenario: Downloading the movie template
- **WHEN** the user downloads the movie CSV template
- **THEN** every column in it is one the import uses

### Requirement: List imports are batched and keep file order
Restoring lists from a backup and importing a CSV into a list SHALL add items in batches (at most 500 per request), not one request per item. Rows without an added time SHALL get the import time, and the list SHALL then show them in the same order as the file.

#### Scenario: Large list restore
- **WHEN** a user restores a backup containing a list of 1,200 items
- **THEN** the items are added in 3 requests and all 1,200 are in the list

#### Scenario: CSV without dates
- **WHEN** a user imports a CSV with rows A, B, C (no dates) into an empty list
- **THEN** the list shows A, B, C in that order

### Requirement: Lists restore by their own identity
Restoring a backup SHALL add a backup list's items to an existing list only when a list with exactly that name existed before the import started. Each list in the backup SHALL otherwise become its own new list with its own description, even when two lists in the same backup share a name.

#### Scenario: Two lists with the same name
- **WHEN** a user imports a backup with two lists both named "Favorites", with different descriptions and items, into an account that has no "Favorites" list
- **THEN** the account has two "Favorites" lists, each with its own description and items

#### Scenario: Existing list receives items
- **WHEN** a user who already has a list named "Favorites" imports a backup with one "Favorites" list
- **THEN** the backup's items are added to the existing list and no second list is created

### Requirement: Poster lookups during imports respect the rate limit
Looking up posters and scores for imported rows SHALL stay within the per-user rate limit of the TMDB passthrough, leaving room for the user's other browsing. A rate-limited lookup SHALL be retried after the wait the server asks for, not dropped. When any lookup is rate-limited, no further lookups SHALL be sent until that wait has passed, from any import running in the tab. A row whose file already gives both a poster and a score SHALL NOT be looked up. While lookups run, the import SHALL show its progress. When the import finishes, its result SHALL say how many rows were saved without a poster.

#### Scenario: Large CSV import
- **WHEN** a user imports a 300-row watched CSV without posters
- **THEN** every row is saved with its poster and score when TMDB has one, no lookup is abandoned because of the rate limit, and progress is shown while the lookups run

#### Scenario: Re-importing the app's own export
- **WHEN** a user imports a 900-row watched CSV exported from the Watched page, where every row has a poster and a score
- **THEN** no TMDB lookup is made, and every row is saved with the file's poster and score

#### Scenario: Some rows lack a poster or score
- **WHEN** an imported file has a poster and a score on some rows and not on others
- **THEN** only the rows missing either are looked up

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

### Requirement: File downloads are not cut short
Every file the app offers for download (CSV exports, the backup ZIP, import templates and the calendar file) SHALL be handed to the browser in a way that lets the download finish. The temporary address of the file SHALL be released only after the download has started.

#### Scenario: Export a large watched history
- **WHEN** a user exports a watched history of several thousand entries
- **THEN** the browser saves the complete CSV file

#### Scenario: Download a calendar file
- **WHEN** a user downloads the upcoming-releases calendar
- **THEN** the browser saves the `.ics` file, and its temporary address is released afterwards

### Requirement: The Watched CSV round-trips runtime, platform and poster
The Watched page's CSV export SHALL include each watch's runtime, platform and poster, and the Watched CSV import SHALL read them back when present, so exporting and re-importing keeps them. A value the server would reject (a poster path longer than the server accepts, an out-of-range runtime, an overlong platform) SHALL be dropped for that row only, and the rest of the row and of the file SHALL be imported.

#### Scenario: Export then import
- **WHEN** a user exports Watched as CSV and imports that file into an account without those titles
- **THEN** the imported watches have the same runtime, platform and poster

#### Scenario: One oversized poster value
- **WHEN** one row of an imported Watched CSV has a 600-character `poster_path`
- **THEN** every row is imported, and that row's poster comes from the TMDB lookup instead

### Requirement: An unreadable import file is reported
When a CSV file picked for import can't be read, the import dialog SHALL say so instead of showing nothing.

#### Scenario: Read error
- **WHEN** the browser fails to read the chosen CSV file
- **THEN** the dialog shows an error saying the file couldn't be read, and nothing is imported
