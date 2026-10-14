## ADDED Requirements

### Requirement: Taste clusters are built from titles the user likes and that have genres
The personalized taste sections SHALL be computed only from watched titles that have at least one genre and that the user didn't rate 4 or below. When fewer than 3 such titles remain, the personalized response SHALL have no taste sections.

#### Scenario: Many disliked horror films
- **WHEN** a user's watched history includes ten horror films rated 1 or 2 and a few drama and comedy titles rated 8
- **THEN** no personalized section is labelled with Horror

#### Scenario: Titles without genres
- **WHEN** half of a user's watched titles have no genres yet
- **THEN** the taste sections are computed from the other half, as if the genre-less titles weren't there

#### Scenario: Too few usable titles
- **WHEN** a user has watched 5 titles but only 2 have genres and weren't rated 4 or below
- **THEN** the personalized response has no taste sections

### Requirement: A taste cluster spanning movie-only and TV-only genres still yields titles
When a taste cluster's top genres can't be requested together for a media type, that media type SHALL be requested with each of those genres alone, the top one first, until one can be requested. The cluster SHALL produce a section whenever either media type returns titles.

#### Scenario: Horror and Reality
- **WHEN** a taste cluster's top genres are Horror (movies only) and Reality (TV only)
- **THEN** the section is filled with Horror movies and Reality shows, and no request sends a genre id of the other media type

### Requirement: Rated titles are never recommended
Recommendation sections SHALL NOT include a title the user has rated, whether or not it is marked watched.

#### Scenario: Rated but not watched
- **WHEN** a user rated a movie without marking it watched, and it would otherwise appear in a "More like" or taste section
- **THEN** it doesn't appear in any recommendation section
