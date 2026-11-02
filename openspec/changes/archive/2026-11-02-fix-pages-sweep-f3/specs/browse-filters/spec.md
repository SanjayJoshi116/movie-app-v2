## MODIFIED Requirements

### Requirement: Applied filters are scoped to one media type
Applied filters, genres and sort SHALL belong to the media type they were applied on.
Moving between Movies, TV, and the Anime TV/Movies modes SHALL reset the
applied filters, the genres, the sort and the filter panel's inputs to their defaults. Visiting the same media type's grid again (for example Movies → a detail page → Movies, by Back or by the navigation) SHALL keep all of them. A
request SHALL NOT carry a filter or genre the current media type's panel does not show,
and SHALL NOT carry a sort value the current media type's discover endpoint
does not support. The first grid request of a page SHALL already use the filters, genres and sort that page shows, so no request is sent with values that are then replaced.

#### Scenario: Runtime does not carry over to TV
- **WHEN** the user applies a 90–120 minute runtime filter on Movies and then opens TV
- **THEN** the TV request carries no runtime parameter and the panel shows default values

#### Scenario: Title sort on TV
- **WHEN** the user picks "Title (A–Z)" on the TV page and applies
- **THEN** the request sorts by the TV title field and returns results in alphabetical order

#### Scenario: Genre kept on a same-scope visit
- **WHEN** the user applies Drama and a 2010–2020 year range on Movies, opens a movie, then clicks Movies in the sidebar
- **THEN** exactly one grid request is sent, carrying both `with_genres=18` and the year range, and the panel shows Drama and the year range

#### Scenario: Genre dropped on a scope change
- **WHEN** the user applies Drama on Movies and then opens TV
- **THEN** exactly one grid request is sent for TV, and it carries no `with_genres`

### Requirement: Switching the Anime mode sends one grid request
Switching the Anime page between TV and Movies SHALL send exactly one request for the new mode's first page, with that mode's default category. No request SHALL carry the other mode's category parameters. Opening Anime without a Back restore SHALL open in the mode the user last used on Anime this session (TV the first time), so its first request uses that mode's kept filters and is the only grid request sent.

#### Scenario: TV to Movies
- **WHEN** the user switches the Anime page from TV Anime to Anime Movies
- **THEN** one movie discover request is sent for the movies' default category, with no TV airing-date parameters

#### Scenario: Reopening Anime after Anime Movies
- **WHEN** the user applies a year filter in Anime Movies mode, opens the Watchlist, then opens Anime from the sidebar
- **THEN** Anime opens in Movies mode with the year filter, and exactly one movie discover request is sent

### Requirement: Searches stay on the page they were made on
The Movies, TV and Anime grids SHALL NOT have a search mode: a search from the search box SHALL always open the Search page, and returning to a grid SHALL show its categories or filters, never an earlier search. The People page's search SHALL be its own: its term SHALL live in the page's URL (`/people?q=`), survive Back and reload, and SHALL NOT appear in or come from the global search box. Opening People without a term SHALL show popular people. The People search field SHALL always show the term in the URL whenever the URL changes other than by typing (the navigation's People entry, Back, Forward).

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

#### Scenario: People entry while searching People
- **WHEN** the user is on `/people?q=nolan` and clicks People in the navigation
- **THEN** popular people are shown and the search field is empty
