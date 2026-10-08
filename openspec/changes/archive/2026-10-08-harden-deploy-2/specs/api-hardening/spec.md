## ADDED Requirements

### Requirement: TMDB proxy limits apply per user
TMDB proxy requests from a signed-in user SHALL be identified as that user for rate limiting, so users who share a public IP address don't share one limit. Signed-out requests SHALL keep being limited per IP address.

#### Scenario: Two users behind one NAT
- **WHEN** two signed-in users on the same public IP address browse at the same time
- **THEN** each has their own TMDB proxy limit, and one user's browsing doesn't make the other's requests fail

### Requirement: Proxy paths can't reach other app endpoints
A TMDB proxy request built from a route parameter SHALL only be sent when the parameter is a valid TMDB id (a positive integer). A crafted id that decodes to path segments SHALL NOT turn into a request to any other app endpoint, with or without credentials.

#### Scenario: Path traversal in a detail URL
- **WHEN** a user opens `/movie/..%2F..%2Fwatchlist`
- **THEN** no request is sent to `/api/watchlist/` (or any non-TMDB endpoint), and the not-found page is shown
