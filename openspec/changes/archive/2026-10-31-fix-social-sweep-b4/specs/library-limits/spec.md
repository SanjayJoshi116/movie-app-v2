## MODIFIED Requirements

### Requirement: Each library collection has a per-user limit
The system SHALL limit each account to 20,000 watched entries, 20,000 watchlist entries, 20,000 ratings, 200 lists, 2,000 items per list, 1,000 followed people and 20,000 shows with episode progress. Concurrent writes SHALL NOT push a collection past its limit. Entries stored before the limit existed SHALL stay readable and removable even when they exceed it.

#### Scenario: Collection under the limit
- **WHEN** a user with 19,999 watched entries marks one more title watched
- **THEN** the entry is saved

#### Scenario: Two adds race at the edge
- **WHEN** a user with 19,999 watched entries sends two adds for different titles at the same time
- **THEN** exactly one is saved and the other is refused at the limit

#### Scenario: Follow limit reached
- **WHEN** a user who follows 1,000 people follows one more
- **THEN** the response is a 400 saying they can follow at most 1,000 people, the follow isn't stored, and the user sees that message

#### Scenario: Restore crosses the follow limit
- **WHEN** a user who follows 900 people restores a backup with 200 new follows
- **THEN** 100 are added and 100 are reported over the limit

#### Scenario: Progress on a show already tracked
- **WHEN** a user tracking 20,000 shows records the next episode of one of them
- **THEN** the progress is saved
