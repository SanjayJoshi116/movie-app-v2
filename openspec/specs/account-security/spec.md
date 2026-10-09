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

### Requirement: Password fields in the profile dialog are not retained
The profile dialog's password inputs (the account-deletion confirmation password and the new-password field) SHALL be empty each time the dialog opens. The account-deletion password SHALL also be cleared after a failed deletion attempt.

#### Scenario: Reopening the profile dialog
- **WHEN** the user types into the account-deletion password field, closes the profile dialog and reopens it
- **THEN** the account-deletion password field is empty

#### Scenario: Failed account deletion
- **WHEN** an account-deletion attempt fails because the password is wrong
- **THEN** an error is shown and the password field is cleared

### Requirement: Disconnecting TMDB revokes the session
When a user disconnects their TMDB account, or deletes their account while TMDB is connected, the system SHALL ask TMDB to revoke the stored session before forgetting it. A failed revocation SHALL be logged and SHALL NOT block the disconnect or the account deletion.

#### Scenario: Disconnect
- **WHEN** a connected user disconnects TMDB
- **THEN** TMDB is asked to delete that session, and the user shows as disconnected

#### Scenario: TMDB unreachable during disconnect
- **WHEN** the revocation request to TMDB fails
- **THEN** the user is still disconnected, and the failure is logged without the session id or API key

#### Scenario: Account deleted while connected
- **WHEN** a user with a connected TMDB account deletes their account
- **THEN** TMDB is asked to delete that session before the account is removed

### Requirement: TMDB connect completes only for the user who started it
The system SHALL remember the TMDB request token it issued to each user. Creating a TMDB session SHALL succeed only with the token most recently issued to the requesting user, only once, and only while it is unexpired (60 minutes, TMDB's own token lifetime). Any other token SHALL be rejected with `400` and a message telling the user to start the connection again from their profile, and no session SHALL be stored.

#### Scenario: Normal connect
- **WHEN** a user starts a TMDB connection, approves it on TMDB, and returns to the callback page
- **THEN** the session is created and the user shows as connected

#### Scenario: Forged callback link
- **WHEN** a signed-in user opens a callback link carrying a request token that was issued to a different user
- **THEN** the response is `400`, the user's stored TMDB session is unchanged, and the page shows the start-again message

#### Scenario: Token replayed
- **WHEN** the callback for an already-used request token is opened again
- **THEN** the response is `400` and no session is created

#### Scenario: Token expired
- **WHEN** a user returns to the callback more than 60 minutes after starting the connection
- **THEN** the response is `400` and no session is created

### Requirement: Reconnecting TMDB revokes the previous session
When a user who already has a stored TMDB session connects again, the system SHALL ask TMDB to revoke the previous session before storing the new one. A failed revocation SHALL be logged without the session id and SHALL NOT block the new connection.

#### Scenario: Reconnect
- **WHEN** a connected user completes a new TMDB connection
- **THEN** TMDB is asked to delete the old session, and only the new session is stored

### Requirement: Repeated failed logins for one username are limited
Besides the per-IP login limit, the system SHALL count failed login attempts per username (case-insensitive) across all IPs and workers. Once a username has 20 failed attempts within one hour, every login attempt for that username SHALL get `429` until the hour has passed, even with the correct password. This SHALL be checked before the password, and the response SHALL be the same whether or not the username exists. Password reset SHALL keep working for a limited username.

#### Scenario: Distributed guessing
- **WHEN** 20 failed logins for username `alice` arrive from 20 different IPs within an hour
- **THEN** the 21st attempt for `alice`, from any IP and with any password, gets `429`

#### Scenario: Other users unaffected
- **WHEN** `alice` is limited
- **THEN** `bob` can still sign in from the same IP, within the per-IP limit

#### Scenario: Window passes
- **WHEN** an hour has passed since the failures that triggered the limit
- **THEN** `alice` can sign in with the correct password

### Requirement: Password reset response time doesn't reveal registered emails
A password-reset request SHALL get the same response whether or not the email belongs to an account, and SHALL NOT wait for the email to be sent before responding.

#### Scenario: Slow mail server
- **WHEN** the mail server takes several seconds to accept a message and a reset is requested for a registered email
- **THEN** the response returns without waiting for the mail server, with the same body as for an unregistered email
