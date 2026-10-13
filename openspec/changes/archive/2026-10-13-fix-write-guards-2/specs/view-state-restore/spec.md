## MODIFIED Requirements

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
