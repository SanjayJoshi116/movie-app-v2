## ADDED Requirements

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
