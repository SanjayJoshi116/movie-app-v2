## ADDED Requirements

### Requirement: A removed avatar is no longer served
When a user removes their avatar, replaces it, or deletes their account, the previous avatar file SHALL be deleted, so its URL no longer serves the image.

#### Scenario: Account deleted
- **WHEN** a user with an avatar deletes their account
- **THEN** a request for their former avatar URL returns not found

#### Scenario: Avatar replaced
- **WHEN** a user uploads a new avatar
- **THEN** the previous avatar's URL returns not found

### Requirement: A new avatar is visible immediately
Each uploaded avatar SHALL be served from a URL that no earlier avatar of that user used, so browsers and caches can't keep showing the previous photo.

#### Scenario: Same format re-upload
- **WHEN** a user replaces a PNG avatar with a different PNG
- **THEN** the returned avatar URL differs from the previous one

### Requirement: A failed replace keeps the current avatar
If saving a new avatar fails, the user's current avatar SHALL stay in place and keep being served.

#### Scenario: Storage failure during replace
- **WHEN** a user uploads a new avatar and storing it fails
- **THEN** the request reports an error, and the profile still points to the previous avatar, which is still served
