# view-state-restore Specification

## Purpose

Defines how pages restore their own state when the user comes back to them,
whether through the in-app Back button, the browser's Back button, or by
switching tabs, so returning to a page puts the user where they left it.

## Requirements

### Requirement: Browser Back restores browse state
When the user leaves a Movies, TV, Anime or People browse page for a detail or person page and
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

#### Scenario: Browser Back to People
- **WHEN** the user loads 4 pages of People, scrolls down, opens a person and presses the browser Back button
- **THEN** People shows the same 4 pages at the same scroll position

### Requirement: Search tabs keep separate scroll positions
Each Search tab (Movies, TV Shows, People) SHALL save and restore its own
scroll position. Leaving the Search page SHALL NOT overwrite an inactive tab's
saved position with the active tab's position.

#### Scenario: Tabs don't share scroll
- **WHEN** the user scrolls far down the Movies tab, switches to the People tab at the top, opens a person and returns
- **THEN** the People tab is shown at the top, and switching back to Movies restores the Movies tab's deeper position

### Requirement: Incomplete recommendations are not cached as final
A saved For You snapshot SHALL record whether any recommendation group was
still being computed. A snapshot SHALL count as complete only when every group
answered as ready during that visit. A group whose polling stops before the
backend reports it ready, and a visit left before the first answers arrive,
SHALL leave the snapshot incomplete. On the next visit, a snapshot that was
incomplete SHALL be shown while the page resumes fetching and polling, and
polling SHALL continue until the backend reports the groups ready. When polling
stops before that, the page SHALL say the recommendations are still being
prepared and offer to try again.

#### Scenario: Leave mid-computation
- **WHEN** the user opens For You while personalized recommendations are still computing, leaves, and returns within 5 minutes
- **THEN** the page polls again and shows the personalized groups once they are ready

#### Scenario: Polling gives up
- **WHEN** a group is still computing after the page's last poll
- **THEN** the page says the recommendations are taking longer than usual and offers Retry, and on the next visit it fetches again instead of showing the saved groups as final

#### Scenario: Leave before the first answer
- **WHEN** the user returns to an incomplete snapshot and leaves before any group answers
- **THEN** the snapshot stays incomplete, and the next visit fetches again

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

### Requirement: Back from a detail page returns to where it was opened
A detail page opened from a recommendation card SHALL return, through its Back control, to the page the card was on. A card on the Following page SHALL return to Following, and a card on For You SHALL return to For You.

#### Scenario: Following to detail and back
- **WHEN** the user opens a title from "Recommended From People You Follow" on the Following page and activates the detail page's Back button
- **THEN** the Following page opens, not For You

### Requirement: Restored pages show each title once
When a paginated browse page restores several pages at once on return, a title that appears on more than one of those pages SHALL be shown once, as it is when the pages are loaded one at a time by scrolling.

#### Scenario: Title moved between pages
- **WHEN** a popular title moved from page 2 to page 3 between the original load and the restore
- **THEN** the restored grid shows that title once

### Requirement: Library scroll restores only on return
The Watchlist page SHALL restore its saved scroll position only when the user comes back to it from a detail page opened from it (in-app Back or browser Back). Any other visit SHALL start at the top, and a saved position SHALL NOT be applied to a later, unrelated visit.

#### Scenario: Later visit from the sidebar
- **WHEN** the user opens a title from the Watchlist, then goes to Movies, then opens Watchlist from the sidebar
- **THEN** Watchlist opens at the top

#### Scenario: Back from the detail page
- **WHEN** the user scrolls the Watchlist, opens a title and presses Back
- **THEN** Watchlist returns to the same scroll position

### Requirement: Recent searches are shared across search boxes
Every search box in a tab SHALL show the same recent searches. A search made in one search box SHALL appear in the recents of every other search box in the same tab, and adding one SHALL NOT drop a search another box added.

#### Scenario: Phone then desktop width
- **WHEN** the user searches "Dune" from the bottom navigation's search box, then widens the window and opens the sidebar's search box
- **THEN** "Dune" is in the sidebar's recent searches

### Requirement: Marking a recommendation watched keeps the page in place
Marking a title watched or unwatched from For You SHALL update that title's watched state without reloading or reordering the recommendation groups, and SHALL NOT request the recommendations again.

#### Scenario: Mark a card watched
- **WHEN** the user marks a For You card as watched
- **THEN** the card shows as watched, the groups stay in the same order, and no recommendation request is sent
