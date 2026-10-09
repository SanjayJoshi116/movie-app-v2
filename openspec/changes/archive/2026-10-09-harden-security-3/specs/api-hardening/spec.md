## MODIFIED Requirements

### Requirement: Production configuration fails closed
When the debug setting isn't explicitly enabled, the backend SHALL run with debug off. With debug off, the backend SHALL refuse to start if the allowed-hosts setting contains a wildcard or is empty, if the secret key is the built-in development default, or if no email backend is configured explicitly.

#### Scenario: DEBUG unset
- **WHEN** the backend starts with no `DEBUG` environment variable and valid production settings
- **THEN** it runs with debug off (no debug error pages, no permissive CORS/hosts relaxation)

#### Scenario: Wildcard hosts in production
- **WHEN** the backend starts with debug off and `ALLOWED_HOSTS=*`
- **THEN** startup fails with a configuration error naming `ALLOWED_HOSTS`

#### Scenario: No email backend in production
- **WHEN** the backend starts with debug off and no `EMAIL_BACKEND` environment variable
- **THEN** startup fails with a configuration error naming `EMAIL_BACKEND`, so password-reset links are never silently printed to the container log

#### Scenario: Console email chosen explicitly
- **WHEN** the backend starts with debug off and `EMAIL_BACKEND` set explicitly to the console backend
- **THEN** it starts

#### Scenario: Local development
- **WHEN** a developer runs `npm run dev`
- **THEN** the backend runs with debug on and accepts LAN-address hosts, as it does today, and emails go to the console without any extra setting

### Requirement: No server log output contains the TMDB API key
Every log line the backend writes SHALL have the TMDB API key, and the value of any `session_id` or `request_token` parameter, replaced with a placeholder. This covers the application's own loggers and also the framework, HTTP-client and any other third-party loggers, in both debug and production modes, including exception tracebacks.

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

## ADDED Requirements

### Requirement: A missing TMDB link is not logged as an error
Saving or deleting a rating for a user with no connected TMDB account SHALL NOT write a log line at warning level or above. A real TMDB sync failure SHALL be logged at warning level, once per failure, with the exception type and without a traceback that could carry request details.

#### Scenario: User never connected TMDB
- **WHEN** a user with no TMDB connection saves a rating
- **THEN** the rating is saved and no warning or error is logged
