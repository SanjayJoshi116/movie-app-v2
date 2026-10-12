## MODIFIED Requirements

### Requirement: A failed TMDB fetch never replaces cached metadata
When refreshing a title's cached metadata fails, the system SHALL keep the
existing cached metadata unchanged and use it, even if it is past its
freshness window. When no cached metadata exists, the system SHALL store
nothing for that title, so a later request fetches it again. TMDB answering
that the title doesn't exist is not a failure: the system SHALL store empty
genres and cast for that title, and SHALL NOT fetch it again until that entry
is past its freshness window.

#### Scenario: Refresh fails for a title with good cached data
- **WHEN** a title's cached genres and cast are older than the freshness window and the TMDB fetch to refresh them fails
- **THEN** the cached genres and cast are unchanged and are used for that computation

#### Scenario: First fetch fails
- **WHEN** a title has no cached metadata and the TMDB fetch fails
- **THEN** no empty metadata row is stored, and the next computation fetches it again

#### Scenario: Title not found on TMDB
- **WHEN** TMDB reports a watched title as not found while its cached metadata is fetched
- **THEN** empty genres and cast are stored for it, and the next computation within the freshness window doesn't request it from TMDB
