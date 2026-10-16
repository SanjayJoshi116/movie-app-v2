## MODIFIED Requirements

### Requirement: Each page has its own title, and navigation is announced
Every page SHALL set the document title to its name followed by "CINE DB" (for example "Watchlist · CINE DB"). Movie, TV and person pages SHALL use the title's or person's name once loaded. When such a page can't show its subject, its title SHALL name what the page shows instead: "Page Not Found" for an address whose id isn't valid, the page's not-found heading (for example "Movie not found") when the subject doesn't exist, and the page's error heading (for example "Failed to load movie details") when loading failed. After an in-app navigation, assistive technology SHALL be told the new page's title through a polite live announcement, without moving focus or changing the scroll position. The announcement SHALL be the title the new page settles on: never the previous page's title, and on a page that loads a name, the loaded name (or the not-found or error title once loading has settled without it), not the generic title shown while it loads. The first page load of the app SHALL NOT be announced.

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
- **THEN** the tab reads "Failed to load movie details · CINE DB", that title is announced, and "Movie · CINE DB" is not announced

#### Scenario: Subject doesn't exist
- **WHEN** a screen reader user opens a TV show id that TMDB answers with 404
- **THEN** the tab reads "TV show not found · CINE DB" and that title is announced

#### Scenario: Invalid id in the address
- **WHEN** a user opens `/person/abc`
- **THEN** the tab reads "Page Not Found · CINE DB", not "Person · CINE DB", and after an in-app navigation that title is announced

#### Scenario: First load
- **WHEN** a user opens the app at any address, in development or production
- **THEN** no navigation is announced

#### Scenario: Restored scroll kept
- **WHEN** a user goes Back to a browse page whose scroll position is restored
- **THEN** the announcement doesn't move focus or scroll
