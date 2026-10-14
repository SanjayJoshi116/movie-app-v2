## MODIFIED Requirements

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

### Requirement: Reconnecting TMDB revokes the previous session
When a user who already has a stored TMDB session connects again, the system SHALL store the new session first and then ask TMDB to revoke the previous one, without the request waiting for the revocation. A failed revocation SHALL be logged without the session id and SHALL NOT block the new connection. The stored session SHALL never be one that was revoked.

#### Scenario: Reconnect
- **WHEN** a connected user completes a new TMDB connection
- **THEN** only the new session is stored, and TMDB is asked to delete the old session

#### Scenario: Saving the new session fails
- **WHEN** a connected user completes a new TMDB connection and storing the new session fails
- **THEN** the old session is not revoked and stays stored, and the response is the "Couldn't reach TMDB" error
