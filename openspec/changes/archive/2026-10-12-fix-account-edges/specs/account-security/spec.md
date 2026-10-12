## ADDED Requirements

### Requirement: An account may have no email address
An account registered without an email SHALL be able to save profile changes (names, username, password) without supplying one. A user SHALL be able to clear their email. Clearing it counts as an email change, so it requires the current password. A blank email SHALL NOT conflict with any other account, including other accounts without an email.

#### Scenario: Saving a profile without an email
- **WHEN** a user who registered without an email changes their first name in the profile dialog and saves
- **THEN** the update succeeds and the email stays blank

#### Scenario: Changing password without an email
- **WHEN** a user without an email submits a new password with the correct current password
- **THEN** the password is changed

#### Scenario: Clearing an email
- **WHEN** a user with an email clears the email field and saves with the correct current password
- **THEN** the account's email is blank

#### Scenario: Clearing an email without the password
- **WHEN** a user with an email clears the email field and saves without the current password
- **THEN** the update is rejected with a field error on the current password, and the email is unchanged

#### Scenario: Two accounts without an email
- **WHEN** another account already has a blank email and a user clears their own email with the correct current password
- **THEN** the update succeeds

### Requirement: The profile dialog opens with the saved profile
Each time the profile dialog opens, every field SHALL show the account's current saved values, and every password field (current, new, confirm, and the account-deletion password) SHALL be empty. Edits that were not saved SHALL NOT reappear on the next opening.

#### Scenario: Unsaved edits are discarded
- **WHEN** the user changes their first name and types a new password in the profile dialog, closes it without saving, and reopens it
- **THEN** the first name shows the saved value and the password fields are empty

#### Scenario: Profile changed elsewhere
- **WHEN** the profile was updated (for example from another tab) while the dialog was closed, and the user opens the dialog
- **THEN** the fields show the updated values
