## MODIFIED Requirements

### Requirement: Filter panel edits apply together
Changes made in the filter panel, including genre picks and the "Include Adult Content" switch, SHALL take effect only when the user applies them, and SHALL then take effect together with a single request for the new results. Closing the panel without applying SHALL discard the changes: reopening it SHALL show the filters currently in effect. The panel's genre picks SHALL only ever contain genres of the media type being browsed, including when the panel opens just as the media type changes.

#### Scenario: Close without applying
- **WHEN** the user sets "Year from" to 1990 and picks "Action", then closes the panel without applying, and opens it again
- **THEN** the panel shows the filters in effect before, with no year and no genre, and the results didn't change

#### Scenario: Apply a genre
- **WHEN** the user picks "Action" and presses Apply Filters
- **THEN** the results update once, with exactly one request for the first page of Action titles

#### Scenario: Panel opens as the media type changes
- **WHEN** the user has a movie-only genre applied on Movies and the filter panel opens as they switch to TV
- **THEN** the panel shows no genre picked, and applying it sends no movie genre to the TV results

#### Scenario: Adult content switch is a draft
- **WHEN** the user turns on "Include Adult Content" in the panel and closes it without applying
- **THEN** no request is sent, the results don't change, and reopening the panel shows the switch off

#### Scenario: Adult content applies with the rest
- **WHEN** the user turns on "Include Adult Content", sets a minimum rating and presses Apply Filters
- **THEN** the results update once, with one request that carries both

## ADDED Requirements

### Requirement: Category buttons work only when they can change the results
On Movies, TV and Anime, the category buttons SHALL be disabled while a search term or an applied filter decides the results, and SHALL NOT send a request or change the highlighted category then. They SHALL be enabled again once the search and filters are cleared.

#### Scenario: Category buttons during a search
- **WHEN** the user has searched Movies for "matrix"
- **THEN** the category buttons are disabled, and no request is sent for a category

#### Scenario: Search cleared
- **WHEN** the user clears the search
- **THEN** the category buttons are enabled and the highlighted category's results are shown

### Requirement: Switching the Anime mode sends one grid request
Switching the Anime page between TV and Movies SHALL send exactly one request for the new mode's first page, with that mode's default category. No request SHALL carry the other mode's category parameters.

#### Scenario: TV to Movies
- **WHEN** the user switches the Anime page from TV Anime to Anime Movies
- **THEN** one movie discover request is sent for the movies' default category, with no TV airing-date parameters
