## ADDED Requirements

### Requirement: Form controls have accessible names
Every input, number field, select and switch in the filter drawer and the Add to List dialog SHALL have an accessible name that matches its visible label. In the Add to List dialog, each list SHALL be a checkbox named after the list, toggled with a click on its row or with Space, and not a clickable row that holds an unnamed checkbox.

#### Scenario: Filter drawer year field
- **WHEN** a screen reader user moves to the drawer's first year field
- **THEN** it is announced with its label ("From"), and the label is linked to it

#### Scenario: Adult content switch
- **WHEN** a screen reader user reaches the drawer's adult content switch
- **THEN** it is announced as "Include Adult Content" with its on/off state

#### Scenario: Add to List from the keyboard
- **WHEN** a keyboard user tabs to the checkbox for the list "Favorites" in the Add to List dialog and presses Space
- **THEN** it is announced as "Favorites", and the title is added to that list

### Requirement: Element ids are unique on the page
No two elements on a page SHALL share an `id`, including after the phone Search drawer has been opened.

#### Scenario: Phone search drawer
- **WHEN** a phone user opens the Search drawer from the bottom nav
- **THEN** the page has at most one element with each search box id

### Requirement: Search result cards match the browse cards
Movie and TV result cards on the Search page SHALL offer the same controls as the Movies and TV browse cards, including the watchlist button, and each control's accessible name SHALL include the title it acts on.

#### Scenario: Watchlist from search results
- **WHEN** a user searches Movies for "Fight Club"
- **THEN** the result card has a watchlist button, and its controls are announced with "Fight Club" in their names
