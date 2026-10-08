## ADDED Requirements

### Requirement: Following and Calendar failures are not shown as empty
When the followed-people list or the release calendar fails to load, the page SHALL show an error state with a Retry action instead of its empty state. Retry SHALL request the data again. Person cards elsewhere in the app SHALL NOT present a failed followed-people load as "not following".

#### Scenario: Followed-people load fails
- **WHEN** the user opens the Following page and the followed-people request fails
- **THEN** an error with a Retry button is shown, not "You're not following anyone yet", and pressing Retry requests the list again

#### Scenario: Calendar load fails
- **WHEN** the release calendar's data request fails or is rate-limited
- **THEN** an error with a Retry button is shown instead of "no releases"

### Requirement: Secondary sections and status checks don't fake an answer
A secondary section whose data fails to load (the Following page's "recommended from people you follow") SHALL show a short error with Retry instead of disappearing. A status check that fails (whether a TMDB account is connected) SHALL show an unknown state instead of a definite answer.

#### Scenario: Followed-people recommendations fail
- **WHEN** the Following page lists people but its recommendations request fails
- **THEN** a short error line with Retry appears where the recommendations would be

#### Scenario: TMDB status check fails
- **WHEN** the profile dialog opens and the TMDB-connection check fails
- **THEN** the dialog doesn't offer "Connect TMDB" as if the account were not connected, and says the status couldn't be checked

### Requirement: A superseded response never replaces the current one
When the user changes what a view shows (a filter, a media type) while an earlier request is still in flight, the view SHALL show only the response for its current choice. A response for a choice the user has left SHALL be discarded.

#### Scenario: Calendar filter switched mid-load
- **WHEN** the user picks "All" on the Calendar and then "TV Shows" before the "All" response arrives
- **THEN** the page ends up showing TV shows only, even if the "All" response arrives last

#### Scenario: Anime hero switched mid-load
- **WHEN** the user toggles the Anime page between movies and TV before the earlier hero request finishes
- **THEN** the hero shows an item of the current media type, and opening it goes to that type's detail page

### Requirement: Infinite scroll ends at the source's last page
Infinite-scrolling browse pages SHALL stop requesting more pages at the last page the data source will serve, and SHALL end as a normal end of results, not an error.

#### Scenario: Very long browse scroll
- **WHEN** TMDB reports more than 500 pages for a browse category and the user scrolls to page 500
- **THEN** no request for page 501 is sent, and the list ends without an error
