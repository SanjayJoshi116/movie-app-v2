## MODIFIED Requirements

### Requirement: Motion follows the reduce-motion setting
When the device asks for reduced motion, the app SHALL NOT animate page transitions, card hover lift or scale, the sidebar's entrance, the Stats count-up, the Stats charts' entrance or the title marquee, and scrolls the app starts itself (going to the top on a page change, jumping to a date) SHALL jump instead of scrolling smoothly: content SHALL appear in its final state at once. With motion allowed, those animations SHALL stay as they are.

#### Scenario: Reduced motion
- **WHEN** a user whose device asks for reduced motion opens Stats
- **THEN** the stat numbers show their final values immediately, the charts appear fully drawn, and changing pages doesn't animate

#### Scenario: Hover with reduced motion
- **WHEN** that user hovers a poster card or a long card title
- **THEN** the card doesn't lift or scale and the title doesn't scroll

#### Scenario: Page change with reduced motion
- **WHEN** that user is scrolled down on Watched or the Watchlist and picks another page
- **THEN** the view jumps to the top without a smooth scroll

#### Scenario: Motion allowed
- **WHEN** a user whose device doesn't ask for reduced motion opens Stats
- **THEN** the numbers count up and the charts animate in as before

### Requirement: Each page has its own title, and navigation is announced
Every page SHALL set the document title to its name followed by "CINE DB" (for example "Watchlist · CINE DB"). Movie, TV and person pages SHALL use the title's or person's name once loaded. After an in-app navigation, assistive technology SHALL be told the new page's title through a polite live announcement, without moving focus or changing the scroll position. The announcement SHALL be the title the new page settles on: never the previous page's title, and on a page that loads a name, the loaded name (or the generic title once loading has failed), not the generic title shown while it loads. The first page load of the app SHALL NOT be announced.

#### Scenario: Two tabs
- **WHEN** a user has Watched open in one tab and a movie page in another
- **THEN** the tabs read "Watched · CINE DB" and "<movie title> · CINE DB"

#### Scenario: Screen reader navigation
- **WHEN** a screen reader user follows a link from Movies to My Lists
- **THEN** "My Lists · CINE DB" is announced

#### Scenario: Slow detail page
- **WHEN** a screen reader user opens a movie whose details take 3 seconds to load
- **THEN** "<movie title> · CINE DB" is announced once they load, and "Movie · CINE DB" is not announced

#### Scenario: Slow page code
- **WHEN** a screen reader user navigates from the Watchlist to a page whose code is still downloading
- **THEN** nothing is announced until that page shows, and "Watchlist · CINE DB" is not announced

#### Scenario: Detail page fails to load
- **WHEN** a screen reader user opens a movie whose details fail to load
- **THEN** "Movie · CINE DB" is announced

#### Scenario: First load
- **WHEN** a user opens the app at any address, in development or production
- **THEN** no navigation is announced

#### Scenario: Restored scroll kept
- **WHEN** a user goes Back to a browse page whose scroll position is restored
- **THEN** the announcement doesn't move focus or scroll
