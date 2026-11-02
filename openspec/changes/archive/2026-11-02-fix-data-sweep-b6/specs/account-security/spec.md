## MODIFIED Requirements

### Requirement: TMDB session keys can be rotated without disconnecting users
The server SHALL accept a list of session keys: the first encrypts new sessions, and every key in the list can read stored ones. A stored session that no configured key can read SHALL count as not connected (no error shown to the user, no server error), so the user can reconnect. Re-encrypting the stored sessions under the first key SHALL NOT overwrite a connect, reconnect or disconnect that commits while it runs: each user's stored session afterwards is the one their last committed change left, re-encrypted or not.

#### Scenario: Adding a new key
- **WHEN** an operator puts a new key first in the list and keeps the old key after it, and restarts the backend
- **THEN** users connected before the restart stay connected, and sessions connected afterwards are encrypted with the new key

#### Scenario: Old key removed too early
- **WHEN** the key that encrypted a user's session is removed from the list
- **THEN** the user's TMDB status reads as not connected, their rating changes are saved locally without a TMDB sync and without an error, and connecting again works

#### Scenario: Disconnect during a re-encryption run
- **WHEN** a user disconnects TMDB while the operator's re-encryption run is in progress
- **THEN** after the run the user is still disconnected, and their old session is not stored again
