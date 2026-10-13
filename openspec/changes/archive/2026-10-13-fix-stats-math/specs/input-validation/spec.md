## MODIFIED Requirements

### Requirement: Bulk watched entries are each validated
The bulk mark-watched, bulk watchlist, bulk rating and bulk list-item endpoints SHALL validate every entry by the same rules as a single item of that kind. A bulk entry MAY carry its own media type, which overrides the request-level default. A bulk watched entry MAY also carry a watched time, runtime and platform. A bulk watchlist entry or bulk list-item entry MAY carry an added time. A bulk rating entry MAY carry a review and a rated time. Creating a list MAY carry a creation time, validated like an imported timestamp. An entry with no `mediaId` SHALL be skipped. A `null` vote average SHALL be treated as `0`. If any other entry is malformed (not an object, non-integer or out-of-range id, unknown media type, over-long field, non-finite number, unparseable or future timestamp, timestamp before 1900-01-01, off-step rating), the whole request SHALL be rejected with `400` identifying the entry, and nothing SHALL be written. Ids sent as numeric strings and as integers SHALL be treated as the same title. A bulk list-item request for a list the user doesn't own SHALL get `404`.

#### Scenario: One malformed entry
- **WHEN** a signed-in user bulk-imports three entries and the second has `"mediaId": "abc"`
- **THEN** the response is `400` identifying entry index 1, and none of the three are marked watched

#### Scenario: Non-object entry
- **WHEN** a signed-in user bulk-imports `{"entries": [5], "mediaType": "movie"}`
- **THEN** the response is `400`

#### Scenario: Null vote average from a CSV import
- **WHEN** a signed-in user bulk-imports an entry with `"voteAverage": null`
- **THEN** the entry is saved with a vote average of `0`

#### Scenario: Same id as string and integer
- **WHEN** a signed-in user bulk-imports `[{"mediaId": 5, "title": "A"}, {"mediaId": "5", "title": "A"}]` and hasn't watched title 5
- **THEN** the response reports `added: 1, skipped: 0`, and one row exists for title 5

#### Scenario: Per-entry media type
- **WHEN** a signed-in user bulk-imports `{"mediaType": "movie", "entries": [{"mediaId": 1, "mediaType": "tv"}, {"mediaId": 2}]}`
- **THEN** title 1 is stored as `tv` and title 2 as `movie`

#### Scenario: Off-step rating in a bulk rating import
- **WHEN** a signed-in user bulk-imports ratings and one has `"userRating": 7.3`
- **THEN** the response is `400` identifying that entry, and no ratings are written

#### Scenario: Timestamp near year 1
- **WHEN** a signed-in user bulk-imports a watched entry with `"watchedAt": "0001-01-01T00:00:00Z"`
- **THEN** the response is `400` identifying that entry, and nothing is written

#### Scenario: Another user's list
- **WHEN** a signed-in user bulk-adds items to a list id that belongs to someone else
- **THEN** the response is `404` and nothing is written

#### Scenario: Future list creation time
- **WHEN** a signed-in user creates a list with a `createdAt` one day in the future
- **THEN** the response is `400` naming `createdAt`, and no list is created
