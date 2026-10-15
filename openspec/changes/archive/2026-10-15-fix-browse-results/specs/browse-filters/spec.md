## ADDED Requirements

### Requirement: Sort options return meaningful titles
Every browse sort SHALL return titles a viewer would recognise, on Movies, TV and Anime alike:
- Rating (High to Low) SHALL only list titles with at least a minimum number of votes, so a title rated 10 by one voter never leads.
- Release Date (Newest) SHALL only list titles released on or before the device's today, with at least a few votes, so placeholders dated years ahead never lead. A year range the user set still applies within that.
- Release Date (Oldest) and Title (A–Z) SHALL only list titles with at least a minimum number of votes.
- Popularity SHALL be unchanged.
The minimums SHALL be defined once in the frontend and used by every grid.

#### Scenario: Rating sort
- **WHEN** the user sorts Movies by Rating (High to Low)
- **THEN** no listed title has fewer votes than the rating sort's minimum

#### Scenario: Newest sort
- **WHEN** the user sorts TV by Release Date (Newest)
- **THEN** no listed show first aired after today

#### Scenario: Newest with a past year range
- **WHEN** the user sorts by Release Date (Newest) with years 1990–1999
- **THEN** the results are 1990s titles, newest first

#### Scenario: Title A–Z
- **WHEN** the user sorts Movies by Title (A–Z)
- **THEN** the first results are titles with at least the minimum vote count, not unvoted uploads named with punctuation

### Requirement: Searches stay on the page they were made on
The Movies, TV and Anime grids SHALL NOT have a search mode: a search from the search box SHALL always open the Search page, and returning to a grid SHALL show its categories or filters, never an earlier search. The People page's search SHALL be its own: its term SHALL live in the page's URL (`/people?q=`), survive Back and reload, and SHALL NOT appear in or come from the global search box. Opening People without a term SHALL show popular people.

#### Scenario: Global search, then People
- **WHEN** the user searches "batman" from the sidebar and then opens People
- **THEN** People shows popular people, with an empty search field

#### Scenario: People search, then the sidebar box
- **WHEN** the user searches People for "nolan"
- **THEN** the sidebar search box doesn't show "nolan", and the URL is `/people?q=nolan`

#### Scenario: Back to People
- **WHEN** the user searches People for "nolan", opens a person and goes Back
- **THEN** People still shows the results for "nolan"

#### Scenario: Back to Movies after a search
- **WHEN** the user opens a movie from Movies, searches "batman" from the sidebar, then goes Back twice
- **THEN** Movies shows its category grid, not search results

## MODIFIED Requirements

### Requirement: Browse grids hide watched titles
The Movies, TV and Anime browse grids SHALL leave out titles the user has marked watched. A title marked watched from a browse card SHALL leave the grid right away. Search results (the Search page) SHALL include watched titles.

#### Scenario: Marking a card watched
- **WHEN** the user marks a movie watched from its card in the Movies grid
- **THEN** the card leaves the grid

#### Scenario: Searching for a watched title
- **WHEN** the user searches for a title they have watched
- **THEN** the title appears in the search results with its watched state

### Requirement: Category buttons work only when they can change the results
On Movies, TV and Anime, the category buttons SHALL be disabled while an applied filter decides the results, and SHALL NOT send a request or change the highlighted category then. They SHALL be enabled again once the filters are cleared.

#### Scenario: Category buttons with a filter applied
- **WHEN** the user has applied a year filter on Movies
- **THEN** the category buttons are disabled, and no request is sent for a category

#### Scenario: Filters cleared
- **WHEN** the user resets the filters
- **THEN** the category buttons are enabled and the highlighted category's results are shown
