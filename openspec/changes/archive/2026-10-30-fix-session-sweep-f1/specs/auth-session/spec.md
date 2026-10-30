## MODIFIED Requirements

### Requirement: Responses for a previous session are discarded
A response to a request made while one account was signed in SHALL NOT change what the app shows after that account has signed out. This applies to the library (watched, watchlist, ratings, lists), followed people, episode progress, the notifications and their error state, imports, profile updates and avatar changes, whether the response is a load or a write, and whether it succeeds or fails. A profile or avatar response SHALL also be ignored when the account it returns is not the one the tab is bound to, and a late profile response SHALL NOT store its tokens.

#### Scenario: Slow notifications poll across an account switch
- **WHEN** user A signs out while A's notifications poll is still in flight, user B signs in in the same tab, and A's response then arrives
- **THEN** B's bell shows only B's notifications and unread count, never A's

#### Scenario: B's library load fails
- **WHEN** user A signs out while A's watched-history load is in flight, user B signs in, A's response arrives, and B's own watched-history load fails
- **THEN** B sees the load error, not A's watched history

#### Scenario: Notifications error state after sign-out
- **WHEN** A's last notifications poll failed and A signs out, then B signs in
- **THEN** B's bell doesn't show A's error until B's own poll has run

#### Scenario: Episode progress saved across an account switch
- **WHEN** user A saves a show's episode progress, signs out before the response arrives, and user B signs in and opens the same show
- **THEN** B sees B's own progress for that show, not A's

#### Scenario: Password change answered after an account switch
- **WHEN** user A saves a new password, signs out before the response arrives, user B signs in in the same tab, and A's response (with A's new tokens) then arrives
- **THEN** the tab stays signed in as B with B's tokens, and no other tab switches to A

#### Scenario: Avatar upload answered after an account switch
- **WHEN** user A uploads a photo, signs out before the response arrives, and user B signs in in the same tab
- **THEN** B's name, email and photo stay B's when A's response arrives

### Requirement: A forced logout returns the user to their page after signing in
When the session ends because a token refresh was rejected, the client SHALL send the user to the sign-in page. After signing in, the user SHALL return to the page they were on, with the same address (path, query and fragment), unless that page is a sign-in, registration or password-reset page. When the session ends on purpose instead (the user signs out, deletes the account, or signs out in another tab), the next sign-in in that tab SHALL go to the default page. A request answered `401` after another tab signed out or switched accounts (the stored account is no longer the one this tab shows) SHALL fail without a forced logout, so the tab follows the other tab's change instead. A user who opens a protected page while signed out SHALL still return to it after signing in.

#### Scenario: Session expires on a list page
- **WHEN** a user is on `/lists/7?sort=title` and a request triggers a token refresh that the server rejects
- **THEN** the user lands on the sign-in page, and after signing in they are on `/lists/7?sort=title`

#### Scenario: Sign out, then someone else signs in
- **WHEN** user A is on `/search?q=something` and signs out, and user B signs in within the same tab
- **THEN** B lands on the default page, not `/search?q=something`

#### Scenario: Signed out in another tab
- **WHEN** user A is on `/lists/7` in one tab and signs out in another tab, and then signs in again in the first tab
- **THEN** the first tab lands on the default page

#### Scenario: A 401 arrives just after another tab signed out
- **WHEN** user A is on `/lists/7` in one tab with a request in flight, signs out in another tab, and the first tab's request is answered `401` before its storage event is handled
- **THEN** the first tab is not reloaded to the sign-in page with `/lists/7` as its return address, and the next sign-in there lands on the default page

#### Scenario: Opening a link while signed out
- **WHEN** a signed-out user opens a link to `/lists/7` and signs in
- **THEN** they land on `/lists/7`

## ADDED Requirements

### Requirement: TMDB requests carry only this tab's account, once per token
TMDB proxy requests SHALL carry the access token only while the stored account is the one this tab shows. Once the proxy answers `401` for a token, later TMDB requests SHALL be sent without it until a different token is stored, so an expired token doesn't make every request go out twice.

#### Scenario: Another tab switched accounts
- **WHEN** another tab has signed in as a different account and this tab hasn't reloaded yet
- **THEN** this tab's TMDB requests go out without that account's token

#### Scenario: Expired token while browsing
- **WHEN** the access token has expired and the user opens three detail pages before any other request refreshes it
- **THEN** only the first TMDB request is sent with the expired token; the rest go out once, without it
