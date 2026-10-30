## ADDED Requirements

### Requirement: TMDB sessions are stored encrypted
A connected user's TMDB session SHALL be stored only in encrypted form, so the database alone (a dump, a backup, read access) never yields a working session. The app SHALL behave as before for the user: connecting, the connection status, rating sync, disconnecting and account deletion work unchanged.

#### Scenario: Reading the database
- **WHEN** a user has connected TMDB and someone reads the stored profile row directly from the database
- **THEN** the stored value is not the session and the session can't be recovered from the row without the server's key

#### Scenario: Sessions stored before this change
- **WHEN** the upgrade runs with users already connected
- **THEN** their stored sessions are encrypted during the upgrade and they stay connected

### Requirement: TMDB session keys can be rotated without disconnecting users
The server SHALL accept a list of session keys: the first encrypts new sessions, and every key in the list can read stored ones. A stored session that no configured key can read SHALL count as not connected (no error shown to the user, no server error), so the user can reconnect.

#### Scenario: Adding a new key
- **WHEN** an operator puts a new key first in the list and keeps the old key after it, and restarts the backend
- **THEN** users connected before the restart stay connected, and sessions connected afterwards are encrypted with the new key

#### Scenario: Old key removed too early
- **WHEN** the key that encrypted a user's session is removed from the list
- **THEN** the user's TMDB status reads as not connected, their rating changes are saved locally without a TMDB sync and without an error, and connecting again works
