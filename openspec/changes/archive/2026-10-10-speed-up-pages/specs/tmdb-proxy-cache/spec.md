## Purpose

Has the server keep successful TMDB proxy responses for a while, so a repeat visit doesn't wait on TMDB again. Defines what is cached, for how long, and what must never be cached or shared between users.

## ADDED Requirements

### Requirement: Successful TMDB responses are reused
The TMDB proxy SHALL store each successful (`200`) response and serve it to later identical requests (same path and the same query parameters) without contacting TMDB, until the entry expires. A served response SHALL have the same status and body TMDB returned. Rate limits SHALL still count every request, whether or not it's served from the cache.

#### Scenario: Repeat request
- **WHEN** two users request `/api/tmdb/movie/550` within a few minutes of each other
- **THEN** TMDB is contacted once, and both receive the same body with status `200`

#### Scenario: Different parameters
- **WHEN** a client requests `discover/movie?page=1` and then `discover/movie?page=2`
- **THEN** each is fetched from TMDB separately

### Requirement: Cache lifetimes match how often the data changes
Cached entries SHALL expire by kind of resource:
- lists that change often (trending, discover, popular, now playing, upcoming, top rated, airing today, on the air, search): within about 10 minutes
- genre lists and TMDB configuration: within about 24 hours
- everything else, such as a title's or person's details and their sub-resources: within about 6 hours

#### Scenario: Trending list ages out
- **WHEN** a trending list was cached more than its list lifetime ago
- **THEN** the next request fetches it from TMDB again

### Requirement: Failures and per-user data are never cached
The proxy SHALL NOT cache any non-`200` response, any request that fails to reach TMDB, or any request whose parameters include a user credential (`session_id` or `guest_session_id`). Such requests SHALL always go to TMDB.

#### Scenario: TMDB error
- **WHEN** TMDB answers a proxied request with `404` or `5xx`, or the request times out
- **THEN** nothing is cached, and the next identical request goes to TMDB again

#### Scenario: Request carrying a session id
- **WHEN** a client sends a proxy request with a `session_id` parameter
- **THEN** the response is neither served from nor stored in the cache

### Requirement: The proxy cache can't disturb other cached state
TMDB proxy entries SHALL be stored apart from the server's other cached state (rate-limit counters, notification and recommendation data). Filling or evicting proxy entries SHALL NOT evict those. The cache's size SHALL be bounded.

#### Scenario: Heavy browsing
- **WHEN** users browse enough distinct titles to reach the proxy cache's size limit
- **THEN** older proxy entries are evicted, and no rate-limit counter is lost
