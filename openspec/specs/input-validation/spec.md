# input-validation Specification

## Purpose

Guarantees that malformed request input to the backend API is rejected with a `400` and a field-level message. It never causes a server error, and it's never stored in a form that breaks later reads of the user's data.

## Requirements

### Requirement: Malformed input is rejected, never a server error
Every authenticated or public write endpoint SHALL respond to malformed input with `400 Bad Request` and a message identifying the offending field. It SHALL NOT respond with a `5xx`, and SHALL NOT write any data for that request. Malformed input includes wrong JSON types, out-of-range values, over-long strings, unknown enumerated values, and a body that isn't a JSON object where an object is expected.

#### Scenario: Non-object JSON body
- **WHEN** a client sends a JSON array (e.g. `[]`) as the body to login, password-reset request, password-reset confirm, delete account, follow person, episode progress, bulk watched, or TMDB session creation
- **THEN** the response is `400` and nothing is written

#### Scenario: Non-string field value
- **WHEN** a client sends `{"email": 123}` to password-reset request, or `{"uid": 1, "token": 2, "new_password": 3}` to password-reset confirm
- **THEN** the response is `400`, not `500`

### Requirement: Numeric inputs are finite
The system SHALL reject `NaN`, `Infinity` and `-Infinity`, sent as JSON strings or any other form, for every floating-point input, including vote averages and user ratings. A stored row SHALL never contain a non-finite number written through the API.

#### Scenario: NaN vote average
- **WHEN** a signed-in user adds a watchlist item, watched item or list item with `"voteAverage": "NaN"`
- **THEN** the response is `400` naming `voteAverage`, no row is created, and a following GET of that collection returns `200`

#### Scenario: Infinite rating
- **WHEN** a signed-in user submits a rating with `"userRating": "Infinity"`
- **THEN** the response is `400` naming `userRating`

### Requirement: Inputs fit their storage limits
The system SHALL reject any string input longer than the column that stores it, and any integer input outside the range its column can hold. Media, person and show identifiers SHALL be positive integers no larger than 2147483647. Runtime minutes SHALL be non-negative. Season and episode numbers SHALL be between 1 and 2147483647.

#### Scenario: Over-long poster path
- **WHEN** a signed-in user adds a watchlist item whose `posterPath` is 501 characters long
- **THEN** the response is `400` naming `posterPath`

#### Scenario: Over-long platform
- **WHEN** a signed-in user marks a title watched with a `platform` longer than 100 characters
- **THEN** the response is `400` naming `platform`

#### Scenario: Identifier beyond integer range
- **WHEN** a signed-in user adds a watched item with `"mediaId": 3000000000`, or follows a person with `"personId": 3000000000`
- **THEN** the response is `400`

#### Scenario: Show id beyond integer range on a write
- **WHEN** a signed-in user saves episode progress for show id `3000000000`
- **THEN** the response is `400`

#### Scenario: Negative runtime
- **WHEN** a signed-in user marks a title watched with `"runtimeMinutes": -5`
- **THEN** the response is `400` naming `runtimeMinutes`

#### Scenario: Over-long email on profile update
- **WHEN** a signed-in user updates their profile email to an address longer than 254 characters
- **THEN** the response is `400` naming `email`

### Requirement: Media type is restricted to movie or tv
Every endpoint that accepts a media type SHALL accept only `movie` or `tv`, and SHALL reject any other value with `400`.

#### Scenario: Unknown media type
- **WHEN** a signed-in user adds a watchlist item with `"mediaType": "book"`
- **THEN** the response is `400` naming `mediaType`, and no row is created

### Requirement: A record's media identity can't be changed by update
Updating an existing watchlist entry or rating SHALL NOT change its `mediaId` or `mediaType`. An update request that supplies a different value for either SHALL be rejected with `400`, and the record SHALL stay unchanged. Resending the same values SHALL be allowed.

#### Scenario: PATCH tries to move a rating onto another title
- **WHEN** a signed-in user PATCHes their rating for movie 1 with `"mediaId": 2`, and they already have a rating for movie 2
- **THEN** the response is `400`, and both ratings are unchanged

#### Scenario: PATCH resends the same identity
- **WHEN** a signed-in user PATCHes a watchlist entry with its existing `mediaId` and `mediaType` plus a new `title`
- **THEN** the response is `200` and only the title changes

### Requirement: Ratings use half-point steps
A submitted user rating SHALL be a multiple of 0.5 between 0.5 and 10 inclusive. Any other value SHALL be rejected with `400`.

#### Scenario: Off-step rating
- **WHEN** a signed-in user submits `"userRating": 7.3`
- **THEN** the response is `400` naming `userRating`

#### Scenario: Whole and half stars
- **WHEN** a signed-in user submits `"userRating": 7` or `"userRating": 7.5`
- **THEN** the rating is saved

### Requirement: Bulk watched entries are each validated
The bulk mark-watched, bulk watchlist and bulk rating endpoints SHALL validate every entry by the same rules as a single item of that kind. A bulk entry MAY carry its own media type, which overrides the request-level default. A bulk watched entry MAY also carry a watched time, runtime and platform. A bulk watchlist entry MAY carry an added time. A bulk rating entry MAY carry a review and a rated time. An entry with no `mediaId` SHALL be skipped. A `null` vote average SHALL be treated as `0`. If any other entry is malformed (not an object, non-integer or out-of-range id, unknown media type, over-long field, non-finite number, unparseable or future timestamp, off-step rating), the whole request SHALL be rejected with `400` identifying the entry, and nothing SHALL be written. Ids sent as numeric strings and as integers SHALL be treated as the same title.

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

### Requirement: Profile username follows registration rules and conflicts are clean
A username set through profile update SHALL satisfy the same character rules as registration (letters, digits and `@.+-_` only). When the chosen username is taken, including by a concurrent request that commits first, the response SHALL be `400` "This username is already taken.", never `500`.

#### Scenario: Invalid characters
- **WHEN** a signed-in user changes their username to `bad name!`
- **THEN** the response is `400` naming `username`, and the username is unchanged

#### Scenario: Concurrent rename to the same name
- **WHEN** two users rename themselves to the same unused username at the same moment
- **THEN** one succeeds, and the other gets `400` "This username is already taken."
