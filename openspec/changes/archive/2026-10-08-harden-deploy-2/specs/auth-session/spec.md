## ADDED Requirements

### Requirement: Public-data requests never end the session
A request for public TMDB data that is answered as unauthorized SHALL NOT end the session or send the user to the login page. The client SHALL retry it once without credentials.

#### Scenario: Expired token on a browse page
- **WHEN** a signed-in user's access token has expired and the browse page's TMDB request is answered `401`
- **THEN** the request is retried without credentials and the page loads, and the user stays signed in
