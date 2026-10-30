## MODIFIED Requirements

### Requirement: A library reload never undoes a newer write
A reload of the watchlist, watched history, ratings, lists or followed people that started before a write to the same collection finished SHALL NOT replace the collection with its result. The collection SHALL be loaded again instead, so what is shown matches the server after both. Removing or changing an item that was just added SHALL work straight away.

#### Scenario: Reload in flight while marking watched
- **WHEN** a watched-history reload is in flight, the user marks a title watched, the mark succeeds, and the reload then returns without that title
- **THEN** the title stays shown as watched, and unmarking it straight away removes it on the server

#### Scenario: Followed-people reload in flight while following
- **WHEN** a followed-people reload is in flight (after a restore, or Retry), the user follows a person, the follow succeeds, and the reload then returns without that person
- **THEN** the person stays shown as followed

## ADDED Requirements

### Requirement: Edit Profile holds while a change is being saved
While the Edit Profile dialog is saving a profile change, uploading or removing a photo, or deleting the account, it SHALL NOT close: no close button, no closing by clicking outside it, and no closing with Escape. It SHALL become closable again once the operation succeeds or fails.

#### Scenario: Closing during a password change
- **WHEN** the user saves a new password and tries to close the dialog before the server answers
- **THEN** the dialog stays open until the save finishes
