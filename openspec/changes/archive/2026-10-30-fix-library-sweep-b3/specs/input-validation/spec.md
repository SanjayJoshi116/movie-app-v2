## ADDED Requirements

### Requirement: Single adds accept a missing poster or score
A single watchlist, watched or list-item add SHALL accept a request without a poster path (stored as none) or without a score (stored as 0), as bulk imports do. Values that are sent SHALL still be validated as before.

#### Scenario: Title without a poster
- **WHEN** a user adds to the watchlist a title whose request has no posterPath
- **THEN** the entry is saved with no poster and the card shows the poster placeholder

#### Scenario: Title without a score
- **WHEN** a user marks watched a title whose request has no voteAverage
- **THEN** the entry is saved with a score of 0
