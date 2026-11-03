## ADDED Requirements

### Requirement: The filter drawer opens only when the user opens it
The browse filter drawer SHALL close when the user leaves the Movies, TV and Anime pages and when the session ends. Opening a browse page SHALL never show the drawer open unless the user opens it there.

#### Scenario: Back to a detail page with the drawer open
- **WHEN** the user has the filter drawer open on Movies, goes Back to a detail page, and later opens TV
- **THEN** TV opens with the drawer closed

#### Scenario: Signed out with the drawer open
- **WHEN** the session ends while the filter drawer is open on Movies, and the user signs in again and lands on Movies
- **THEN** the drawer is closed
