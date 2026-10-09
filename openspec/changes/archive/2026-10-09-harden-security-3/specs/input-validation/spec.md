## MODIFIED Requirements

### Requirement: Inputs fit their storage limits
The system SHALL reject any string input longer than the column that stores it, and any integer input outside the range its column can hold. Media, person and show identifiers SHALL be positive integers no larger than 2147483647. Runtime minutes SHALL be non-negative. Season and episode numbers SHALL be between 1 and 2147483647. A rating's review SHALL be at most 5000 characters and a list's description at most 200 characters, on single and bulk writes alike. Text already stored above these limits SHALL still be readable.

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

#### Scenario: Over-long review
- **WHEN** a signed-in user saves a rating, or bulk-imports ratings, with a review of 5001 characters
- **THEN** the response is `400` naming `review`, and nothing is stored

#### Scenario: Over-long list description
- **WHEN** a signed-in user creates or edits a list with a description of 201 characters
- **THEN** the response is `400` naming `description`

#### Scenario: Review length shown while typing
- **WHEN** a user types a review in the rating dialog
- **THEN** the dialog shows the character count and stops input at 5000 characters
