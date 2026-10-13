## ADDED Requirements

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
