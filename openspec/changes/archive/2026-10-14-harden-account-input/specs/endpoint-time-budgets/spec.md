## ADDED Requirements

### Requirement: Followed-people recommendations are rate limited per user
The followed-people recommendations endpoint, which can wait on several TMDB calls per request, SHALL have its own per-user rate limit in addition to its time budget. A request over the limit SHALL get `429` without contacting TMDB.

#### Scenario: Rapid repeated calls
- **WHEN** a signed-in user calls followed-people recommendations more often than the endpoint's limit allows
- **THEN** the extra calls get `429`, and no TMDB requests are made for them

#### Scenario: Two users
- **WHEN** one user is over the limit
- **THEN** another user's calls still succeed
