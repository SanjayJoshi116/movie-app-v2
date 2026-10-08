## ADDED Requirements

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
