## ADDED Requirements

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
