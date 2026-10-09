## ADDED Requirements

### Requirement: Access logs don't record one-time credentials
The web server's access log SHALL NOT contain password-reset tokens or TMDB request tokens, either in the request line or in the referer. Requests to `/reset-password/…` and `/tmdb-callback` SHALL be logged with those parts replaced by a placeholder. Every other request SHALL be logged as before.

#### Scenario: Reset link opened
- **WHEN** a user opens a password-reset link
- **THEN** the access log line shows `/reset-password/` followed by the placeholder, not the uid or token

#### Scenario: Reset page calls the API
- **WHEN** the reset page sends its API request with the reset URL as the referer
- **THEN** the access log line for that API request doesn't contain the token in its referer

#### Scenario: TMDB callback
- **WHEN** a user returns to `/tmdb-callback?request_token=…&approved=true`
- **THEN** the access log line doesn't contain the request token
