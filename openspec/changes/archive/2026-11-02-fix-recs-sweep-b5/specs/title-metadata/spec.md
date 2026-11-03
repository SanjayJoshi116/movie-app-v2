## ADDED Requirements

### Requirement: Malformed metadata doesn't abort a backfill
When TMDB answers a title's details with `genres` missing, null, or containing entries that aren't objects with an integer id, the backfill SHALL store the usable genres (none, if there are none) for that title and continue with the other titles. Neither a recommendation refresh nor a Stats backfill SHALL fail because of it.

#### Scenario: Null genres
- **WHEN** TMDB answers one watched title's details with `"genres": null`
- **THEN** that title is stored with no genres, the other titles in the run are filled, and the recommendation refresh that ran the backfill saves its result

### Requirement: A backfill that couldn't start doesn't block later ones
When the server can't start a metadata backfill (no thread available), the user SHALL NOT be left marked as having a backfill running. A later Stats request SHALL be able to start one.

#### Scenario: Thread start fails once
- **WHEN** starting a user's Stats backfill fails, and the user opens Stats again once threads are available
- **THEN** a backfill runs for that user
