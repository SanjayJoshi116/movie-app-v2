## ADDED Requirements

### Requirement: Browse grids hide watched titles
The Movies, TV and Anime browse grids SHALL leave out titles the user has marked watched, unless a search term is active. A title marked watched from a browse card SHALL leave the grid right away. Search results SHALL include watched titles.

#### Scenario: Marking a card watched
- **WHEN** the user marks a movie watched from its card in the Movies grid
- **THEN** the card leaves the grid

#### Scenario: Searching for a watched title
- **WHEN** the user searches for a title they have watched
- **THEN** the title appears in the search results with its watched state

### Requirement: The Anime hero is an anime
The hero banner on the Anime page SHALL feature only a title from the same anime source as the Anime grid. When no such title is available, the page SHALL show no hero rather than a non-anime title.

#### Scenario: Trending animation that isn't anime
- **WHEN** a non-anime animated film is the week's top trending animation
- **THEN** the Anime hero does not feature it
