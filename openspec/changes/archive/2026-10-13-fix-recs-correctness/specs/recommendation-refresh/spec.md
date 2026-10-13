## ADDED Requirements

### Requirement: Rating changes trigger a recommendation refresh
Creating a rating, changing a rating's score, deleting a rating, and a bulk ratings import that adds at least one rating SHALL each schedule a background refresh of that user's recommendation cache, under the same rules as watched-history changes: the refresh starts only after the transaction commits, never for a rollback, and refreshes are coalesced per user. Editing only a rating's review SHALL NOT schedule a refresh. Deleting an account SHALL NOT schedule one.

#### Scenario: Rating a title
- **WHEN** a user rates a watched title 9 and the request completes
- **THEN** a refresh of that user's recommendations is scheduled, and it sees the new rating

#### Scenario: Review-only edit
- **WHEN** a user changes only the review text of an existing rating
- **THEN** no recommendation refresh is scheduled

#### Scenario: Removing a rating
- **WHEN** a user removes a rating
- **THEN** a refresh of that user's recommendations is scheduled

#### Scenario: Backup restore
- **WHEN** a new account imports a backup with watched titles and ratings, the watched step first and then the ratings step
- **THEN** a refresh runs after the ratings are saved, so the restored account's recommendations reflect its ratings without waiting for the cache to expire
