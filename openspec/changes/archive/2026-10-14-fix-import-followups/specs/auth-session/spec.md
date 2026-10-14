## MODIFIED Requirements

### Requirement: Responses for a previous session are discarded
A response to a request made while one account was signed in SHALL NOT change what the app shows after that account has signed out. This applies to the library (watched, watchlist, ratings, lists), followed people, episode progress, the notifications and their error state, and imports, whether the response is a load or a write, and whether it succeeds or fails.

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
