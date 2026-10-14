## MODIFIED Requirements

### Requirement: Filter panel edits apply together
Changes made in the filter panel, including genre picks, SHALL take effect only when the user applies them, and SHALL then take effect together with a single request for the new results. Closing the panel without applying SHALL discard the changes: reopening it SHALL show the filters currently in effect. The panel's genre picks SHALL only ever contain genres of the media type being browsed, including when the panel opens just as the media type changes.

#### Scenario: Close without applying
- **WHEN** the user sets "Year from" to 1990 and picks "Action", then closes the panel without applying, and opens it again
- **THEN** the panel shows the filters in effect before, with no year and no genre, and the results didn't change

#### Scenario: Apply a genre
- **WHEN** the user picks "Action" and presses Apply Filters
- **THEN** the results update once, with exactly one request for the first page of Action titles

#### Scenario: Panel opens as the media type changes
- **WHEN** the user has a movie-only genre applied on Movies and the filter panel opens as they switch to TV
- **THEN** the panel shows no genre picked, and applying it sends no movie genre to the TV results
