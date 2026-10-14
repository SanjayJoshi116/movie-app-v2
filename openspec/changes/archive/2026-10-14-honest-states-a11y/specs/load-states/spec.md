## MODIFIED Requirements

### Requirement: Recommendations failure retries in place
When the For You page fails to load recommendations and has nothing to show,
it SHALL show an error with a Retry control. When some recommendation groups
are shown and another group's request fails, the page SHALL keep the groups it
has and show an inline error with Retry above them. A failed group SHALL NOT
hide the loading or "still computing" state of the groups that are still being
prepared. Retry SHALL refetch the recommendations in place and show the loading
state while it does. It SHALL NOT reload the browser tab, so the rest of the
app's in-memory state (search term, filters, other pages' caches) survives.
When the watched history the page depends on failed to load, the page SHALL
show an error with Retry for it, not "No watched titles yet".

#### Scenario: Retry after a failed load
- **WHEN** the recommendations requests fail and the user presses Retry
- **THEN** the page shows its loading state, requests recommendations again without a full page reload, and shows them if the new requests succeed

#### Scenario: Retry fails again
- **WHEN** the user presses Retry and the requests fail again
- **THEN** the error with Retry is shown again

#### Scenario: One group fails after others loaded
- **WHEN** the "For You" groups have loaded and the followed-people recommendations request fails
- **THEN** the loaded groups stay visible and an inline error with Retry says some recommendations couldn't be loaded

#### Scenario: A group fails while another is still computing
- **WHEN** the followed-people request fails while the personalized groups are still being prepared and nothing is shown yet
- **THEN** the page still says recommendations are being prepared, and the failure is shown with Retry alongside it

#### Scenario: Watched history failed to load
- **WHEN** the user opens For You and the watched-history request failed
- **THEN** the page shows an error with Retry, not "No watched titles yet", and Retry requests the watched history again

### Requirement: Secondary sections and status checks don't fake an answer
A secondary section whose data fails to load (the Following page's "recommended from people you follow") SHALL show a short error with Retry instead of disappearing. A status check that fails (whether a TMDB account is connected) SHALL show an unknown state instead of a definite answer. Until a status check answers, the UI SHALL show it as loading and SHALL NOT offer an action that assumes one answer.

#### Scenario: Followed-people recommendations fail
- **WHEN** the Following page lists people but its recommendations request fails
- **THEN** a short error line with Retry appears where the recommendations would be

#### Scenario: TMDB status check fails
- **WHEN** the profile dialog opens and the TMDB-connection check fails
- **THEN** the dialog doesn't offer "Connect TMDB" as if the account were not connected, and says the status couldn't be checked

#### Scenario: TMDB status check still running
- **WHEN** the profile dialog opens and the TMDB-connection check hasn't answered
- **THEN** the TMDB section shows a loading state and offers neither "Connect TMDB Account" nor "Disconnect"

## ADDED Requirements

### Requirement: Person credits failures are not shown as no credits
When a person's details load but their movie or TV credit requests fail, the person page SHALL show an error with Retry in the credits area. It SHALL say the person has no credits only when the credit requests succeeded and returned none.

#### Scenario: Credit requests fail
- **WHEN** a person page loads the person but both credit requests fail
- **THEN** the credits area shows an error with Retry, not "No credits available", and Retry requests the credits again

#### Scenario: Person with no credits
- **WHEN** both credit requests succeed with empty lists and there are no photos
- **THEN** the page says no credits are available

### Requirement: A search with no matches says so
When a People search completes with no results, the People page SHALL show an empty state that names the search, not a blank grid.

#### Scenario: People search with no matches
- **WHEN** the user searches People for a name that matches nobody
- **THEN** the page says no people match that search

### Requirement: Background reloads keep the shown content
A page that already shows a loaded collection SHALL keep showing it while that collection reloads in the background. A full-page loading state SHALL be shown only while there is nothing loaded yet.

#### Scenario: Lists reload after a write
- **WHEN** the Lists page shows the user's lists and the lists reload in the background
- **THEN** the list cards stay visible during the reload
