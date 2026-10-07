## ADDED Requirements

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
