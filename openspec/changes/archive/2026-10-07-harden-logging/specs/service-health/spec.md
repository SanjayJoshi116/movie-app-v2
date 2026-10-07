## ADDED Requirements

### Requirement: Unhandled server errors are logged in production
With debug mode off, an unhandled exception while serving a request SHALL produce a server log entry that includes the request path and the exception traceback. Routine client-error responses (4xx) SHALL NOT produce log entries.

#### Scenario: Production 500
- **WHEN** debug mode is off and a view raises an unhandled exception
- **THEN** the API returns 500 and the server log has an ERROR entry with the path and traceback

#### Scenario: Expected 4xx is quiet
- **WHEN** a client gets a 401 on an expired token or a 404 for an unknown id
- **THEN** no log entry is written for that response
