## ADDED Requirements

### Requirement: Overlapping library reloads show the newest
When a reload of the watchlist, watched history, ratings, lists or followed people starts while an earlier one is still in flight, only the newest reload's result SHALL be shown, whichever finishes first. The collection SHALL read as loading until the newest reload has settled. A failed older reload SHALL NOT replace an error or content set by the newest one.

#### Scenario: Import finishes during the first load
- **WHEN** the watched history's first load is still in flight, an import adds 50 titles and reloads, that reload finishes first, and the first load then returns without the 50 titles
- **THEN** the 50 imported titles stay shown

#### Scenario: Loading lasts until the newest settles
- **WHEN** two reloads of the watchlist overlap and the older one finishes first
- **THEN** the watchlist still reads as loading until the newer one finishes

### Requirement: A repeated write click doesn't skip a queued clear
A repeated activation of an item write SHALL settle with the in-flight write's outcome only when no clear of that collection was started after that write. Otherwise the repeated activation SHALL be sent after the clear and report its own outcome, so what is shown matches the order in which the user acted.

#### Scenario: Add, Clear, Add again
- **WHEN** the user adds a title to a list, confirms Clear for that list before the add finishes, and activates the same add again while the clear is in flight
- **THEN** the second add is sent after the clear finishes, and the list ends up containing that title, on the server and on screen
