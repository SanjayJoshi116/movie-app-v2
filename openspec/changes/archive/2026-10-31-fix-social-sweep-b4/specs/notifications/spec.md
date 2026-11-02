## MODIFIED Requirements

### Requirement: Unread means not seen at the last mark-seen
Marking notifications seen SHALL remember the notifications the user was shown at that moment (the ones a poll returns), in addition to every notification remembered by earlier mark-seens. On later polls, a notification SHALL be unread exactly when it isn't remembered, whatever its release date. A notification the user had when they marked seen SHALL stay read, even if that person's credits couldn't be looked up at the time of a later mark-seen. A notification the poll didn't return SHALL NOT be marked seen by it. A user who hasn't marked notifications seen since this rule took effect SHALL keep the previous rule (unread when released after the last mark-seen day) until their next mark-seen. The remembered set SHALL be bounded, keeping the most recently remembered notifications.

#### Scenario: Title added late with a past date
- **WHEN** a user marks notifications seen, and the next day TMDB adds a followed person's film released five days ago
- **THEN** that film is unread and counts toward the badge

#### Scenario: Seen item stays read
- **WHEN** a user marks notifications seen while a film is in their list
- **THEN** that film is read on every later poll

#### Scenario: Seen item stays read while its person's credits are unavailable
- **WHEN** a user marks a followed person's film seen, that person's cached credits expire and can't be fetched again before the user marks notifications seen a second time, and the person's credits are fetched later
- **THEN** the film is still read

#### Scenario: Notification beyond the shown list
- **WHEN** a user has more notifications in the window than a poll returns and marks notifications seen, and a shown notification later leaves the list so an older one moves into it
- **THEN** the older notification is unread

#### Scenario: New follow
- **WHEN** a user follows someone whose film came out two weeks ago, after having marked notifications seen
- **THEN** that film appears unread

#### Scenario: Release appears later the same day
- **WHEN** a user marks notifications seen in the morning, and later that day a followed person's credits gain a title released that day
- **THEN** that title is unread and counts toward the unread badge

## ADDED Requirements

### Requirement: Malformed TMDB credits never fail a poll
A person's TMDB credits that are malformed (a credit without a usable id, type or title, genres that aren't a list, a missing or non-numeric score) SHALL NOT make the notifications poll or the followed-people recommendations fail. Unusable credits SHALL be left out, a missing or non-numeric score SHALL be shown as 0, and an answer that can't be read at all SHALL count as a failed fetch for that person (not cached, retried on the next call).

#### Scenario: Credit with a null score
- **WHEN** a followed person's new film comes back from TMDB with a null score
- **THEN** the film appears in their "New from" section with a score of 0 and the Recommendations page renders

#### Scenario: Unreadable credits answer
- **WHEN** TMDB answers one followed person's credits request with a body whose credit list isn't a list
- **THEN** the poll succeeds with the other people's releases, and the next poll fetches that person again

#### Scenario: Credit without a title
- **WHEN** a followed person's credit has no title or name
- **THEN** it appears in neither the notifications nor the "New from" section

### Requirement: Credits fetched after the deadline still count
Credits for a followed person that arrive after the request that asked for them has responded SHALL still be cached, so a TMDB slower than the request's budget doesn't make every poll start over. They SHALL be served by a later poll or recommendations call without a new TMDB request for that person.

#### Scenario: TMDB slower than the budget
- **WHEN** a person's credits take longer than the poll's budget to arrive, and the poll responds without them
- **THEN** a poll after they arrived shows that person's releases without fetching their credits again

### Requirement: A person's cached credits are evicted together
When the credit cache reaches its size limit, a person's new-work list and recent summary SHALL be evicted together, so eviction doesn't remove one kind of entry for everyone before the other.

#### Scenario: Credit cache over its limit
- **WHEN** the credit cache passes its size limit and culls entries
- **THEN** every person left in the cache has both entries, and every person removed has neither
