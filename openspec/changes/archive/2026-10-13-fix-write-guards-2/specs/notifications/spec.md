## ADDED Requirements

### Requirement: Notifications follow the user's follows and skip watched titles
Following or unfollowing a person SHALL update the notifications shortly after the change succeeds, without waiting for the next scheduled check. Notifications SHALL NOT include titles the user has already marked watched.

#### Scenario: Follow someone with a new release
- **WHEN** a user follows a person who has a release in the past week
- **THEN** that release appears in the notifications without waiting for the next scheduled check

#### Scenario: Unfollow
- **WHEN** a user unfollows the only person behind a notification
- **THEN** that notification disappears without waiting for the next scheduled check

#### Scenario: Already watched
- **WHEN** a followed person's new release is a title the user already marked watched
- **THEN** it isn't listed in the notifications
