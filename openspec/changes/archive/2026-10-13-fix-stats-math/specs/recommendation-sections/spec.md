## ADDED Requirements

### Requirement: Followed-people sections keep titles of both media types
A section of recommendations from a followed person SHALL treat a movie and a TV show as different titles even when they share a TMDB id. Only a repeat of the same id and media type SHALL be dropped.

#### Scenario: Movie and show with the same id
- **WHEN** a followed person is credited on movie 1399 and on TV show 1399, both unwatched and well rated
- **THEN** their section lists both titles
