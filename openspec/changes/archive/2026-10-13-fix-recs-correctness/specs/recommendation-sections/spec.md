## ADDED Requirements

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
