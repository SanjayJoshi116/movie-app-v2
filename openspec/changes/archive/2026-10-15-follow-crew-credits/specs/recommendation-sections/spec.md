## ADDED Requirements

### Requirement: Followed-people sections show new and upcoming work
Each "New from {name}" section SHALL list the followed person's titles (acting or any crew job) released in the last two years or dated in the future, newest first, leaving out titles the user has watched. It SHALL NOT require a minimum rating, so new and upcoming titles with few votes are included. Titles with no release date SHALL be left out.

#### Scenario: Upcoming film
- **WHEN** a followed director has a film dated next year
- **THEN** it leads their "New from" section

#### Scenario: Old classic
- **WHEN** a followed actor's best-rated film is from 1999 and they have newer titles
- **THEN** the 1999 film isn't in their "New from" section

#### Scenario: Nothing recent
- **WHEN** a followed person has no titles in the last two years or ahead
- **THEN** no section is shown for them

### Requirement: Talk and news appearances don't drive person-based sections
Person-based sections ("New from {name}" and "Because you like {actor}") SHALL NOT list talk shows or news programmes a person appeared on.

#### Scenario: Actor on a late-night show
- **WHEN** a followed actor appeared on a late-night talk show this year
- **THEN** the talk show isn't in their "New from" section, nor in "Because you like" sections for them

## MODIFIED Requirements

### Requirement: Followed-people sections keep titles of both media types
A section of recommendations from a followed person SHALL treat a movie and a TV show as different titles even when they share a TMDB id. Only a repeat of the same id and media type SHALL be dropped.

#### Scenario: Movie and show with the same id
- **WHEN** a followed person is credited on movie 1399 and on TV show 1399, both unwatched and released in the last two years
- **THEN** their section lists both titles
