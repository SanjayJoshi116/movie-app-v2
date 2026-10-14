## ADDED Requirements

### Requirement: The startup warm-up spends its time on users who need it
The recommendation warm-up SHALL skip users whose stored recommendations are still fresh, and SHALL warm the remaining users with watch history oldest first: users with no stored recommendations, then the oldest stored results.

#### Scenario: Restart with mostly fresh users
- **WHEN** the server restarts and most users' recommendations were computed an hour ago
- **THEN** the warm-up makes no TMDB requests for those users

#### Scenario: Warm-up cut short
- **WHEN** the warm-up is stopped at its time bound after warming some users
- **THEN** the users it warmed were the ones with no stored recommendations or the oldest ones, and the next restart continues with the next oldest
