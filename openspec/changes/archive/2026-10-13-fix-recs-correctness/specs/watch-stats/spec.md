## ADDED Requirements

### Requirement: Genre charts combine movie and TV equivalents
Top Genres and Rating by Genre SHALL count a movie genre and its TV counterpart as one genre, named the way TMDB names the combined TV genre: Action and Adventure with Action & Adventure (shown as "Action & Adventure"), Science Fiction and Fantasy with Sci-Fi & Fantasy (shown as "Sci-Fi & Fantasy"), and War with War & Politics (shown as "War & Politics"). A title tagged with two genres of the same group SHALL count once for that group.

#### Scenario: Action movies and action TV
- **WHEN** a user watched two movies tagged Action and one TV show tagged Action & Adventure
- **THEN** Top Genres shows "Action & Adventure" with 3, and no separate "Action" entry

#### Scenario: Movie tagged Action and Adventure
- **WHEN** a user watched one movie tagged both Action and Adventure
- **THEN** "Action & Adventure" counts it once
