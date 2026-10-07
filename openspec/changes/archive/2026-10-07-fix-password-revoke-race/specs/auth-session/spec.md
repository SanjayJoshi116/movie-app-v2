## MODIFIED Requirements

### Requirement: Credential changes revoke other sessions
When a user changes their password from their profile, or completes a password reset, the system SHALL revoke every refresh token issued for that account before the change. That includes a refresh token rotated by a refresh request that was in flight while the change happened. Access tokens issued before the change SHALL be rejected from the moment the change is saved, not when they expire. After a profile password change, the response SHALL include a new access and refresh token pair, which the client SHALL store so the session that made the change stays signed in.

#### Scenario: Password reset ends existing sessions
- **WHEN** a user has active sessions on two devices and completes a password reset
- **THEN** each device's next token refresh is rejected and that device is sent to the login page

#### Scenario: Profile password change keeps the current session
- **WHEN** a signed-in user changes their password from the profile dialog
- **THEN** that session stays signed in across subsequent token refreshes, and any other session's next token refresh is rejected

#### Scenario: Non-password profile edits do not revoke
- **WHEN** a user updates only their first or last name
- **THEN** no session is revoked and no new tokens are issued

#### Scenario: Refresh racing a password change
- **WHEN** another device's refresh request passes validation before the password change is saved, and its rotated refresh token is recorded after the revocation ran
- **THEN** the next refresh with that rotated token is rejected, and so is any API request made with the access token returned alongside it

#### Scenario: Other sessions' access tokens stop at once
- **WHEN** a user changes their password while another device holds an unexpired access token
- **THEN** that device's next API request with that access token is rejected as unauthorized

#### Scenario: Tokens from before this rule
- **WHEN** a client presents a refresh or access token issued before password-bound tokens were introduced
- **THEN** the token is rejected as unauthorized and the user is sent to the login page
