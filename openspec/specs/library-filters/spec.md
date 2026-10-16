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
items. A blank grid SHALL NOT be shown while matching items exist.

#### Scenario: Unmark the last item on the last page
- **WHEN** the user is on page 3 of Watched, which has one title, and unmarks it
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
The Watchlist SHALL show its titles a page at a time, with the page and page size in the address like Watched, so reload and Back keep them. Changing the search, sort or a filter SHALL return to the first page. When the current page has no items, because titles were removed or a filter narrowed the results, the page SHALL move to the last page that has items. That move SHALL wait until everything the active filters depend on has loaded (the watched history, when the Watched/Unwatched filter is on), and SHALL NOT happen while that data failed to load.

#### Scenario: Large watchlist
- **WHEN** a user with 300 titles in their watchlist opens it
- **THEN** one page of titles is shown with page controls, not all 300 cards

#### Scenario: Remove the last item on the last page
- **WHEN** the user is on the last Watchlist page, which has one title, and removes it
- **THEN** the previous page is shown with its titles

#### Scenario: Deep link with the watched filter on
- **WHEN** the user reloads `/watchlist?page=3` with the "Watched" filter on, enough watched titles for three pages, and the watchlist loads before the watched history
- **THEN** page 3 is shown once the watched history loads, and the address still says page 3
