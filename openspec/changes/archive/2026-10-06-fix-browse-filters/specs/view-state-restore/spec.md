## Purpose

Defines how pages restore their own state when the user comes back to them,
whether through the in-app Back button, the browser's Back button, or by
switching tabs, so returning to a page puts the user where they left it.

## ADDED Requirements

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
