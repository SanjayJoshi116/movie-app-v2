## MODIFIED Requirements

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

### Requirement: An email address belongs to one account
Registration and profile updates SHALL NOT leave two accounts with the same email address (compared case-insensitively, using the same case folding as the uniqueness check), even when two requests that use the same new address arrive at the same time, including addresses whose upper- and lower-case forms differ in length. The later request SHALL be rejected with a field error on the email.

#### Scenario: Two accounts switch to one address at once
- **WHEN** two signed-in users submit a profile update changing their email to `same@example.com` at the same moment
- **THEN** exactly one update succeeds, and the other is rejected with an email error

#### Scenario: Differently cased Unicode address at once
- **WHEN** two requests register `straße@example.com` and `STRASSE@example.com` at the same moment, and the uniqueness check treats them as equal
- **THEN** exactly one succeeds

## ADDED Requirements

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
