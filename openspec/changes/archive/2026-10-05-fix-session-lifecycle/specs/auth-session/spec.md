## Purpose

Defines how an authenticated session is kept alive, shared across concurrent requests, revoked, and torn down, so users stay signed in for the full session lifetime and credential changes reliably end other sessions.

## ADDED Requirements

### Requirement: Session survives the full refresh-token lifetime
The client SHALL store both the access token and the refresh token returned by every successful token refresh, and SHALL use the most recently issued refresh token for the next refresh. An actively used session SHALL NOT be ended by the refresh mechanism before the refresh-token lifetime expires.

#### Scenario: Multiple consecutive refreshes
- **WHEN** a signed-in user keeps using the app long enough for the access token to expire three times in a row
- **THEN** each expiry is handled by a successful refresh and the user is never redirected to the login page

#### Scenario: Rotated token is persisted
- **WHEN** a token refresh succeeds and the server returns a new refresh token
- **THEN** the stored refresh token is replaced by the new one before any further request is sent

### Requirement: Concurrent unauthorized responses trigger at most one refresh
When several in-flight requests get `401` because the access token expired, the client SHALL perform a single refresh and replay every affected request with the new access token. A `401` for a request that was sent with an access token that has since been replaced SHALL be replayed with the current access token without starting another refresh.

#### Scenario: Burst of expired requests
- **WHEN** five requests are sent with an expired access token and all receive `401`
- **THEN** exactly one refresh request is made and all five original requests are retried with the new token

#### Scenario: Late 401 after refresh completed
- **WHEN** a request sent with the old access token gets its `401` after a refresh has already finished
- **THEN** the request is retried once with the current access token, and no second refresh request is made

#### Scenario: Refresh genuinely fails
- **WHEN** the refresh request itself is rejected (e.g. the refresh token is expired or revoked)
- **THEN** the session is torn down (see "Client teardown removes all account-scoped data") and the user is sent to the login page

### Requirement: Credential changes revoke other sessions
When a user changes their password from their profile, or completes a password reset, the system SHALL revoke every refresh token issued for that account before the change. After a profile password change, the response SHALL include a new access and refresh token pair, which the client SHALL store so the session that made the change stays signed in.

#### Scenario: Password reset ends existing sessions
- **WHEN** a user has active sessions on two devices and completes a password reset
- **THEN** each device's next token refresh is rejected and that device is sent to the login page

#### Scenario: Profile password change keeps the current session
- **WHEN** a signed-in user changes their password from the profile dialog
- **THEN** that session stays signed in across subsequent token refreshes, and any other session's next token refresh is rejected

#### Scenario: Non-password profile edits do not revoke
- **WHEN** a user updates only their first or last name
- **THEN** no session is revoked and no new tokens are issued

### Requirement: Logout revokes the session server-side
The system SHALL provide a logout endpoint that accepts a refresh token and revokes it. Possession of the refresh token is the only credential it requires, so logout works even when the access token has already expired. The client SHALL call it on explicit logout. A failure of that call SHALL NOT stop the client from completing logout locally.

#### Scenario: Revoked after logout
- **WHEN** a user logs out and the same refresh token is later submitted for refresh
- **THEN** the refresh is rejected

#### Scenario: Logout while offline
- **WHEN** a user logs out and the logout request fails because the server is unreachable
- **THEN** the user is still signed out locally and sees the logged-out state

#### Scenario: Logout with an expired access token
- **WHEN** a user whose access token has expired logs out
- **THEN** their refresh token is revoked without the client first performing a token refresh

#### Scenario: Logout with an invalid token
- **WHEN** the logout endpoint receives a refresh token that is malformed or already revoked
- **THEN** it responds with a client error (not a server error), and the client still completes local logout

### Requirement: Client teardown removes all account-scoped data
On any logout, explicit or forced by a failed refresh, the client SHALL remove the stored tokens and cached user, all per-tab cached data (cached recommendations, cached search results, list/filter state), and the recent-search history. A different user who then signs in within the same tab SHALL see none of the previous user's data.

#### Scenario: Switching accounts in one tab
- **WHEN** user A views their recommendations and searches, logs out, and user B logs in within the same browser tab
- **THEN** user B's recommendations page shows B's data (or a loading state), not A's cached recommendations, and B's recent searches don't include A's queries

#### Scenario: Forced logout clears the same data
- **WHEN** a session is ended because a token refresh failed
- **THEN** the same data is cleared as on an explicit logout

### Requirement: Automatic retries never repeat writes
The authenticated API client SHALL automatically retry a request after a `500` response only when the request method is `GET`, `HEAD`, or `OPTIONS`. Requests with any other method SHALL surface the `500` to the caller without retrying.

#### Scenario: Read hits a transient 500
- **WHEN** a `GET` request receives a `500` and the retry succeeds
- **THEN** the caller receives the successful response

#### Scenario: Create hits a 500
- **WHEN** a `POST` that creates a list receives a `500`
- **THEN** the request is not re-sent and the caller receives the error, so at most one list can have been created
