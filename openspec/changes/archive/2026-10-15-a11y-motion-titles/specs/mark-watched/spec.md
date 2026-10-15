## ADDED Requirements

### Requirement: The dialog holds while saving
While a Mark as Watched save is in flight, the dialog SHALL show it is saving and SHALL NOT close by Cancel, the close button, the mask or Escape, and a second confirm SHALL NOT send a second save. A save that succeeds SHALL close the dialog. A save that fails SHALL show the error and leave the dialog open with the runtime and platform as entered, so the user can retry.

#### Scenario: Slow save
- **WHEN** a user confirms Mark as Watched and the save takes a few seconds
- **THEN** the confirm button shows it is saving, and pressing Escape or Cancel doesn't close the dialog

#### Scenario: Failed save
- **WHEN** the save fails
- **THEN** an error is shown and the dialog stays open with the runtime and platform the user entered

#### Scenario: Success
- **WHEN** the save succeeds
- **THEN** the dialog closes and the title is marked watched
