## MODIFIED Requirements

### Requirement: Client teardown removes all account-scoped data
On any logout, explicit or forced by a failed refresh, the client SHALL remove the stored tokens and cached user, all per-tab cached data (cached recommendations, cached search results, list/filter state), and the recent-search history. A different user who then signs in within the same tab SHALL see none of the previous user's data. This SHALL hold whichever page the user is on when the logout happens. In particular, no page SHALL write account-scoped data back to storage after the teardown has run (for example, while the page unmounts because of the logout).

#### Scenario: Switching accounts in one tab
- **WHEN** user A views their recommendations and searches, logs out, and user B logs in within the same browser tab
- **THEN** user B's recommendations page shows B's data (or a loading state), not A's cached recommendations, and B's recent searches don't include A's queries

#### Scenario: Forced logout clears the same data
- **WHEN** a session is ended because a token refresh failed
- **THEN** the same data is cleared as on an explicit logout

#### Scenario: Logging out from a page that caches its results
- **WHEN** user A is on the recommendations page (or the search results page) and logs out from there, and user B then logs in within the same tab and opens that page
- **THEN** B sees B's own data or a loading state, and no cached recommendations or search results from A are present in session storage after A's logout

## ADDED Requirements

### Requirement: Token refresh is coordinated across tabs
When several tabs of the same browser need a token refresh at the same time, the client SHALL serialize their refresh attempts so that the refresh token is rotated only once. The other tabs SHALL then use the tokens the first one stored. Browsers may propagate storage changes between tabs with a delay, so a waiting tab can still submit the already-rotated token once. A tab whose refresh attempt is rejected SHALL NOT end the session if a different (newer) refresh token has been stored by another tab, either already or within a short grace period. It SHALL use the newly stored tokens instead.

#### Scenario: Two tabs wake up with expired tokens
- **WHEN** two open tabs of the app each send a request with the same expired access token at the same moment (e.g. after the computer wakes from sleep) and both get `401`
- **THEN** the refresh token is rotated exactly once (at most one refresh request succeeds), both tabs' requests are retried successfully with the new access token, and neither tab is sent to the login page

#### Scenario: Rotation reaches the other tab late
- **WHEN** a tab's refresh attempt is rejected because another tab just rotated the token, and that rotation becomes visible to this tab only after the rejection arrives
- **THEN** the tab waits briefly for it, adopts the new tokens, retries its request successfully, and is not sent to the login page

#### Scenario: Refresh token genuinely invalid in every tab
- **WHEN** the stored refresh token has been revoked (e.g. by a password reset) and two tabs both need a refresh
- **THEN** both tabs end the session and go to the login page, as with a single tab

### Requirement: A refresh that finishes after logout does not restore the session
If the user logs out while a token refresh is in flight, the client SHALL NOT store the tokens returned by that refresh. The client SHALL stay signed out.

#### Scenario: Logout during a slow refresh
- **WHEN** a token refresh is in progress and the user clicks Sign Out before the refresh response arrives
- **THEN** after the refresh response arrives, no access or refresh token is present in storage, and later API calls are sent without credentials
