## ADDED Requirements

### Requirement: A search is addressable by URL
The search results page's URL SHALL carry the search term and the active tab. Opening that URL (a reload, a shared link, or returning after login) SHALL show the same search with the same tab active. Starting a new search from the search box SHALL keep the current tab.

#### Scenario: Reload a search
- **WHEN** the user searches for "nolan", switches to the People tab and reloads the page
- **THEN** the page shows People results for "nolan"

#### Scenario: Return after login
- **WHEN** a signed-out user opens `/search?q=nolan&tab=people`, is sent to login and signs in
- **THEN** they land on People results for "nolan"

#### Scenario: New search keeps the tab
- **WHEN** the user is on the TV tab and searches for a new term
- **THEN** the TV tab shows results for the new term
