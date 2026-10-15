## ADDED Requirements

### Requirement: Motion follows the reduce-motion setting
When the device asks for reduced motion, the app SHALL NOT animate page transitions, card hover lift or scale, the sidebar's entrance, the Stats count-up or the title marquee: content SHALL appear in its final state at once. With motion allowed, those animations SHALL stay as they are.

#### Scenario: Reduced motion
- **WHEN** a user whose device asks for reduced motion opens Stats
- **THEN** the stat numbers show their final values immediately, and changing pages doesn't animate

#### Scenario: Hover with reduced motion
- **WHEN** that user hovers a poster card or a long card title
- **THEN** the card doesn't lift or scale and the title doesn't scroll

#### Scenario: Motion allowed
- **WHEN** a user whose device doesn't ask for reduced motion opens Stats
- **THEN** the numbers count up as before

### Requirement: Each page has its own title, and navigation is announced
Every page SHALL set the document title to its name followed by "CINE DB" (for example "Watchlist · CINE DB"). Movie, TV and person pages SHALL use the title's or person's name once loaded. After an in-app navigation, assistive technology SHALL be told the new page's title through a polite live announcement, without moving focus or changing the scroll position.

#### Scenario: Two tabs
- **WHEN** a user has Watched open in one tab and a movie page in another
- **THEN** the tabs read "Watched · CINE DB" and "<movie title> · CINE DB"

#### Scenario: Screen reader navigation
- **WHEN** a screen reader user follows a link from Movies to My Lists
- **THEN** "My Lists · CINE DB" is announced

#### Scenario: Restored scroll kept
- **WHEN** a user goes Back to a browse page whose scroll position is restored
- **THEN** the announcement doesn't move focus or scroll

### Requirement: Card action buttons name their title
On every title card, each action button's accessible name SHALL include the title it acts on (for example "Remove from watchlist: Dune"), on the Watchlist, Watched and list pages as on the browse, search and For You cards.

#### Scenario: Watchlist card
- **WHEN** a screen reader user moves through the buttons on Watchlist cards
- **THEN** each button is announced with its action and its card's title

### Requirement: Navigation entries are links
Every entry in the sidebar and the phone bottom navigation (including its "More" drawer) SHALL be a link to its page: a plain click or Enter SHALL navigate within the app, and Ctrl/Cmd-click or middle-click SHALL open the page in a new tab.

#### Scenario: Open Stats in a new tab
- **WHEN** a user Ctrl-clicks Stats in the sidebar
- **THEN** Stats opens in a new tab and the current page stays

#### Scenario: Plain click
- **WHEN** a user clicks Watched in the bottom navigation
- **THEN** the app shows Watched without reloading

### Requirement: Password fields declare their purpose
Every password field SHALL say what it holds for password managers: the current-password fields (sign-in, the profile's "Current Password", account deletion) as `current-password`, and every new-password field as `new-password`.

#### Scenario: Profile dialog
- **WHEN** a user's password manager fills the Edit Profile dialog
- **THEN** it fills only "Current Password", never "New Password" or "Confirm Password"

### Requirement: Truncated card titles stay readable
A card title too long for its card SHALL end in an ellipsis, with the full title available as its tooltip text and to assistive technology. It SHALL be re-measured when the card's width changes. With motion allowed, hovering it MAY scroll it into view.

#### Scenario: Touch user
- **WHEN** a touch user sees a card whose title is cut off
- **THEN** the cut is marked with an ellipsis

#### Scenario: Card widens
- **WHEN** the window widens so the full title fits
- **THEN** the ellipsis disappears
