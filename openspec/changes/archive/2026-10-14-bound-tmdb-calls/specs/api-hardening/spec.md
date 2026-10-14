## MODIFIED Requirements

### Requirement: TMDB proxy responds within a bounded time
The TMDB passthrough endpoint SHALL return a response within a bounded worst-case time, retries included. That time SHALL be below the application server's worker timeout, so a slow or unresponsive TMDB results in the endpoint's own error response (`502`) rather than the worker being killed and the request failing at the reverse proxy. The bound SHALL be a limit on elapsed time for the whole TMDB call, so it SHALL hold however many network addresses TMDB's host name resolves to and however many of them fail to connect.

#### Scenario: TMDB stops responding
- **WHEN** TMDB accepts connections but never sends a response to a proxied request
- **THEN** the endpoint returns `502` with a generic error before the application server's worker timeout elapses, and the worker stays available for other requests

#### Scenario: Every address drops connection attempts
- **WHEN** TMDB's host name resolves to four addresses and connection attempts to each of them hang until they time out
- **THEN** the endpoint still returns `502` before the application server's worker timeout elapses
