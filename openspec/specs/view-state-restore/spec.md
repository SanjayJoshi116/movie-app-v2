# view-state-restore Specification

## Purpose

Defines how pages restore their own state when the user comes back to them,
whether through the in-app Back button, the browser's Back button, or by
switching tabs, so returning to a page puts the user where they left it.

## Requirements

### Requirement: Browser Back restores browse state
When the user leaves a Movies, TV or Anime browse page for a detail page and
returns with the browser's Back button or a swipe-back gesture, the browse page
SHALL restore the same category, Anime TV/Movies mode, number of loaded pages,
search term, selected genres and scroll position as the in-app Back button
does. A fresh visit through the navigation SHALL still start with defaults.

#### Scenario: Browser Back after scrolling
- **WHEN** the user picks "Top Rated" on Movies, loads 3 pages, scrolls down, opens a movie and presses the browser Back button
- **THEN** Movies shows "Top Rated" with 3 pages loaded at the same scroll position

#### Scenario: Fresh visit still resets
- **WHEN** the user later opens Movies from the sidebar
- **THEN** Movies shows its default category from the top

### Requirement: Search tabs keep separate scroll positions
Each Search tab (Movies, TV Shows, People) SHALL save and restore its own
scroll position. Leaving the Search page SHALL NOT overwrite an inactive tab's
saved position with the active tab's position.

#### Scenario: Tabs don't share scroll
- **WHEN** the user scrolls far down the Movies tab, switches to the People tab at the top, opens a person and returns
- **THEN** the People tab is shown at the top, and switching back to Movies restores the Movies tab's deeper position

### Requirement: Incomplete recommendations are not cached as final
A saved For You snapshot SHALL record whether any recommendation group was
still being computed. On the next visit, a snapshot that was incomplete SHALL
be shown while the page resumes fetching and polling, and polling SHALL
continue until the backend reports the groups ready.

#### Scenario: Leave mid-computation
- **WHEN** the user opens For You while personalized recommendations are still computing, leaves, and returns within 5 minutes
- **THEN** the page polls again and shows the personalized groups once they are ready

### Requirement: Paginated pages request each page once per load
Loading a paginated browse or search grid, or restoring one on return, SHALL
request each needed page exactly once, including in the development build
(which mounts components twice to test effect cleanup).

#### Scenario: Restore three pages in development
- **WHEN** the user returns to a browse page that had 3 pages loaded, running under `npm run dev`
- **THEN** pages 1, 2 and 3 are each requested once

#### Scenario: First load in development
- **WHEN** the user opens a browse page fresh under `npm run dev`
- **THEN** page 1 is requested once

### Requirement: A search is addressable by URL
The search results page's URL SHALL carry the search term and the active tab. Opening that URL (a reload, a shared link, or returning after login) SHALL show the same search with the same tab active. Starting a new search from the search box SHALL keep the current tab.

#### Scenario: Reload a search
- **WHEN** the user searches for "nolan", switches to the People tab and reloads the page
- **THEN** the page shows People results for "nolan"

#### Scenario: Return after login
- **WHEN** a signed-out user opens `/search?q=nolan&tab=people`, is sent to login and signs in
- **THEN** they land on People results for "nolan"

#### Scenario: New search keeps the tab
- **WHEN** the user is on the TV tab and searches for a new term
- **THEN** the TV tab shows results for the new term
