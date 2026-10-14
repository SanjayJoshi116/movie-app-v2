## MODIFIED Requirements

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
