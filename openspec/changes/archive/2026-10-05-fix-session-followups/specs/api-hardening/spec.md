## MODIFIED Requirements

### Requirement: Rate limits are enforced across all server workers
In production, each rate limit SHALL be enforced against one counter shared by all application server processes, so the effective limit equals the configured rate whatever the number of workers. The shared counter store SHALL keep each client's counters for the full rate-limit window even when many distinct clients are active. A client's counter SHALL NOT be dropped early just because other clients created more counters.

#### Scenario: Requests spread across workers
- **WHEN** the configured login rate is 10 per minute and a client sends 11 login attempts within a minute that land on different worker processes
- **THEN** the 11th attempt is rejected with `429`

#### Scenario: Many active clients
- **WHEN** more than 300 distinct clients have made rate-limited requests within the current window, and one of them then exceeds its limit
- **THEN** that client's excess request is still rejected with `429`

## ADDED Requirements

### Requirement: TMDB proxy responds within a bounded time
The TMDB passthrough endpoint SHALL return a response within a bounded worst-case time, retries included. That time SHALL be below the application server's worker timeout, so a slow or unresponsive TMDB results in the endpoint's own error response (`502`) rather than the worker being killed and the request failing at the reverse proxy.

#### Scenario: TMDB stops responding
- **WHEN** TMDB accepts connections but never sends a response to a proxied request
- **THEN** the endpoint returns `502` with a generic error before the application server's worker timeout elapses, and the worker stays available for other requests
