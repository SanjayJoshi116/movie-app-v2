## ADDED Requirements

### Requirement: Imported times name a real moment
Every import (the Watched CSV import, a CSV import into a list, and a backup restore) SHALL treat a date or date-time whose day or time doesn't exist (30 February, 29 February outside a leap year, 31 April, hour 24, minute or second 60 or more) as unreadable, like any other time it can't read: that row SHALL get the import time and every other row SHALL keep its own.

#### Scenario: 30 February in a Watched CSV
- **WHEN** a 300-row watched CSV has one row whose `watched_at` is `2024-02-30T12:00:00Z`
- **THEN** all 300 rows are imported, that row with the import time and the others with their own times

#### Scenario: Leap day in a non-leap year in a backup
- **WHEN** a backup's `watchlist.csv` has a row whose `added_at` is `2023-02-29`
- **THEN** every row is restored, that one with the restore time

#### Scenario: A real leap day is kept
- **WHEN** a watched CSV row has `watched_at` `2024-02-29`
- **THEN** the entry is stored as watched on 29-02-2024

### Requirement: Imported ids are whole numbers the server accepts
Every import SHALL read a title id, person id, season or episode only when the cell is a whole number from 1 to 2,147,483,647, written in digits alone. A row whose id is anything else (`550x`, `1.9`, `1e9`, a value above the limit) SHALL be skipped, never imported under another id and never sent, and every other row SHALL be imported.

#### Scenario: Id with trailing text
- **WHEN** a watched CSV has a row with id `550x` and 99 valid rows
- **THEN** the 99 rows are imported and no title 550 is added for the bad row

#### Scenario: Id above the limit
- **WHEN** a 600-row watched CSV has one row with id `99999999999`
- **THEN** the other 599 rows are imported

#### Scenario: Episode number in exponent form in a backup
- **WHEN** a backup's `episode_progress.csv` has a row with episode `1e3`
- **THEN** that row isn't restored and every other show's progress is

### Requirement: Backup follows drop bad values per row
Restoring a backup SHALL apply the same per-row rules to `followed.csv` as to the other sections: a person name longer than 500 characters SHALL be shortened to its first 500 (counted as the server counts them), a profile image path SHALL be dropped when it doesn't start with `/` or is longer than 500 characters, and a followed time that isn't a valid time between 1900 and 5 minutes after the device's current time SHALL be replaced by the restore time. One bad value SHALL NOT keep any other follow or episode progress from being restored.

#### Scenario: Future followed time
- **WHEN** a backup's `followed.csv` has 600 rows and one has a `followed_at` next year
- **THEN** all 600 people are followed, that one with the restore time

#### Scenario: Oversized name
- **WHEN** a backup's `followed.csv` has a row whose name is 700 characters
- **THEN** that person is followed with the first 500 characters of the name, and every other row as in the file

#### Scenario: Bad profile path
- **WHEN** a backup's `followed.csv` has a row whose `profile_path` is `http://example.com/a.jpg`
- **THEN** that person is followed without a profile image
