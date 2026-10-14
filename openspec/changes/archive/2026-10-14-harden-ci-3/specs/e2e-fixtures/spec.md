## MODIFIED Requirements

### Requirement: Mocked records use the API's field names
Every e2e mock record standing in for an API resource (user, watchlist entry, watched entry, rating, stats) SHALL carry the field names the API actually returns for that resource, with values in the formats the API uses. It SHALL NOT carry fields the API no longer sends. An automated check SHALL fail when a mock record's fields differ from the API's. For the TypeScript e2e suite, whose mocks are type-checked against the app's API record types, the automated check SHALL compare those types' fields with the API's, so a mock can't agree with a stale type.

#### Scenario: Serializer gains a field
- **WHEN** a field is added to or removed from the watched-entry API response and the e2e watched mock isn't updated
- **THEN** the test suite fails, naming the mock and the differing fields

#### Scenario: Stats month format
- **WHEN** an e2e test renders the stats page from the shared stats mock
- **THEN** the mocked monthly activity uses the same month label format as the API, and the page shows no `NaN`

#### Scenario: API type falls behind the serializer
- **WHEN** a field is added to the rating API response and the app's TypeScript rating record type isn't updated
- **THEN** the backend test suite fails, naming the type and the missing field
