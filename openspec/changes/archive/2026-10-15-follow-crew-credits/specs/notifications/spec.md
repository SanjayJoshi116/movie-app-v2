## ADDED Requirements

### Requirement: A person's work behind the camera counts
A followed person's new releases SHALL include titles they worked on in any crew job (directing, writing, producing, composing and every other job), not only titles they acted in. A title SHALL appear once however many jobs the person had on it. Appearances as themselves on talk shows and news programmes SHALL NOT count as releases.

#### Scenario: Follow a director
- **WHEN** a user follows a director who directed a film released in the last 30 days and has no acting credit on it
- **THEN** that film appears in the user's notifications

#### Scenario: Several jobs on one title
- **WHEN** a followed person directed, wrote and produced the same new film
- **THEN** the film appears once

#### Scenario: Talk-show appearance
- **WHEN** a followed actor appears as themselves on a talk show episode aired this week
- **THEN** the talk show doesn't appear in the notifications

### Requirement: Unread means not seen at the last mark-seen
Marking notifications seen SHALL remember every notification the user had at that moment. On later polls, a notification SHALL be unread exactly when it wasn't among them, whatever its release date. A notification the user had when they last marked seen SHALL stay read. A user who hasn't marked notifications seen since this rule took effect SHALL keep the previous rule (unread when released after the last mark-seen day) until their next mark-seen.

#### Scenario: Title added late with a past date
- **WHEN** a user marks notifications seen, and the next day TMDB adds a followed person's film released five days ago
- **THEN** that film is unread and counts toward the badge

#### Scenario: Seen item stays read
- **WHEN** a user marks notifications seen while a film is in their list
- **THEN** that film is read on every later poll

#### Scenario: New follow
- **WHEN** a user follows someone whose film came out two weeks ago, after having marked notifications seen
- **THEN** that film appears unread

#### Scenario: Release appears later the same day
- **WHEN** a user marks notifications seen in the morning, and later that day a followed person's credits gain a title released that day
- **THEN** that title is unread and counts toward the unread badge

## REMOVED Requirements

### Requirement: A same-day release that appears after marking seen is unread
**Reason**: Replaced by "Unread means not seen at the last mark-seen", which covers same-day releases and every other late-appearing title.
**Migration**: The stored same-day list is dropped; checkpoints keep the date rule until the user next marks notifications seen, which then records the full seen set.
