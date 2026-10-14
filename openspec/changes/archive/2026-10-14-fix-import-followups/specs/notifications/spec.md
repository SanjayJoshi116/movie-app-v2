## MODIFIED Requirements

### Requirement: Notifications follow the user's follows and skip watched titles
Following or unfollowing a person, or restoring follows from a backup, SHALL update the notifications shortly after the change succeeds, without waiting for the next scheduled check. Several follow changes in quick succession SHALL lead to one update, not one each. An update SHALL NOT be replaced by the answer to an earlier check that arrives after it. Notifications SHALL NOT include titles the user has already marked watched.

#### Scenario: Follow someone with a new release
- **WHEN** a user follows a person who has a release in the past week
- **THEN** that release appears in the notifications without waiting for the next scheduled check

#### Scenario: Unfollow
- **WHEN** a user unfollows the only person behind a notification
- **THEN** that notification disappears without waiting for the next scheduled check

#### Scenario: Already watched
- **WHEN** a followed person's new release is a title the user already marked watched
- **THEN** it isn't listed in the notifications

#### Scenario: Follow many people quickly
- **WHEN** a user follows ten people on the People page within a few seconds
- **THEN** the notifications are checked once after the last follow, and the bell doesn't show an error

#### Scenario: Earlier check answers last
- **WHEN** a user follows person A and then person B, and the check started for A answers after the check started for B
- **THEN** the notifications show the result that includes B

#### Scenario: Restored follows
- **WHEN** a user restores a backup that adds followed people, one of whom has a release in the past week
- **THEN** that release appears in the notifications without waiting for the next scheduled check

## ADDED Requirements

### Requirement: A followed person without a name is still labelled
A followed person whose stored name is blank (for example from a hand-edited backup) SHALL be shown as "Person <id>" wherever a name is shown: their card, their notifications, and the follow and unfollow messages.

#### Scenario: Blank name in a restored backup
- **WHEN** a restored backup follows person 287 with an empty name, and that person has a release in the past week
- **THEN** the Following page card and the notification both read "Person 287"
