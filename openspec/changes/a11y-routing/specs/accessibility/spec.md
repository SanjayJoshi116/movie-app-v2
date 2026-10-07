## Purpose

Makes the app usable without a mouse and understandable to assistive
technology: every control that opens content can be reached and activated from
the keyboard, every icon-only control has a name, and keyboard focus is always
visible in both themes.

## ADDED Requirements

### Requirement: Cards that open a page are keyboard-reachable links
Every poster card or thumbnail that opens a detail or person page SHALL be
reachable with Tab, SHALL open its page when Enter is pressed, and SHALL be
exposed to assistive technology as a link with the title or person's name as
its accessible name. Opening it with a modifier click (Ctrl/Cmd-click or
middle-click) SHALL open the page in a new tab. This applies to the
recommendation, similar and credit grids, cast cards, the Home "Recently
Watched" strip, Calendar release cards, person cards and library item cards.

#### Scenario: Keyboard opens a similar title
- **WHEN** a keyboard user on a movie's detail page tabs to a card in "Similar" and presses Enter
- **THEN** that title's detail page opens

#### Scenario: Screen reader name
- **WHEN** a screen reader reaches a cast card for "Brad Pitt"
- **THEN** it is announced as a link named "Brad Pitt"

#### Scenario: Open in new tab
- **WHEN** the user Ctrl-clicks a Calendar release card
- **THEN** the title's detail page opens in a new tab and the current page stays put

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
