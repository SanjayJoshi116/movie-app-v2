# accessibility Specification

## Purpose

Makes the app usable without a mouse and understandable to assistive technology: every control that opens content can be reached and activated from the keyboard, every icon-only control has a name, and keyboard focus is always visible in both themes.

## Requirements

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

### Requirement: Cards with their own buttons keep them separate
On a card that also contains buttons (follow, mark watched, remove), the card's
link SHALL NOT contain those buttons, and activating a button SHALL NOT also
open the card's page. Clicking the rest of the card with the mouse SHALL keep
working as it does today.

#### Scenario: Follow from a person card
- **WHEN** a keyboard user tabs past a person card's poster link to its Follow button and presses Enter
- **THEN** the person is followed and no navigation happens

### Requirement: Icon-only buttons have accessible names
Every button that shows only an icon SHALL have an accessible name that
describes its action. This includes the TV detail page's episode-progress
controls (remove progress, previous/next season, previous/next episode).

#### Scenario: Episode stepper
- **WHEN** a screen reader user edits episode progress on a TV show
- **THEN** the stepper buttons are announced as "Previous season", "Next season", "Previous episode" and "Next episode"

### Requirement: Keyboard focus is visible in both themes
A card link that has keyboard focus SHALL show a visible focus indicator that
contrasts with the background in both light and dark themes. Mouse clicks SHALL
NOT leave a focus ring behind.

#### Scenario: Tab in light theme
- **WHEN** a keyboard user tabs onto a card in light theme
- **THEN** a clearly visible outline surrounds the card

### Requirement: Account controls are keyboard-reachable and named
The control that opens the profile dialog and the Sign Out control SHALL be reachable with Tab at every screen size, SHALL activate with Enter or Space, and SHALL have the accessible names "Edit profile" and "Sign out".

#### Scenario: Open the profile dialog from the keyboard on desktop
- **WHEN** a keyboard user on a desktop-width screen tabs to their avatar in the sidebar and presses Enter
- **THEN** the profile dialog opens

#### Scenario: Sign Out is announced
- **WHEN** a screen reader reaches the sidebar's sign-out icon button
- **THEN** it is announced as "Sign out"

### Requirement: The activity heatmap is keyboard-readable
The Stats activity heatmap SHALL be reachable with a single Tab stop. While it has focus, the arrow keys SHALL move between days following the grid (columns are weeks and rows are weekdays, so Up/Down move one day and Left/Right one week), staying within the shown days, and the focused day's date and count SHALL be shown visibly and announced to assistive technology. Leaving the heatmap with Tab SHALL NOT require passing through each day.

#### Scenario: Reading a day from the keyboard
- **WHEN** a keyboard user tabs to the heatmap and presses Up
- **THEN** the previous day is highlighted and its date and count are shown and announced

#### Scenario: Tabbing past
- **WHEN** a keyboard user tabs into the heatmap and presses Tab again
- **THEN** focus moves to the next control after the heatmap

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
