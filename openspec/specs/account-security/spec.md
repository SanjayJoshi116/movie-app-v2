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
When an account's email is changed, the system SHALL send a notification to the previous address saying the email was changed. The notice SHALL be sent only after the change is committed, and the profile response SHALL NOT wait for the mail server. Failing to send it, or a mail server that doesn't answer, SHALL NOT fail or delay the update, nor stop the rest of the update (token revocation and reissue on a password change) from completing. Every outgoing mail connection SHALL give up after a bounded timeout.

#### Scenario: Notification sent
- **WHEN** a user changes their email from A to B
- **THEN** a message is sent to A saying the account email was changed

#### Scenario: Mail backend failure
- **WHEN** the mail backend raises an error while sending that notification
- **THEN** the email change still succeeds and the failure is logged

#### Scenario: Stalled mail server
- **WHEN** a user changes their email and password together while the mail server accepts the connection but never answers
- **THEN** the response returns promptly with the updated user and fresh tokens, and the user's other sessions are revoked

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
When a user disconnects their TMDB account, or deletes their account while TMDB is connected, the system SHALL first forget the stored session (or delete the account), and then ask TMDB to revoke that session without the request waiting for TMDB. A failed or slow revocation SHALL be logged and SHALL NOT block or undo the disconnect or the account deletion.

#### Scenario: Disconnect
- **WHEN** a connected user disconnects TMDB
- **THEN** the user shows as disconnected, and TMDB is asked to delete that session

#### Scenario: TMDB unreachable during disconnect
- **WHEN** the revocation request to TMDB fails
- **THEN** the user is still disconnected, and the failure is logged without the session id or API key

#### Scenario: Account deleted while connected
- **WHEN** a user with a connected TMDB account deletes their account
- **THEN** the account is deleted, and TMDB is then asked to delete that session

#### Scenario: TMDB hangs during account deletion
- **WHEN** a user with a connected TMDB account deletes their account while TMDB never answers
- **THEN** the account is deleted and the response arrives without waiting for TMDB

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
When a user who already has a stored TMDB session connects again, the system SHALL store the new session first and then ask TMDB to revoke the previous one, without the request waiting for the revocation. A failed revocation SHALL be logged without the session id and SHALL NOT block the new connection. The stored session SHALL never be one that was revoked.

#### Scenario: Reconnect
- **WHEN** a connected user completes a new TMDB connection
- **THEN** only the new session is stored, and TMDB is asked to delete the old session

#### Scenario: Saving the new session fails
- **WHEN** a connected user completes a new TMDB connection and storing the new session fails
- **THEN** the old session is not revoked and stays stored, and the response is the "Couldn't reach TMDB" error

### Requirement: Repeated failed logins for one username are limited
Besides the per-IP login limit, the system SHALL count failed login attempts per username (case-insensitive) across all IPs and workers. Once a username has 20 failed attempts within one hour of its first counted failure, every login attempt for that username SHALL get `429` until that hour has passed, even with the correct password. The hour SHALL be measured from the first failure in the window and SHALL NOT be shortened or extended by later failures. Failures that arrive at the same moment SHALL each be counted. The limit SHALL be checked before the password, and the response SHALL be the same whether or not the username exists. Password reset SHALL keep working for a limited username. This behavior SHALL be the same in production as in development.

#### Scenario: Distributed guessing
- **WHEN** 20 failed logins for username `alice` arrive from 20 different IPs within an hour
- **THEN** the 21st attempt for `alice`, from any IP and with any password, gets `429`

#### Scenario: Parallel burst
- **WHEN** 20 failed logins for `alice` are sent concurrently from different IPs
- **THEN** all 20 are counted, and the next attempt for `alice` gets `429`

#### Scenario: Limit outlasts the default cache timeout
- **WHEN** `alice` reaches 20 failures and 10 minutes later tries the correct password
- **THEN** the attempt gets `429`

#### Scenario: Other users unaffected
- **WHEN** `alice` is limited
- **THEN** `bob` can still sign in from the same IP, within the per-IP limit

#### Scenario: Window passes
- **WHEN** an hour has passed since the first failure in the window that triggered the limit
- **THEN** `alice` can sign in with the correct password

### Requirement: Password reset response time doesn't reveal registered emails
A password-reset request SHALL get the same response whether or not the email belongs to an account, and SHALL NOT wait for the email to be sent before responding.

#### Scenario: Slow mail server
- **WHEN** the mail server takes several seconds to accept a message and a reset is requested for a registered email
- **THEN** the response returns without waiting for the mail server, with the same body as for an unregistered email

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

### Requirement: An email address belongs to one account
Registration and profile updates SHALL NOT leave two accounts with the same email address (compared case-insensitively, using the same case folding as the uniqueness check), even when two requests that use the same new address arrive at the same time, including addresses whose upper- and lower-case forms differ in length. The later request SHALL be rejected with a field error on the email.

#### Scenario: Two accounts switch to one address at once
- **WHEN** two signed-in users submit a profile update changing their email to `same@example.com` at the same moment
- **THEN** exactly one update succeeds, and the other is rejected with an email error

#### Scenario: Differently cased Unicode address at once
- **WHEN** two requests register `straße@example.com` and `STRASSE@example.com` at the same moment, and the uniqueness check treats them as equal
- **THEN** exactly one succeeds

### Requirement: Password-gated actions share the per-username failure limit
A wrong current password on a profile update and a wrong password on account deletion SHALL each count as a failed attempt toward that username's per-username limit. While the username is limited, both actions SHALL get `429` before the password is checked, even with the correct password. Profile updates that don't include a password SHALL NOT be affected.

#### Scenario: Guessing with a stolen session
- **WHEN** a signed-in session submits 20 profile updates with wrong current passwords within an hour
- **THEN** the next profile update with a password, and the next account deletion, get `429` even with the correct password, and login for that username gets `429` too

#### Scenario: Name-only edit while limited
- **WHEN** a limited user saves a profile update that changes only their first name
- **THEN** the update succeeds

### Requirement: A password reset clears the per-username limit
Completing a password reset SHALL clear that account's failed-attempt count, so the user can sign in with the new password straight away.

#### Scenario: Locked out by someone else
- **WHEN** `alice` is limited by other people's guesses and then completes a password reset
- **THEN** her next login with the new password succeeds

### Requirement: Reset confirmation has its own rate limit
Submitting a reset confirmation SHALL be rate limited separately from requesting a reset link, so validation errors on the confirmation form don't use up the allowance for requesting a link, or the reverse.

#### Scenario: Validation errors on the confirm form
- **WHEN** a user requests two reset links and then submits the confirmation form three times with a too-short password
- **THEN** a fourth confirmation with a valid password is accepted, not `429`
