## MODIFIED Requirements

### Requirement: Concurrent unauthorized responses trigger at most one refresh
When several in-flight requests get `401` because the access token expired, the client SHALL perform a single refresh and replay every affected request with the new access token. A `401` for a request that was sent with an access token that has since been replaced SHALL be replayed with the current access token without starting another refresh. A request that was already replayed after a refresh, whether it started the refresh or waited for it, SHALL NOT start another refresh if it gets `401` again: it SHALL fail with that error. The client SHALL end the session only when the server rejects the refresh token itself. If the refresh fails for any other reason (rate limit, server error, timeout, network failure), the affected requests SHALL fail with that error and the user SHALL stay signed in, so a later request can refresh again.

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

#### Scenario: A queued request is rejected again after the refresh
- **WHEN** a request waited for a refresh, was replayed with the new token, and gets `401` again
- **THEN** it fails with that `401`, and no second refresh request is made for it

### Requirement: Client teardown removes all account-scoped data
On any logout, explicit or forced by a failed refresh, the client SHALL remove the stored tokens and cached user, all per-tab cached data (cached recommendations, cached search results, list/filter state), and the recent-search history. It SHALL also reset the browse settings held in memory (search term, "include adult", genre picks, and the applied browse filters and sort) to their defaults. A different user who then signs in within the same tab SHALL see none of the previous user's data or settings. This SHALL hold whichever page the user is on when the logout happens. In particular, no page SHALL write account-scoped data back to storage after the teardown has run (for example, while the page unmounts because of the logout).

#### Scenario: Switching accounts in one tab
- **WHEN** user A views their recommendations and searches, logs out, and user B logs in within the same browser tab
- **THEN** user B's recommendations page shows B's data (or a loading state), not A's cached recommendations, and B's recent searches don't include A's queries

#### Scenario: Forced logout clears the same data
- **WHEN** a session is ended because a token refresh failed
- **THEN** the same data is cleared as on an explicit logout

#### Scenario: Logging out from a page that caches its results
- **WHEN** user A is on the recommendations page (or the search results page) and logs out from there, and user B then logs in within the same tab and opens that page
- **THEN** B sees B's own data or a loading state, and no cached recommendations or search results from A are present in session storage after A's logout

#### Scenario: Adult content setting
- **WHEN** user A turns on "include adult" and picks a genre on Movies, signs out, and user B signs in within the same tab and opens Movies
- **THEN** B's results exclude adult titles and have no genre filter

### Requirement: A forced logout returns the user to their page after signing in
When the session ends because a token refresh was rejected, the client SHALL send the user to the sign-in page. After signing in, the user SHALL return to the page they were on, with the same address (path, query and fragment), unless that page is a sign-in, registration or password-reset page. When the session ends on purpose instead (the user signs out, deletes the account, or signs out in another tab), the next sign-in in that tab SHALL go to the default page. A user who opens a protected page while signed out SHALL still return to it after signing in.

#### Scenario: Session expires on a list page
- **WHEN** a user is on `/lists/7?sort=title` and a request triggers a token refresh that the server rejects
- **THEN** the user lands on the sign-in page, and after signing in they are on `/lists/7?sort=title`

#### Scenario: Sign out, then someone else signs in
- **WHEN** user A is on `/search?q=something` and signs out, and user B signs in within the same tab
- **THEN** B lands on the default page, not `/search?q=something`

#### Scenario: Signed out in another tab
- **WHEN** user A is on `/lists/7` in one tab and signs out in another tab, and then signs in again in the first tab
- **THEN** the first tab lands on the default page

#### Scenario: Opening a link while signed out
- **WHEN** a signed-out user opens a link to `/lists/7` and signs in
- **THEN** they land on `/lists/7`
