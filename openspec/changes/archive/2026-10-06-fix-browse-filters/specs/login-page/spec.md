## ADDED Requirements

### Requirement: Post-login redirect preserves the full original location
When an unauthenticated user is sent to the login page from a protected page,
a successful login SHALL return them to that page's full original location:
path, query string and hash. When there is no original location, the user
SHALL land on the default browse page.

#### Scenario: Query string kept
- **WHEN** a signed-out user opens `/search?tab=people`, is redirected to login and signs in
- **THEN** the user lands on `/search?tab=people` with the People tab active

#### Scenario: Direct login
- **WHEN** the user opens `/login` directly and signs in
- **THEN** the user lands on `/movies`
