## MODIFIED Requirements

### Requirement: Cards that open a page are keyboard-reachable links
Every poster card or thumbnail that opens a detail, person or list page SHALL be
reachable with Tab, SHALL open its page when Enter is pressed, and SHALL be
exposed to assistive technology as a link with the title, person's or list's name as
its accessible name. Opening it with a modifier click (Ctrl/Cmd-click or
middle-click) SHALL open the page in a new tab. This applies to the
recommendation, similar and credit grids, cast cards, the Home "Recently
Watched" strip, Calendar release cards, person cards, library item cards,
Search's movie and TV result cards, the Recommendations and Following pages'
recommendation cards, and the Lists page's list cards. There are no exceptions.

#### Scenario: Keyboard opens a similar title
- **WHEN** a keyboard user on a movie's detail page tabs to a card in "Similar" and presses Enter
- **THEN** that title's detail page opens

#### Scenario: Screen reader name
- **WHEN** a screen reader reaches a cast card for "Brad Pitt"
- **THEN** it is announced as a link named "Brad Pitt"

#### Scenario: Open in new tab
- **WHEN** the user Ctrl-clicks a Calendar release card
- **THEN** the title's detail page opens in a new tab and the current page stays put

#### Scenario: Open a list from the keyboard
- **WHEN** a keyboard user on the Lists page tabs to a list and presses Enter
- **THEN** that list's page opens

#### Scenario: Search result in a new tab
- **WHEN** the user Ctrl-clicks a movie in Search results
- **THEN** the movie's detail page opens in a new tab and the search stays put

## ADDED Requirements

### Requirement: Account controls are keyboard-reachable and named
The control that opens the profile dialog and the Sign Out control SHALL be reachable with Tab at every screen size, SHALL activate with Enter or Space, and SHALL have the accessible names "Edit profile" and "Sign out".

#### Scenario: Open the profile dialog from the keyboard on desktop
- **WHEN** a keyboard user on a desktop-width screen tabs to their avatar in the sidebar and presses Enter
- **THEN** the profile dialog opens

#### Scenario: Sign Out is announced
- **WHEN** a screen reader reaches the sidebar's sign-out icon button
- **THEN** it is announced as "Sign out"
