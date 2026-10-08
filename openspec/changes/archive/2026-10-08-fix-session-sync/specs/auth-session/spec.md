## ADDED Requirements

### Requirement: Each tab stays bound to the account it shows
A tab SHALL only send authenticated requests as the account it is currently displaying. When another tab of the same browser signs out, the tab SHALL clear its own per-tab cached data and show the signed-out state. When another tab signs in as a different account, the tab SHALL discard all state from the previous account and show the new account. When the stored account is the same user with updated profile data, the tab SHALL show the updated data without discarding state. Until the tab has caught up, any request it tries to send while the stored account differs from the account it displays SHALL fail without reaching the server.

#### Scenario: Other tab switches account
- **WHEN** tabs 1 and 2 both show account A, and tab 1 logs out and signs in as account B
- **THEN** tab 2 stops showing A's library and shows B's data (or a loading state), and nothing tab 2 does after the switch is saved to A

#### Scenario: Write attempted before the tab catches up
- **WHEN** tab 2 still displays account A, the stored session already belongs to account B, and the user clicks "mark watched" in tab 2
- **THEN** no request reaches the server, and B's library is unchanged

#### Scenario: Other tab signs out
- **WHEN** tabs 1 and 2 both show account A and the user signs out in tab 1
- **THEN** tab 2 shows the signed-out state, and its session storage holds no cached data from A

#### Scenario: Same account refreshed or edited elsewhere
- **WHEN** another tab of the same account rotates the tokens or saves a profile edit
- **THEN** this tab stays signed in on its current page, keeps its state, and shows the updated profile data

### Requirement: Token refresh and logout have their own rate limit
Token refresh and logout SHALL be rate-limited under their own limit, not the general anonymous daily limit. The limit SHALL be high enough that many users sharing one public IP address can each refresh hourly all day without being limited. A rate-limited request SHALL be answered with `429`.

#### Scenario: Many users behind one address
- **WHEN** 50 signed-in users behind the same public IP address each refresh their token 24 times in one day
- **THEN** every refresh succeeds

#### Scenario: Anonymous daily limit already used up
- **WHEN** the shared IP address has exhausted the general anonymous request limit for the day
- **THEN** token refresh and logout requests from that address still succeed

#### Scenario: Refresh flood
- **WHEN** one address sends refresh requests faster than the refresh limit allows
- **THEN** the excess requests get `429`

## MODIFIED Requirements

### Requirement: Concurrent unauthorized responses trigger at most one refresh
When several in-flight requests get `401` because the access token expired, the client SHALL perform a single refresh and replay every affected request with the new access token. A `401` for a request that was sent with an access token that has since been replaced SHALL be replayed with the current access token without starting another refresh. The client SHALL end the session only when the server rejects the refresh token itself. If the refresh fails for any other reason (rate limit, server error, timeout, network failure), the affected requests SHALL fail with that error and the user SHALL stay signed in, so a later request can refresh again.

#### Scenario: Burst of expired requests
- **WHEN** five requests are sent with an expired access token and all receive `401`
- **THEN** exactly one refresh request is made and all five original requests are retried with the new token

#### Scenario: Late 401 after refresh completed
- **WHEN** a request sent with the old access token gets its `401` after a refresh has already finished
- **THEN** the request is retried once with the current access token, and no second refresh request is made

#### Scenario: Refresh genuinely fails
- **WHEN** the server rejects the refresh request as unauthorized or invalid (e.g. the refresh token is expired or revoked)
- **THEN** the session is torn down (see "Client teardown removes all account-scoped data") and the user is sent to the login page

#### Scenario: Refresh is rate-limited or the server is unreachable
- **WHEN** the refresh request gets `429`, a `5xx`, times out, or fails with a network error
- **THEN** the original request fails with that error, the stored tokens are kept, the user is not sent to the login page, and the next request that gets `401` attempts a refresh again

### Requirement: Credential changes revoke other sessions
When a user changes their password from their profile, or completes a password reset, the system SHALL revoke every refresh token issued for that account before the change. That includes a refresh token rotated by a refresh request that was in flight while the change happened. Access tokens issued before the change SHALL be rejected from the moment the change is saved, not when they expire. After a profile password change, the response SHALL include a new access and refresh token pair, which the client SHALL store so the session that made the change stays signed in. Any profile update that invalidates the current session's tokens as a side effect (for example, the stored password hash being upgraded while the current password is verified) SHALL also return a new token pair, so the session that made the update stays signed in.

#### Scenario: Password reset ends existing sessions
- **WHEN** a user has active sessions on two devices and completes a password reset
- **THEN** each device's next token refresh is rejected and that device is sent to the login page

#### Scenario: Profile password change keeps the current session
- **WHEN** a signed-in user changes their password from the profile dialog
- **THEN** that session stays signed in across subsequent token refreshes, and any other session's next token refresh is rejected

#### Scenario: Non-password profile edits do not revoke
- **WHEN** a user updates only their first or last name
- **THEN** no session is revoked and no new tokens are issued

#### Scenario: Email change while the password hash is upgraded
- **WHEN** a user whose stored password hash uses outdated hasher parameters changes their email (which verifies the current password and upgrades the stored hash)
- **THEN** the response includes a new token pair, and the session that made the change stays signed in across its next requests and refreshes

#### Scenario: Refresh racing a password change
- **WHEN** another device's refresh request passes validation before the password change is saved, and its rotated refresh token is recorded after the revocation ran
- **THEN** the next refresh with that rotated token is rejected, and so is any API request made with the access token returned alongside it

#### Scenario: Other sessions' access tokens stop at once
- **WHEN** a user changes their password while another device holds an unexpired access token
- **THEN** that device's next API request with that access token is rejected as unauthorized

#### Scenario: Tokens from before this rule
- **WHEN** a client presents a refresh or access token issued before password-bound tokens were introduced
- **THEN** the token is rejected as unauthorized and the user is sent to the login page
