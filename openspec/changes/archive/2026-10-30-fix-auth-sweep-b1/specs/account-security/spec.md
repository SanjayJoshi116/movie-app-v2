## ADDED Requirements

### Requirement: A profile update changes only the fields it edits
A profile update SHALL write only the account fields it changes (and the password when it sets a new one). It SHALL NOT write back any other stored value, so a change committed while the update was in flight (a password reset, another profile edit) is kept.

#### Scenario: Password reset during a profile edit
- **WHEN** a profile update that changes only the first name was authenticated before a password reset for the same account committed, and saves after it
- **THEN** the new password from the reset still signs in, the old password does not, and the first name is updated

### Requirement: Verifying the current password leaves the stored password unchanged
Checking the current password in a profile update SHALL NOT rewrite the stored password, even when the server's password-hashing parameters have changed since it was set. The current password SHALL be checked at most once per update, however many password-gated fields the update changes. A profile update that fails SHALL leave the session's tokens valid.

#### Scenario: Failed update after a hashing upgrade
- **WHEN** the server's hashing parameters changed since the user's password was set, and the user sends a profile update with the correct current password that then fails validation
- **THEN** the response is `400`, the stored password is unchanged, and the user's existing tokens keep working

#### Scenario: Several gated fields at once
- **WHEN** an update changes the email, the username and the password with the correct current password
- **THEN** the current password is verified once and the update succeeds

### Requirement: A successful sign-in clears the failure count and ends earlier reset links
A successful login SHALL clear the failed-attempt count for that username and record the sign-in time, so a password reset link mailed before the sign-in no longer works. A login refused by the per-username limit is not successful and SHALL change neither.

#### Scenario: Typos then a correct password
- **WHEN** `alice` has 19 failed attempts in the window and then signs in with the correct password
- **THEN** her failure count is cleared, so one more mistyped password does not limit her

#### Scenario: Reset link mailed before a sign-in
- **WHEN** a reset link is mailed to `alice` and she then signs in normally with her password
- **THEN** that reset link is rejected as invalid or expired

### Requirement: A password reset reaches every active account on the address
A reset request SHALL send one reset link for each active account with a usable password whose email matches the address (case-insensitively), and none for inactive accounts or accounts without a usable password. The response SHALL be the same whether zero, one or several accounts match.

#### Scenario: Two legacy accounts share an address
- **WHEN** accounts `alice` and `alice2` both have the email `a@x.com` and a reset is requested for `A@x.com`
- **THEN** two mails are sent to `a@x.com`, each with a link that resets its own account

#### Scenario: Inactive account
- **WHEN** a reset is requested for the email of an inactive account
- **THEN** no mail is sent and the response is the usual one

## MODIFIED Requirements

### Requirement: Reconnecting TMDB revokes the previous session
When a user who already has a stored TMDB session connects again, the system SHALL store the new session first and then ask TMDB to revoke the previous one, without the request waiting for the revocation. A failed revocation SHALL be logged without the session id and SHALL NOT block the new connection. The stored session SHALL never be one that was revoked. A session TMDB issued that could not be stored SHALL be revoked the same way, so no live session exists that the app doesn't know about.

#### Scenario: Reconnect
- **WHEN** a connected user completes a new TMDB connection
- **THEN** only the new session is stored, and TMDB is asked to delete the old session

#### Scenario: Saving the new session fails
- **WHEN** a connected user completes a new TMDB connection and storing the new session fails
- **THEN** the old session is not revoked and stays stored, TMDB is asked to delete the new session, and the response is the "Couldn't reach TMDB" error

### Requirement: TMDB connect completes only for the user who started it
The system SHALL remember the TMDB request token it issued to each user. Creating a TMDB session SHALL succeed only with the token most recently issued to the requesting user, only once (even when two requests submit it at the same moment), and only while it is unexpired (60 minutes, TMDB's own token lifetime). Any other token SHALL be rejected with `400` and a message telling the user to start the connection again from their profile, and no session SHALL be stored.

#### Scenario: Normal connect
- **WHEN** a user starts a TMDB connection, approves it on TMDB, and returns to the callback page
- **THEN** the session is created and the user shows as connected

#### Scenario: Forged callback link
- **WHEN** a signed-in user opens a callback link carrying a request token that was issued to a different user
- **THEN** the response is `400`, the user's stored TMDB session is unchanged, and the page shows the start-again message

#### Scenario: Token replayed
- **WHEN** the callback for an already-used request token is opened again
- **THEN** the response is `400` and no session is created

#### Scenario: Token submitted twice at once
- **WHEN** two requests submit the same valid request token concurrently
- **THEN** at most one of them asks TMDB for a session; the other gets `400`

#### Scenario: Token expired
- **WHEN** a user returns to the callback more than 60 minutes after starting the connection
- **THEN** the response is `400` and no session is created

### Requirement: Deleting an account clears its failed-attempt count
Deleting an account, or renaming it, SHALL clear the failed-attempt count for the username it gives up, so a new account registered with that username starts with no failed attempts.

#### Scenario: Username reused after deletion
- **WHEN** `alice` has failed sign-in attempts recorded, deletes her account, and someone registers a new account named `alice`
- **THEN** the new account's first sign-in with its correct password succeeds and is not limited

#### Scenario: Username freed by a rename
- **WHEN** `alice` has failed sign-in attempts recorded and renames her account to `alice2`
- **THEN** no failed-attempt count remains for `alice`
