## Purpose

Bounds how much one account can store in its library (watched, watchlist, ratings, lists and list items), and defines how single and bulk writes behave and report at a limit.

## ADDED Requirements

### Requirement: Each library collection has a per-user limit
The system SHALL limit each account to 20,000 watched entries, 20,000 watchlist entries, 20,000 ratings, 200 lists and 2,000 items per list. Concurrent writes SHALL NOT push a collection past its limit. Entries stored before the limit existed SHALL stay readable and removable even when they exceed it.

#### Scenario: Collection under the limit
- **WHEN** a user with 19,999 watched entries marks one more title watched
- **THEN** the entry is saved

#### Scenario: Two adds race at the edge
- **WHEN** a user with 19,999 watched entries sends two adds for different titles at the same time
- **THEN** exactly one is saved and the other is refused at the limit

### Requirement: A single add past a limit is refused with a clear message
A single-item add (watched, watchlist, rating, list, list item) that would exceed its limit SHALL be rejected with a 400 whose message names the collection and its limit, and nothing SHALL be stored. Updating an entry that already exists (re-rating, re-marking watched) SHALL NOT count as an add.

#### Scenario: Watchlist full
- **WHEN** a user with 20,000 watchlist entries adds another title
- **THEN** the response is a 400 saying the watchlist is limited to 20,000 titles, and the user sees that message

#### Scenario: Re-rate at the limit
- **WHEN** a user with 20,000 ratings changes the score of an existing rating
- **THEN** the change is saved

### Requirement: A bulk import fills up to the limit and reports the rest
A bulk import SHALL insert new entries only until the collection reaches its limit, and SHALL report the entries it didn't insert for that reason as over the limit. The import SHALL still succeed for what fit, and the user SHALL see how many entries were not added because of the limit.

#### Scenario: Import crosses the limit
- **WHEN** a user with 19,900 watched entries imports 500 new titles
- **THEN** 100 are added, 400 are reported over the limit, and the import result tells the user 400 weren't added because the watched history is full
