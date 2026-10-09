## ADDED Requirements

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
