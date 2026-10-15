## ADDED Requirements

### Requirement: Metadata backfills are capped per server process
Besides being single-flight per user, at most a fixed small number of metadata backfills SHALL run at the same time in one server process. Further backfills SHALL wait their turn and SHALL NOT hold a database connection or start TMDB requests while waiting. A waiting backfill SHALL still run once a slot frees.

#### Scenario: Many users open Stats at once
- **WHEN** 50 users who each have titles missing metadata open Stats within a few seconds
- **THEN** no more than the cap of backfills fetch from TMDB at once, the others wait without holding database connections, and every user's titles are eventually filled

#### Scenario: A slot frees
- **WHEN** a running backfill finishes while others are waiting
- **THEN** one waiting backfill starts
