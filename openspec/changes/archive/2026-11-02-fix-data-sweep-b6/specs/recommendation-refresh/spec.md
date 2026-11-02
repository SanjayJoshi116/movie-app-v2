## ADDED Requirements

### Requirement: The startup warm-up never duplicates a refresh
Before computing a user's recommendations, the startup warm-up SHALL mark that user's stored result as refreshing, and SHALL do so only when no refresh for that user is running on any process and the stored result is still stale. Otherwise it SHALL skip the user. While the warm-up's compute runs, the user's recommendation polls SHALL report it as running and SHALL NOT start another refresh. When the warm-up's compute ends, it SHALL clear only the mark it set, never one another refresh set since. A user with no stored result yet has nothing to mark and is computed as before.

#### Scenario: For You opened during the warm-up
- **WHEN** the warm-up is computing a user's stale recommendations and that user opens For You
- **THEN** the page reports recommendations as being computed, and no second compute starts for that user

#### Scenario: User refreshed before the warm-up reached them
- **WHEN** the warm-up's list includes a user whose recommendations were refreshed by a request after the list was read
- **THEN** the warm-up skips that user and makes no TMDB calls for them

#### Scenario: Warm-up compute fails
- **WHEN** the warm-up's compute for a user raises an error
- **THEN** the user's refreshing mark is cleared, and their next poll can start a refresh

### Requirement: A poll doesn't start a refresh another process is running
A recommendation poll that finds the stored result stale SHALL NOT start a refresh while a refresh for that user is marked running by any server process within the refresh status window. It SHALL report the recommendations as being computed. Once that mark ends or ages past the window, a stale poll SHALL start a refresh as before. A change to the user's data (watched, ratings) SHALL still start or queue a refresh.

#### Scenario: Two server processes
- **WHEN** one server process is refreshing a user's stale recommendations and that user's next poll reaches another process
- **THEN** the second process reports the recommendations as being computed and starts no refresh

#### Scenario: Process killed mid-refresh
- **WHEN** a process that marked a user's refresh as running is killed, and the user polls after the refresh status window has passed
- **THEN** the poll starts a new refresh
