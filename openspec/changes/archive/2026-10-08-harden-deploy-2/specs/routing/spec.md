## ADDED Requirements

### Requirement: Detail routes with an invalid id show the not-found page
Movie, TV show and person pages SHALL accept only a positive integer id. Any other id SHALL show the not-found page without loading anything.

#### Scenario: Non-numeric id
- **WHEN** the user opens `/movie/abc` or `/person/-3`
- **THEN** the not-found page is shown and no data request is made for that id

#### Scenario: Valid id
- **WHEN** the user opens `/movie/550`
- **THEN** the movie page loads as before
