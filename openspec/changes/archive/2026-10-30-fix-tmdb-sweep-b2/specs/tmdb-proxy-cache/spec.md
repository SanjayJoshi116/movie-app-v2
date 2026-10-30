## MODIFIED Requirements

### Requirement: Successful TMDB responses are reused
The TMDB proxy SHALL store each successful (`200`) response and serve it to later identical requests (same path and the same query parameters, in any order) without contacting TMDB, until the entry expires. A served response SHALL have the same status and body TMDB returned. Rate limits SHALL still count every request, whether or not it's served from the cache.

#### Scenario: Repeat request
- **WHEN** two users request `/api/tmdb/movie/550` within a few minutes of each other
- **THEN** TMDB is contacted once, and both receive the same body with status `200`

#### Scenario: Different parameters
- **WHEN** a client requests `discover/movie?page=1` and then `discover/movie?page=2`
- **THEN** each is fetched from TMDB separately

#### Scenario: Same parameters in another order
- **WHEN** a client requests `discover/movie?page=1&language=en-US` and then `discover/movie?language=en-US&page=1`
- **THEN** TMDB is contacted once

## ADDED Requirements

### Requirement: The proxy forwards only plain TMDB paths
The proxy SHALL forward a request only when its TMDB path is one or more segments of letters, digits, `_` and `-`, separated by single `/`. Any other path (one carrying `?`, `#`, `%`, `\`, an empty segment, or a `.` or `..` segment, after URL decoding) SHALL be refused with `400` without contacting TMDB, so what the cache and credential checks see is exactly what goes upstream.

#### Scenario: Encoded query in the path
- **WHEN** a client requests `/api/tmdb/movie/550%3Fsession_id=abc`
- **THEN** the response is `400`, TMDB is not contacted, and nothing is cached

#### Scenario: Dot segments
- **WHEN** a client requests `/api/tmdb/..%2F4%2Flist%2F1`
- **THEN** the response is `400` and TMDB is not contacted

#### Scenario: Ordinary nested path
- **WHEN** a client requests `/api/tmdb/tv/1396/season/1` or `/api/tmdb/watch/providers/regions`
- **THEN** it is forwarded as before

### Requirement: Upstream key and rate-limit answers are translated
When TMDB rejects the server's own credentials (`401` or `403`), the proxy SHALL answer `502` with its usual "TMDB request failed" error, so a client never reads it as its own sign-in expiring. When TMDB answers `429`, the proxy SHALL pass the `429` on with TMDB's `Retry-After` header. Neither is cached.

#### Scenario: Server key rejected
- **WHEN** TMDB answers a proxied request with `401`
- **THEN** the client gets `502`, not `401`

#### Scenario: TMDB rate limit
- **WHEN** TMDB answers `429` with `Retry-After: 7`
- **THEN** the client gets `429` with `Retry-After: 7`
