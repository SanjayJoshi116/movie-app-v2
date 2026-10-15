## ADDED Requirements

### Requirement: The Watched CSV round-trips runtime, platform and poster
The Watched page's CSV export SHALL include each watch's runtime, platform and poster, and the Watched CSV import SHALL read them back when present, so exporting and re-importing keeps them.

#### Scenario: Export then import
- **WHEN** a user exports Watched as CSV and imports that file into an account without those titles
- **THEN** the imported watches have the same runtime, platform and poster

### Requirement: An unreadable import file is reported
When a CSV file picked for import can't be read, the import dialog SHALL say so instead of showing nothing.

#### Scenario: Read error
- **WHEN** the browser fails to read the chosen CSV file
- **THEN** the dialog shows an error saying the file couldn't be read, and nothing is imported

## MODIFIED Requirements

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
