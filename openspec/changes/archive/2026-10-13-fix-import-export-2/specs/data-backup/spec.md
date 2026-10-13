## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Lists restore by their own identity
Restoring a backup SHALL add a backup list's items to an existing list only when a list with exactly that name existed before the import started. Each list in the backup SHALL otherwise become its own new list with its own description, even when two lists in the same backup share a name.

#### Scenario: Two lists with the same name
- **WHEN** a user imports a backup with two lists both named "Favorites", with different descriptions and items, into an account that has no "Favorites" list
- **THEN** the account has two "Favorites" lists, each with its own description and items

#### Scenario: Existing list receives items
- **WHEN** a user who already has a list named "Favorites" imports a backup with one "Favorites" list
- **THEN** the backup's items are added to the existing list and no second list is created

### Requirement: Poster lookups during imports respect the rate limit
Looking up posters and scores for imported rows SHALL stay within the per-user rate limit of the TMDB passthrough, leaving room for the user's other browsing. A rate-limited lookup SHALL be retried after the wait the server asks for, not dropped. While lookups run, the import SHALL show its progress. When the import finishes, its result SHALL say how many rows were saved without a poster.

#### Scenario: Large CSV import
- **WHEN** a user imports a 300-row watched CSV without posters
- **THEN** every row is saved with its poster and score when TMDB has one, no lookup is abandoned because of the rate limit, and progress is shown while the lookups run

#### Scenario: A lookup is rate-limited
- **WHEN** a poster lookup during an import is answered with `429` and a `Retry-After` of 5 seconds
- **THEN** the lookup is retried after about 5 seconds and the row gets its poster

#### Scenario: A title TMDB doesn't know
- **WHEN** one imported row's id doesn't exist on TMDB
- **THEN** the row is still imported, and the result says 1 row has no poster

### Requirement: Watched CSV imports keep each row's watched time
Importing a watched-history CSV SHALL read a watched-time column (`watched_at`) and a time-zone column (`watched_tz`) when the file has them, and SHALL store each row's watched time and zone. A row whose watched time is blank or unreadable SHALL be imported with the import time. A row whose watched time is in the future SHALL be imported with the import time, without rejecting the rest of the file.

#### Scenario: Re-import the Watched page export
- **WHEN** a user exports their watched history from the Watched page and imports that CSV into an empty account
- **THEN** every entry keeps its original watched date and time zone, and Stats shows them in their original months

#### Scenario: One bad date
- **WHEN** a watched CSV has one row with a watched time in the future and 99 valid rows
- **THEN** all 100 rows are imported, the 99 with their own times and the other with the import time
