# library-filters Specification

## Purpose

Defines how library list views (Watchlist, Watched, List detail and Home's
Recently Watched strip) filter, page and order the user's saved titles.

## Requirements

### Requirement: List detail filters are kept per list
Each list's detail page SHALL keep its own search, sort and type filter for
the session. Changing them on one list SHALL NOT change what another list
shows.

#### Scenario: Two lists
- **WHEN** the user searches "star" on list A and then opens list B
- **THEN** list B shows all its items with an empty search box, and returning to list A still shows the "star" search

### Requirement: Watched pagination stays on a non-empty page
When the current Watched page has no items, because titles were unmarked or a
filter narrowed the results, the page SHALL move to the last page that has
items. A blank grid SHALL NOT be shown while matching items exist. This SHALL also hold after a reload of the watched history failed while the previously loaded titles stayed on screen.

#### Scenario: Unmark the last item on the last page
- **WHEN** the user is on page 3 of Watched, which has one title, and unmarks it
- **THEN** page 2 is shown with its titles

#### Scenario: Unmark after a failed reload
- **WHEN** a reload of the watched history failed and the loaded titles are still shown, and the user unmarks the only title on page 3
- **THEN** page 2 is shown with its titles

### Requirement: Library search ignores surrounding whitespace
A library search SHALL match titles using the query with leading and trailing
whitespace removed.

#### Scenario: Trailing space
- **WHEN** the user types `matrix ` (with a trailing space) in the Watched search
- **THEN** "The Matrix" is listed

### Requirement: Newly watched titles appear first
A title marked as watched SHALL appear at the front of the watched list
straight away, matching the server's newest-first order. Home's Recently
Watched strip SHALL show it without a reload.

#### Scenario: Mark watched then open Home
- **WHEN** the user has 20 watched movies, marks another movie watched, and opens Movies
- **THEN** that movie is the first poster in Recently Watched

### Requirement: The Watchlist paginates
The Watchlist SHALL show its titles a page at a time, with the page and page size in the address like Watched, so reload and Back keep them. Changing the search, sort or a filter SHALL return to the first page. When the current page has no items, because titles were removed or a filter narrowed the results, the page SHALL move to the last page that has items. That move SHALL wait until everything the active filters depend on has loaded (the watched history, when the Watched/Unwatched filter is on), including any reload of that data in progress, and SHALL NOT happen while that data failed to load. A failed reload of the watchlist itself that kept the loaded titles on screen SHALL NOT stop the move.

#### Scenario: Large watchlist
- **WHEN** a user with 300 titles in their watchlist opens it
- **THEN** one page of titles is shown with page controls, not all 300 cards

#### Scenario: Remove the last item on the last page
- **WHEN** the user is on the last Watchlist page, which has one title, and removes it
- **THEN** the previous page is shown with its titles

#### Scenario: Deep link with the watched filter on
- **WHEN** the user reloads `/watchlist?page=3` with the "Watched" filter on, enough watched titles for three pages, and the watchlist loads before the watched history
- **THEN** page 3 is shown once the watched history loads, and the address still says page 3

#### Scenario: Watched history reloading
- **WHEN** the user is on `/watchlist?page=3` with the "Watched" filter on, and the watched history is reloading after an import that added watched titles
- **THEN** the page stays on page 3 until the reload finishes, and moves only if page 3 is still empty after it

#### Scenario: Remove after a failed watchlist reload
- **WHEN** a reload of the watchlist failed and the loaded titles are still shown, and the user removes the only title on the last page
- **THEN** the previous page is shown with its titles

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

### Requirement: Restored filter choices are validated
A library page that restores a filter choice saved earlier in the session (the type filter, the sort, the Watchlist's watched filter) SHALL use the saved value only when it's one of the choices the control offers, and SHALL otherwise use the default.

#### Scenario: Unknown saved watched filter
- **WHEN** the session holds an unknown value for the Watchlist's watched filter and the user opens the Watchlist
- **THEN** the filter reads "All" and every watchlist title is shown
