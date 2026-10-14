## MODIFIED Requirements

### Requirement: No server log output contains the TMDB API key
Every log line the backend writes SHALL have the TMDB API key, and the value of any `session_id`, `guest_session_id` or `request_token` parameter or JSON field, replaced with a placeholder. This covers the application's own loggers and also the framework, HTTP-client and any other third-party loggers, in both debug and production modes, including exception tracebacks.

#### Scenario: HTTP client retry warning
- **WHEN** a TMDB request is retried and the HTTP client logs a warning whose text contains the request URL with `api_key=<key>`
- **THEN** the written log line shows the placeholder, not the key

#### Scenario: Unhandled exception mentioning the key
- **WHEN** a view raises an unhandled exception whose message contains the TMDB API key
- **THEN** the logged traceback shows the placeholder, not the key, with debug mode on or off

#### Scenario: Rating sync fails
- **WHEN** syncing a rating to TMDB fails with an HTTP error whose message contains the request URL with `session_id=<id>`
- **THEN** no log line contains the session id

#### Scenario: Proxy request carries a session id
- **WHEN** a TMDB proxy request with a `session_id` query parameter fails and is logged
- **THEN** the logged text shows the placeholder, not the session id

#### Scenario: Proxy request carries a guest session id
- **WHEN** a TMDB proxy request with a `guest_session_id` query parameter, or a JSON body with a `"guest_session_id"` field, is logged
- **THEN** the logged text shows the placeholder, not the guest session id
