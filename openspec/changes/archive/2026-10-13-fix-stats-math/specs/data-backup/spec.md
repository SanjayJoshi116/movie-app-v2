## MODIFIED Requirements

### Requirement: Restoring a backup is faithful
Importing a backup SHALL restore each entry's original timestamps (added, watched, rated), watched runtime and platform, ratings with their reviews, and list names, descriptions and empty lists. Each list SHALL keep its creation time when the backup has it, and each list item SHALL keep its added time, so lists and their items show in the same order as in the exported account. Imported watched entries SHALL count in stats on their original dates, not the import date.

#### Scenario: Round trip into an empty account
- **WHEN** a user exports a backup, and a new account imports it
- **THEN** the new account's watchlist, watched history (with watched dates, runtime and platform), ratings (with reviews) and lists (with names, descriptions and items, including empty lists) match the exported account

#### Scenario: List order survives a restore
- **WHEN** a user exports a backup with a list whose items were added on three different days, and a new account imports it
- **THEN** the restored list shows the items in the same order with the same added dates, and the lists themselves are in the same order as before

### Requirement: Bulk imports keep supplied timestamps and refresh recommendations
The bulk watchlist, watched, rating and list-item import endpoints SHALL store a supplied added/watched/rated time instead of the current time, and SHALL reject a time in the future. They SHALL only create entries; existing ones are skipped. The counts they return SHALL match what was actually created. A bulk watched import that creates at least one entry SHALL schedule a refresh of that user's recommendations. A bulk rating import SHALL NOT send ratings to a connected TMDB account. Paginated reads of a user's watchlist, watched history, ratings, followed people and lists SHALL return every entry exactly once, even when many entries share the same timestamp.

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

## ADDED Requirements

### Requirement: List imports are batched and keep file order
Restoring lists from a backup and importing a CSV into a list SHALL add items in batches (at most 500 per request), not one request per item. Rows without an added time SHALL get the import time, and the list SHALL then show them in the same order as the file.

#### Scenario: Large list restore
- **WHEN** a user restores a backup containing a list of 1,200 items
- **THEN** the items are added in 3 requests and all 1,200 are in the list

#### Scenario: CSV without dates
- **WHEN** a user imports a CSV with rows A, B, C (no dates) into an empty list
- **THEN** the list shows A, B, C in that order
