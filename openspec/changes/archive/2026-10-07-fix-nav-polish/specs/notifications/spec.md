## ADDED Requirements

### Requirement: Notification popup opens fully on-screen
When the user opens the notification dropdown from any bell, the whole popup SHALL lie inside the viewport. This applies at phone (<768px), tablet (768–991px) and desktop (≥992px) widths, including the desktop sidebar's manually collapsed icon rail. The popup SHALL stay attached to its bell while the page scrolls.

#### Scenario: Desktop sidebar bell
- **WHEN** a signed-in user opens the bell in the sidebar at 1366×768
- **THEN** the popup's left, right, top and bottom edges are all inside the viewport

#### Scenario: Tablet icon-rail bell
- **WHEN** a signed-in user opens the bell in the 64px icon rail at 800px width
- **THEN** the popup's left edge is at or right of the viewport's left edge, and its right edge is inside the viewport

#### Scenario: Phone bottom-nav bell
- **WHEN** a signed-in user opens the bell in the bottom navigation at 375px width
- **THEN** the popup sits above the bottom navigation and fits horizontally inside the viewport

#### Scenario: Popup follows its bell on scroll
- **WHEN** the popup is open on a browse page and the page scrolls
- **THEN** the popup stays anchored to its bell and does not drift or jump
