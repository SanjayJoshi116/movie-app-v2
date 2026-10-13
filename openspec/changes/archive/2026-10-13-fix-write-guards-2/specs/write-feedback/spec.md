## MODIFIED Requirements

### Requirement: Rating edits are kept until saved
The rating dialog SHALL stay open and show a saving state while a rating save is in flight. It SHALL close only after the save succeeds. When the save fails, the dialog SHALL stay open with the selected stars and review text intact. While a save or removal is in flight, the dialog SHALL NOT close from Cancel, its close button, the Escape key or a click outside it.

#### Scenario: Save succeeds
- **WHEN** the user saves a rating and the request succeeds
- **THEN** the dialog closes and the new rating is shown

#### Scenario: Save fails
- **WHEN** the user saves a rating with a review and the request fails
- **THEN** an error message is shown, and the dialog stays open with the same stars and review text

#### Scenario: Close attempted while saving
- **WHEN** the user presses Escape or clicks outside the dialog while a rating save is in flight
- **THEN** the dialog stays open until the save finishes and shows its result

## ADDED Requirements

### Requirement: Confirmation buttons are never covered
When an icon action asks for confirmation, its confirm button SHALL be clickable and tappable as soon as the confirmation opens. The action's tooltip SHALL NOT be shown while the confirmation is open.

#### Scenario: Unmark from the Watched page
- **WHEN** the user clicks or taps "Mark as unwatched" on a Watched card and then the confirmation's "Mark Unwatched" button
- **THEN** the title is unmarked, without having to move the pointer away first

### Requirement: Created items appear where the server orders them
After creating a list or following a person, the new list or person SHALL be shown in the same position it will have after a reload. Lists and followed people are ordered newest first.

#### Scenario: New list
- **WHEN** a user with three lists creates a fourth
- **THEN** the new list is shown first on the Lists page, as it is after a reload

#### Scenario: New follow
- **WHEN** a user who follows two people follows a third
- **THEN** the new person is shown first on the Following page
