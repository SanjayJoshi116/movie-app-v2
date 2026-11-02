## ADDED Requirements

### Requirement: Followed-people credit fetches run on bounded shared capacity
TMDB credit fetches for followed people (notifications polls and followed-people recommendations) SHALL run on a fixed amount of capacity shared by all requests in a server process, separate from the TMDB proxy's and the per-call deadline capacity. Fetches left running after their request's deadline SHALL only ever delay other followed-people fetches, and the number of such fetches in flight at once SHALL NOT grow with the number of requests.

#### Scenario: Many slow polls
- **WHEN** TMDB stops answering credit requests and many users' notifications polls arrive one after another
- **THEN** each poll still responds within its budget, the number of credit fetches in flight stays at the fixed capacity, and a rating's TMDB sync still starts at once
