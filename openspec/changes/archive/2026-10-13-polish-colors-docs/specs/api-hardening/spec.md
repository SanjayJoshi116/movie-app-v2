## MODIFIED Requirements

### Requirement: TMDB proxy forwards query parameters faithfully
The TMDB proxy SHALL forward every query parameter value the client sends, including every value of a repeated parameter. The values of a repeated parameter SHALL keep the order the client sent them in. The proxy MAY group parameters by name, since TMDB doesn't depend on the order of different parameters. It SHALL always use the server's own TMDB API key, and SHALL NOT forward an `api_key` supplied by the client.

#### Scenario: Repeated parameter
- **WHEN** a client requests the proxy with `?with_genres=28&with_genres=12`
- **THEN** the upstream TMDB request carries both `with_genres` values, 28 before 12

#### Scenario: Client-supplied key
- **WHEN** a client includes `api_key=abc` in a proxy request
- **THEN** the upstream request carries only the server's API key
