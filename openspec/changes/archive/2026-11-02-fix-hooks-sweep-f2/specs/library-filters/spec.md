## ADDED Requirements

### Requirement: The type filter filters library grids
On the Watchlist, Watched and list detail pages, choosing "Movies" or "TV Shows" in the type filter SHALL show only titles of that type, together with the page's search, sort and other filters. "All" SHALL show both types. The choice SHALL be kept for the session like the page's other filters.

#### Scenario: TV Shows on the Watchlist
- **WHEN** the watchlist holds 3 movies and 2 TV shows and the user picks "TV Shows"
- **THEN** only the 2 TV shows are shown

#### Scenario: Movies on a list with a search
- **WHEN** a list holds "Dune" (movie), "Dune: Prophecy" (TV) and "Alien" (movie), the user searches "dune" and picks "Movies"
- **THEN** only "Dune" is shown

#### Scenario: Watched history kept after reload
- **WHEN** the user picks "Movies" on the Watched page and reloads the browser tab
- **THEN** the type filter still reads "Movies" and only movies are shown
