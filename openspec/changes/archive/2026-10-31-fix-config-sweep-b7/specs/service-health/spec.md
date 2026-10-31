## MODIFIED Requirements

### Requirement: Best-effort pre-warm work cannot block startup
In every supported startup path (local `start.py` and the Docker entrypoint), the recommendation cache warm-up step SHALL be bounded to at most 30 seconds. If it fails, errors, or exceeds that bound, startup SHALL continue to the application server without failing. In both startup paths, the best-effort steps (expired-session cleanup, title-cache cleanup, recommendation warm-up) SHALL NOT delay the application server: it starts once the required steps (migrations, cache table) are done, and the best-effort steps run alongside it with the same bounds. Both startup paths SHALL run the same best-effort steps with the same bounds.

#### Scenario: TMDB hangs during container start
- **WHEN** the container starts and the recommendation warm-up does not finish within 30 seconds
- **THEN** the warm-up is stopped, a message saying it was skipped is logged, and the application server accepts requests throughout

#### Scenario: Warm-up errors out
- **WHEN** the recommendation warm-up exits with a non-zero status
- **THEN** the application server still starts

#### Scenario: Slow cleanup at container start
- **WHEN** the expired-session or title-cache cleanup takes its full bound
- **THEN** the application server is already accepting requests while it runs

#### Scenario: Slow cleanup in local development
- **WHEN** a developer runs `npm run dev` and the expired-session cleanup takes its full bound
- **THEN** the development server is already accepting requests while it runs

#### Scenario: A step added to one startup path
- **WHEN** a best-effort step or its bound is changed in one startup path but not the other
- **THEN** the backend test suite fails
