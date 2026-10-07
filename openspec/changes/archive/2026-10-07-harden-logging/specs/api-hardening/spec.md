## ADDED Requirements

### Requirement: No server log output contains the TMDB API key
Every log line the backend writes SHALL have the TMDB API key replaced with a placeholder. This covers the application's own loggers and also the framework, HTTP-client and any other third-party loggers, in both debug and production modes, including exception tracebacks.

#### Scenario: HTTP client retry warning
- **WHEN** a TMDB request is retried and the HTTP client logs a warning whose text contains the request URL with `api_key=<key>`
- **THEN** the written log line shows the placeholder, not the key

#### Scenario: Unhandled exception mentioning the key
- **WHEN** a view raises an unhandled exception whose message contains the TMDB API key
- **THEN** the logged traceback shows the placeholder, not the key, with debug mode on or off
