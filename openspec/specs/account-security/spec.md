# account-security Specification

## Purpose

Protects control of an account by requiring proof of the current password before changing the email that password resets are sent to, and by bounding how long a password-reset link stays valid.

## Requirements

### Requirement: Changing email requires the current password
A profile update that changes the account's email address (compared case-insensitively with the current one) SHALL be rejected unless it includes the correct current password. An update that resubmits the unchanged email SHALL NOT require the password.

#### Scenario: Email change without password
- **WHEN** a signed-in user submits a profile update with a new email and no current password
- **THEN** the update is rejected with a field error on the current password, and the email is unchanged

#### Scenario: Email change with wrong password
- **WHEN** a signed-in user submits a new email with an incorrect current password
- **THEN** the update is rejected with "Incorrect password." and the email is unchanged

#### Scenario: Email change with correct password
- **WHEN** a signed-in user submits a new, unused email with the correct current password
- **THEN** the email is updated

#### Scenario: Unchanged email resubmitted
- **WHEN** a user saves the profile dialog after changing only their first name, and the form resubmits the existing email (in any letter case)
- **THEN** the update succeeds without a current password

### Requirement: Email addresses are unique across accounts
A profile update SHALL be rejected if the new email matches, case-insensitively, the email of any other account.

#### Scenario: Taking another user's email
- **WHEN** a user tries to change their email to one already used by another account (differing only in letter case)
- **THEN** the update is rejected with "An account with this email already exists." and the email is unchanged

### Requirement: Previous address is notified of an email change
When an account's email is changed, the system SHALL send a notification to the previous address saying the email was changed. Failing to send it SHALL NOT fail the update.

#### Scenario: Notification sent
- **WHEN** a user changes their email from A to B
- **THEN** a message is sent to A saying the account email was changed

#### Scenario: Mail backend failure
- **WHEN** the mail backend raises an error while sending that notification
- **THEN** the email change still succeeds and the failure is logged

### Requirement: Password reset links expire after one hour
A password-reset link SHALL be accepted only within 1 hour of being issued, and the reset email SHALL state that same lifetime.

#### Scenario: Link used within the hour
- **WHEN** a user opens a reset link 30 minutes after requesting it and sets a valid new password
- **THEN** the password is changed

#### Scenario: Link used after expiry
- **WHEN** a user submits a reset link more than 1 hour after it was issued
- **THEN** the reset is rejected with "Reset link is invalid or has expired."
