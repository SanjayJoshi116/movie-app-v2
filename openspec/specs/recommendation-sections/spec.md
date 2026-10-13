# recommendation-sections Specification

## Purpose

Defines the shape of the recommendation responses (For You, personalized,
followed people), so each section can be identified and rendered reliably and
the user never sees two sections that are the same section twice.

## Requirements

### Requirement: Section keys are unique within a response
Every section in a recommendation response SHALL have a key that no other
section in the same response has. Sections based on a title SHALL be keyed by
both media type and id. Sections based on a person SHALL be keyed by the
person's TMDB id.

#### Scenario: Movie and show share a TMDB id
- **WHEN** a user's "Because you watched" seeds include movie 1399 and TV show 1399
- **THEN** the two sections have different keys

#### Scenario: Two people with the same name
- **WHEN** a user follows two different people who have the same name
- **THEN** their followed-person sections have different keys

### Requirement: Personalized sections don't repeat a label
The personalized response SHALL NOT contain two sections with the same label.
Clusters that produce the same genre label SHALL be merged into one section,
without duplicate titles.

#### Scenario: Two clusters with the same top genres
- **WHEN** two taste clusters both resolve to "Your Taste: Drama & Crime"
- **THEN** the response has one "Your Taste: Drama & Crime" section, and no title appears in it twice

### Requirement: Followed-people sections keep titles of both media types
A section of recommendations from a followed person SHALL treat a movie and a TV show as different titles even when they share a TMDB id. Only a repeat of the same id and media type SHALL be dropped.

#### Scenario: Movie and show with the same id
- **WHEN** a followed person is credited on movie 1399 and on TV show 1399, both unwatched and well rated
- **THEN** their section lists both titles

### Requirement: Genre-based sections match genres per media type
Genre-based recommendations ("More like what you love", "Based on your taste in …" and the personalized taste sections) SHALL treat a movie genre and its TV counterpart as one genre: Action and Adventure with Action & Adventure, Science Fiction and Fantasy with Sci-Fi & Fantasy, War with War & Politics, and every genre that exists for both media types with itself. A request for movies SHALL use only movie genre ids, and a request for TV only TV genre ids. Titles matching any id of a genre SHALL count as matching that genre. When a section combines several genres, a media type that has no id for one of them SHALL NOT be queried for that section.

#### Scenario: A taste that spans movies and TV
- **WHEN** a user has watched mostly action movies and action TV shows
- **THEN** their action-based section lists both movies and TV shows, under one label

#### Scenario: Cluster across a movie genre and its TV counterpart
- **WHEN** a taste cluster's top genres are Action and Action & Adventure
- **THEN** they count as one genre, and the section is not dropped for returning no titles

#### Scenario: Movie-only genre
- **WHEN** a genre section is based on Horror
- **THEN** it is filled from movies only, and no TV request is made with a movie genre id

### Requirement: Disliked titles don't seed "Because you watched"
"Because you watched" sections SHALL NOT be based on a title the user rated 4 or below. Unrated titles SHALL remain eligible.

#### Scenario: Recently watched but disliked
- **WHEN** a user's most recently watched title is one they rated 2
- **THEN** no "Because you watched" section is based on it
