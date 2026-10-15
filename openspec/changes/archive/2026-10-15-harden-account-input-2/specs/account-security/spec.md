## ADDED Requirements

### Requirement: Changing the username requires the current password
A profile update that changes the account's username SHALL be rejected unless it includes the correct current password. A wrong password SHALL count toward the per-username failure limit, like other password-gated actions. An update that resubmits the unchanged username SHALL NOT require the password. After a successful change, the account's email address, if it has one, SHALL be told the username changed; the notice SHALL be sent only after the change is committed and SHALL NOT delay or fail the update.

#### Scenario: Rename without password
- **WHEN** a signed-in user submits a new username and no current password
- **THEN** the update is rejected with a field error on the current password, and the username is unchanged

#### Scenario: Rename with wrong password
- **WHEN** a signed-in user submits a new username with an incorrect current password
- **THEN** the update is rejected with "Incorrect password.", the username is unchanged, and the failure counts toward that username's limit

#### Scenario: Rename with correct password
- **WHEN** a signed-in user submits a new, unused username with the correct current password
- **THEN** the username is updated and the account's email receives a notice that the username changed

#### Scenario: Unchanged username resubmitted
- **WHEN** a user saves the profile dialog after changing only their first name, and the form resubmits the existing username
- **THEN** the update succeeds without a current password

### Requirement: Passwords can't resemble the account's details
A new password SHALL be rejected when it is too similar to the account's username, email address, first name or last name. This SHALL apply at registration, to a password change in the profile, and to a password reset. The rejection SHALL say why.

#### Scenario: Registration with the username in the password
- **WHEN** someone registers as `alice` with the password `alice2024`
- **THEN** registration is rejected with an error on the password saying it is too similar to the username, and no account is created

#### Scenario: Profile change to a password like the email
- **WHEN** a user whose email is `bob.smith@example.com` changes their password to `bobsmith123` with the correct current password
- **THEN** the change is rejected and the old password still works

#### Scenario: Password reset
- **WHEN** a user resets their password to one that is their username followed by digits
- **THEN** the reset is rejected and the reset link can still be used with a different password

## MODIFIED Requirements

### Requirement: Repeated failed logins for one username are limited
Besides the per-IP login limit, the system SHALL count failed login attempts per username, matched exactly as sign-in matches it (letter case included), across all IPs and workers. Once a username has 20 failed attempts within one hour of its first counted failure, every login attempt for that username SHALL get `429` until that hour has passed, even with the correct password. The hour SHALL be measured from the first failure in the window and SHALL NOT be shortened or extended by later failures. Failures that arrive at the same moment SHALL each be counted. The limit SHALL be checked before the password, and the response SHALL be the same whether or not the username exists. Password reset SHALL keep working for a limited username. This behavior SHALL be the same in production as in development.

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

#### Scenario: Usernames that differ by case are separate
- **WHEN** accounts `alice` and `Alice` both exist and `Alice` reaches 20 failures
- **THEN** `alice` can still sign in with the correct password

#### Scenario: Window passes
- **WHEN** an hour has passed since the first failure in the window that triggered the limit
- **THEN** `alice` can sign in with the correct password
