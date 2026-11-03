## MODIFIED Requirements

### Requirement: Navigation highlights the current section
The sidebar and the phone bottom navigation SHALL highlight the navigation entry for the section the current page belongs to, including its sub-pages: a list's page highlights My Lists, and the rate-your-watched-titles page highlights Watched. Pages that belong to no entry (a movie, TV or person page) SHALL highlight none.

#### Scenario: List page
- **WHEN** the user opens one of their lists
- **THEN** My Lists is highlighted in the sidebar and in the bottom navigation's menu

#### Scenario: Rate page
- **WHEN** the user opens the page for rating their watched titles
- **THEN** Watched is highlighted in the sidebar and in the bottom navigation, and only Watched

#### Scenario: Top-level page
- **WHEN** the user is on Watched
- **THEN** Watched is highlighted, and only Watched

#### Scenario: Detail page
- **WHEN** the user opens a movie page
- **THEN** no navigation entry is highlighted
