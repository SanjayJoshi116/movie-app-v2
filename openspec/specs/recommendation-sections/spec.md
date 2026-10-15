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
- **WHEN** a followed person is credited on movie 1399 and on TV show 1399, both unwatched and released in the last two years
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
