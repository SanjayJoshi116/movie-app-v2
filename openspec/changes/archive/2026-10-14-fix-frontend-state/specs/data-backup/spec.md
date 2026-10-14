## ADDED Requirements

### Requirement: File downloads are not cut short
Every file the app offers for download (CSV exports, the backup ZIP, import templates and the calendar file) SHALL be handed to the browser in a way that lets the download finish. The temporary address of the file SHALL be released only after the download has started.

#### Scenario: Export a large watched history
- **WHEN** a user exports a watched history of several thousand entries
- **THEN** the browser saves the complete CSV file

#### Scenario: Download a calendar file
- **WHEN** a user downloads the upcoming-releases calendar
- **THEN** the browser saves the `.ics` file, and its temporary address is released afterwards
