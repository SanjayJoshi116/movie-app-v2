## MODIFIED Requirements

### Requirement: Cards that open a page are keyboard-reachable links
Every poster card or thumbnail that opens a detail, person or list page SHALL be
reachable with Tab, SHALL open its page when Enter is pressed, and SHALL be
exposed to assistive technology as a link with the title, person's or list's name as
its accessible name. Opening it with a modifier click (Ctrl/Cmd-click or
middle-click) SHALL open the page in a new tab. This applies to the
Movies, TV and Anime browse grid cards, the recommendation, similar and credit
grids, cast cards, the Home "Recently Watched" strip, Calendar release cards,
person cards, library item cards, Search's movie and TV result cards, the
Recommendations and Following pages' recommendation cards, and the Lists page's
list cards. The Home and Anime hero's "View Details" control and each item in
the notification dropdown SHALL also be links to the title's page. There are no
exceptions. Opening a browse grid card or the hero with a plain click or Enter
SHALL still save the browse state that Back restores.

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

#### Scenario: Browse card in a new tab
- **WHEN** the user middle-clicks a movie poster in the Movies grid
- **THEN** the movie's detail page opens in a new tab and the grid keeps its loaded pages and scroll position

#### Scenario: Browse card from the keyboard
- **WHEN** a keyboard user tabs to a TV show's poster on the TV page and presses Enter
- **THEN** the show's detail page opens, and Back returns to the TV page with the same category and scroll position

#### Scenario: Notification item is a link
- **WHEN** a screen reader reaches an item in the open notification dropdown
- **THEN** it is announced as a link to that title's page
