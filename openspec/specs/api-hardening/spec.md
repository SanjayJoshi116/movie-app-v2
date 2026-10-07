# api-hardening Specification

## Purpose

Defines backend-wide protections: API responses never disclose secrets or raw upstream errors, rate limits identify clients in a way they can't forge and enforce limits consistently across server workers, and production configuration fails closed.

## Requirements

### Requirement: Upstream failures are reported generically
When a backend call to TMDB fails, the API response SHALL contain a generic error message and SHALL NOT include the upstream exception text, request URL, query parameters, or any credential. Server-side logs of such failures SHALL have the TMDB API key redacted.

#### Scenario: Invalid TMDB request token
- **WHEN** a signed-in user submits an invalid request token to the TMDB session-creation endpoint and TMDB rejects it
- **THEN** the response is a `502` with a generic message, and the response body doesn't contain the TMDB API key, `api_key`, or the TMDB URL

#### Scenario: Failure is logged without the key
- **WHEN** any TMDB-auth call fails
- **THEN** a server log entry records the failure, and the TMDB API key value doesn't appear in it

### Requirement: Caller-supplied redirect targets are encoded
When the system builds the TMDB authorization URL from a caller-supplied `redirect_to` value, it SHALL URL-encode that value so it can't add or override query parameters of the TMDB URL.

#### Scenario: Redirect value with extra parameters
- **WHEN** `redirect_to` is `http://localhost/cb?x=1&foo=bar`
- **THEN** the returned authorization URL carries the whole value as one encoded `redirect_to` parameter, with no separate `foo` parameter

### Requirement: Rate-limit identity can't be forged by clients
Rate limiting SHALL identify an anonymous client by the address seen by the outermost trusted proxy (or the direct connection address when no proxy is configured). Header values that the client itself supplied SHALL NOT change which rate-limit bucket a request counts against.

#### Scenario: Spoofed forwarding header
- **WHEN** an anonymous client exceeds the login rate limit and then retries with a different, made-up `X-Forwarded-For` value on each request
- **THEN** the retries are still rate-limited (`429`)

#### Scenario: Distinct real clients behind the proxy
- **WHEN** two clients with different real addresses each send login requests through the deployment's reverse proxy
- **THEN** each client has its own independent rate-limit allowance

### Requirement: Rate limits are enforced across all server workers
In production, each rate limit SHALL be enforced against one counter shared by all application server processes, so the effective limit equals the configured rate whatever the number of workers. The shared counter store SHALL keep each client's counters for the full rate-limit window even when many distinct clients are active. A client's counter SHALL NOT be dropped early just because other clients created more counters.

#### Scenario: Requests spread across workers
- **WHEN** the configured login rate is 10 per minute and a client sends 11 login attempts within a minute that land on different worker processes
- **THEN** the 11th attempt is rejected with `429`

#### Scenario: Many active clients
- **WHEN** more than 300 distinct clients have made rate-limited requests within the current window, and one of them then exceeds its limit
- **THEN** that client's excess request is still rejected with `429`

### Requirement: Production configuration fails closed
When the debug setting isn't explicitly enabled, the backend SHALL run with debug off. With debug off, the backend SHALL refuse to start if the allowed-hosts setting contains a wildcard or is empty, or if the secret key is the built-in development default.

#### Scenario: DEBUG unset
- **WHEN** the backend starts with no `DEBUG` environment variable and valid production settings
- **THEN** it runs with debug off (no debug error pages, no permissive CORS/hosts relaxation)

#### Scenario: Wildcard hosts in production
- **WHEN** the backend starts with debug off and `ALLOWED_HOSTS=*`
- **THEN** startup fails with a configuration error naming `ALLOWED_HOSTS`

#### Scenario: Local development
- **WHEN** a developer runs `npm run dev`
- **THEN** the backend runs with debug on and accepts LAN-address hosts, as it does today

### Requirement: TMDB proxy responds within a bounded time
The TMDB passthrough endpoint SHALL return a response within a bounded worst-case time, retries included. That time SHALL be below the application server's worker timeout, so a slow or unresponsive TMDB results in the endpoint's own error response (`502`) rather than the worker being killed and the request failing at the reverse proxy.

#### Scenario: TMDB stops responding
- **WHEN** TMDB accepts connections but never sends a response to a proxied request
- **THEN** the endpoint returns `502` with a generic error before the application server's worker timeout elapses, and the worker stays available for other requests

### Requirement: TMDB proxy forwards query parameters faithfully
The TMDB proxy SHALL forward every query parameter value the client sends,
including repeated parameters, in the same order. It SHALL always use the
server's own TMDB API key, and SHALL NOT forward an `api_key` supplied by the
client.

#### Scenario: Repeated parameter
- **WHEN** a client requests the proxy with `?with_genres=28&with_genres=12`
- **THEN** the upstream TMDB request carries both `with_genres` values

#### Scenario: Client-supplied key
- **WHEN** a client includes `api_key=abc` in a proxy request
- **THEN** the upstream request carries only the server's API key
