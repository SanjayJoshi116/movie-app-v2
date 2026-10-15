## ADDED Requirements

### Requirement: Navigation highlights the current section
The sidebar and the phone bottom navigation SHALL highlight the navigation entry for the section the current page belongs to, including its sub-pages: a list's page highlights My Lists. Pages that belong to no entry (a movie, TV or person page) SHALL highlight none.

#### Scenario: List page
- **WHEN** the user opens one of their lists
- **THEN** My Lists is highlighted in the sidebar and in the bottom navigation's menu

#### Scenario: Top-level page
- **WHEN** the user is on Watched
- **THEN** Watched is highlighted, and only Watched

#### Scenario: Detail page
- **WHEN** the user opens a movie page
- **THEN** no navigation entry is highlighted
