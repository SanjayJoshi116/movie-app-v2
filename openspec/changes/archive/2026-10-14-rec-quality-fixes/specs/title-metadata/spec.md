## MODIFIED Requirements

### Requirement: Unfillable titles are not retried on every request
A title that TMDB reports as not found SHALL be marked as settled in the database and SHALL NOT be fetched again, by any server worker, before or after a restart. A not-found title is stored with unknown language and release year. A title for which TMDB lists no genres SHALL be stored with what TMDB returned and SHALL NOT be fetched again until 30 days after that answer, by any worker or after a restart; then it SHALL be fetched again, so genres and a release year that TMDB adds later are filled in. A title whose fetch failed for any other reason SHALL NOT be retried until a backoff period has passed.

#### Scenario: Title removed from TMDB
- **WHEN** a watched title's TMDB lookup returns not found
- **THEN** it is stored with unknown language and year, and later stats requests don't fetch it again

#### Scenario: Restart after settling
- **WHEN** the backend restarts after a title was settled as not found, and the user opens stats again
- **THEN** no TMDB request is made for that title

#### Scenario: Transient failure
- **WHEN** a title's metadata fetch times out
- **THEN** a stats request a minute later does not fetch it again, and one made after the backoff period does

#### Scenario: Unreleased title without genres
- **WHEN** TMDB returns a watched title with no genres and no release date
- **THEN** stats requests during the next 30 days don't fetch it again, and the first one after 30 days does, storing the genres and release year TMDB has by then

#### Scenario: Title settled without genres before this change
- **WHEN** a title was settled earlier because TMDB listed no genres for it (not because it was missing)
- **THEN** it is fetched once more on a later run, and from then on follows the 30-day recheck
