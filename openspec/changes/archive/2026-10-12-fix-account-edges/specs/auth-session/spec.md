## ADDED Requirements

### Requirement: Responses for a previous session are discarded
A response to a request made while one account was signed in SHALL NOT change what the app shows after that account has signed out. This applies to the library (watched, watchlist, ratings, lists), followed people, the notifications and their error state, whether the response is a load or a write, and whether it succeeds or fails.

#### Scenario: Slow notifications poll across an account switch
- **WHEN** user A signs out while A's notifications poll is still in flight, user B signs in in the same tab, and A's response then arrives
- **THEN** B's bell shows only B's notifications and unread count, never A's

#### Scenario: B's library load fails
- **WHEN** user A signs out while A's watched-history load is in flight, user B signs in, A's response arrives, and B's own watched-history load fails
- **THEN** B sees the load error, not A's watched history

#### Scenario: Notifications error state after sign-out
- **WHEN** A's last notifications poll failed and A signs out, then B signs in
- **THEN** B's bell doesn't show A's error until B's own poll has run

### Requirement: A forced logout returns the user to their page after signing in
When the session ends because a token refresh was rejected, the client SHALL send the user to the sign-in page. After signing in, the user SHALL return to the page they were on, with the same address (path, query and fragment), unless that page is a sign-in, registration or password-reset page.

#### Scenario: Session expires on a list page
- **WHEN** a user is on `/lists/7?sort=title` and a request triggers a token refresh that the server rejects
- **THEN** the user lands on the sign-in page, and after signing in they are on `/lists/7?sort=title`
