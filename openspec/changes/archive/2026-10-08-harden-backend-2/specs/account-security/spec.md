## ADDED Requirements

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
