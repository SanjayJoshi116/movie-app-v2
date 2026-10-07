# service-health Specification

## Purpose

Guarantees that the backend's liveness signal stays accurate under continuous orchestrator polling and that the service always reaches a serving state even when best-effort pre-warm work fails or hangs.

## Requirements

### Requirement: Health endpoint is never rate-limited
The health endpoint (`GET /api/health/`) SHALL respond `200` with `{"status": "ok"}` to every request from a running, database-connected service, no matter how often or by whom it is called. It SHALL NOT be subject to any anonymous, per-user, or scoped request throttle.

#### Scenario: Sustained orchestrator polling
- **WHEN** the health endpoint is called more times than the anonymous daily throttle rate allows, from the same client address
- **THEN** every call returns `200`, and none returns `429`

#### Scenario: Health polling does not consume other throttle budgets
- **WHEN** a client calls the health endpoint repeatedly and then calls another anonymous endpoint
- **THEN** the second endpoint's throttle allowance is unaffected by the health calls

### Requirement: Best-effort pre-warm work cannot block startup
In every supported startup path (local `start.py` and the Docker entrypoint), the recommendation cache warm-up step SHALL be bounded to at most 30 seconds. If it fails, errors, or exceeds that bound, startup SHALL continue to the application server without failing.

#### Scenario: TMDB hangs during container start
- **WHEN** the container starts and the recommendation warm-up does not finish within 30 seconds
- **THEN** the warm-up is stopped, a message saying it was skipped is logged, and the application server starts and begins accepting requests

#### Scenario: Warm-up errors out
- **WHEN** the recommendation warm-up exits with a non-zero status
- **THEN** the application server still starts

### Requirement: Unhandled server errors are logged in production
With debug mode off, an unhandled exception while serving a request SHALL produce a server log entry that includes the request path and the exception traceback. Routine client-error responses (4xx) SHALL NOT produce log entries.

#### Scenario: Production 500
- **WHEN** debug mode is off and a view raises an unhandled exception
- **THEN** the API returns 500 and the server log has an ERROR entry with the path and traceback

#### Scenario: Expected 4xx is quiet
- **WHEN** a client gets a 401 on an expired token or a 404 for an unknown id
- **THEN** no log entry is written for that response
