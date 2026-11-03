## ADDED Requirements

### Requirement: A running import holds the dialog that opened it
While an import started from Edit Profile is running, Edit Profile SHALL NOT be closable either. Escape, a click outside and its close button SHALL do nothing, so the import dialog is never closed or unmounted mid-run.

#### Scenario: Escape during a restore
- **WHEN** a user opens Import All from Backup in Edit Profile, starts the restore, and presses Escape while poster lookups run
- **THEN** both dialogs stay open, the restore runs to its results once, and Edit Profile can be closed after it finishes

### Requirement: Only the latest file pick is imported
An import dialog SHALL parse and show only the file the user picked last: a slower parse of an earlier pick SHALL be discarded. While an import runs, the dialog's file picker SHALL be disabled.

#### Scenario: Two picks in a row
- **WHEN** a user picks a large backup and then, before it finishes reading, a small one
- **THEN** the dialog shows the small backup's name and contents, and Import All restores the small backup

#### Scenario: Picking during a run
- **WHEN** an import is running
- **THEN** the dialog's file picker can't be used until it finishes

### Requirement: An unexpected import failure is reported
When an import fails for a reason other than the session ending, its dialog SHALL show an error message and SHALL return to a state where the user can try again. It SHALL NOT fail silently.

#### Scenario: Poster lookup breaks
- **WHEN** a restore fails with an unexpected error during its poster lookups
- **THEN** an error message is shown and the Import All button can be used again
