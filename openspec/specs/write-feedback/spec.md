# write-feedback Specification

## Purpose

Makes every user-initiated write report its real outcome, keep the user's input when it fails, and send at most one request per item at a time, so users can trust that what the UI says happened actually happened.

## Requirements

### Requirement: Success is reported only after the server confirms
A write the user starts (mark watched/unwatched, add/remove watchlist, add/remove list item, clear watchlist/list, delete list, follow/unfollow, episode progress updates, rating save/remove) SHALL show its success feedback only after the server confirms the write. When the write fails, the UI SHALL show an error message and SHALL NOT show success feedback.

#### Scenario: Mark as watched fails
- **WHEN** the user marks a watchlist item as watched and the request fails
- **THEN** an error message is shown, no "Marked as watched" success message is shown, and the item stays not watched

#### Scenario: Clear watchlist fails
- **WHEN** the user confirms clearing the watchlist and the request fails
- **THEN** an error message is shown and the watchlist items stay

#### Scenario: Follow fails
- **WHEN** the user clicks Follow on a person and the request fails
- **THEN** an error message is shown and the control still shows "Follow"

#### Scenario: Episode progress save fails
- **WHEN** the user saves an episode-progress edit and the request fails
- **THEN** an error message is shown and the editor stays open with the entered values

### Requirement: Rating edits are kept until saved
The rating dialog SHALL stay open and show a saving state while a rating save is in flight. It SHALL close only after the save succeeds. When the save fails, the dialog SHALL stay open with the selected stars and review text intact.

#### Scenario: Save succeeds
- **WHEN** the user saves a rating and the request succeeds
- **THEN** the dialog closes and the new rating is shown

#### Scenario: Save fails
- **WHEN** the user saves a rating with a review and the request fails
- **THEN** an error message is shown, and the dialog stays open with the same stars and review text

### Requirement: Users can remove a rating
For a title the user has already rated, the rating dialog SHALL offer an action to remove the rating. Removing it SHALL delete the rating and close the dialog on success. On failure it SHALL show an error and keep the dialog open.

#### Scenario: Remove an existing rating
- **WHEN** the user opens the rating dialog for a rated title and chooses to remove the rating
- **THEN** the rating is deleted and the title shows as unrated

#### Scenario: Unrated title
- **WHEN** the user opens the rating dialog for a title with no rating
- **THEN** no remove action is offered

### Requirement: At most one in-flight write per item
While a write for a given item (identified by media id and type, person id, or list and media item) is in flight, more requests for that item from repeated activation SHALL NOT be sent. The repeated activation SHALL settle with the outcome of the in-flight write.

#### Scenario: Double-click on watchlist toggle
- **WHEN** the user clicks a title's watchlist toggle twice before the first request completes
- **THEN** exactly one request is sent to the server

#### Scenario: Double-click on follow
- **WHEN** the user clicks Follow twice in quick succession
- **THEN** exactly one follow request is sent

#### Scenario: Different items are independent
- **WHEN** a watched toggle for one title is in flight and the user toggles watched on a different title
- **THEN** the second title's request is sent

#### Scenario: Repeated feedback isn't stacked
- **WHEN** a repeated activation settles with the same outcome as the in-flight write
- **THEN** the user sees a single success (or error) message, not two identical stacked messages

### Requirement: Follow state is consistent across views
Whether a person is followed SHALL be shared state for the session. Every view showing that person SHALL reflect a follow or unfollow made from any other view, without a reload. Showing a grid of people SHALL NOT make a separate followed-people request per card.

#### Scenario: Unfollow from a card on the Following page
- **WHEN** the user unfollows a person from their card on the Following page
- **THEN** that person is removed from the Following page's list

#### Scenario: Grid of people
- **WHEN** the People page renders a page of person cards
- **THEN** the followed-people list is fetched at most once for the whole grid

### Requirement: Forms submit once per activation
While a form's submit request is in flight (registration, creating a list, editing a list), the submit control SHALL show a busy state, and repeated activation (double-click, a second Enter) SHALL NOT send another request. This holds wherever a list can be created, including the Add to List dialog's inline create.

#### Scenario: Double-click Register
- **WHEN** the user double-clicks Register with valid details
- **THEN** one registration request is sent, and no "username already exists" error appears over the successful signup

#### Scenario: Double-click OK on New List
- **WHEN** the user double-clicks OK in the New List dialog
- **THEN** exactly one list is created

#### Scenario: Double-click Save on list edit
- **WHEN** the user double-clicks Save in the list edit dialog
- **THEN** one update request is sent and one success message is shown

### Requirement: Error messages are readable
Every error message shown for a failed request SHALL be a readable sentence. When the server's response carries no usable message (for example an HTML error page from a proxy or a crashed worker), the message SHALL be the action's own failure message. When the server can't be reached or the request times out, the message SHALL say the server can't be reached.

#### Scenario: Proxy returns an HTML 502 page
- **WHEN** saving a rating gets a `502` whose body is an HTML page
- **THEN** the error says "Failed to save rating.", not a single character such as `<`

#### Scenario: Network failure
- **WHEN** a write fails because the server is unreachable or the request times out
- **THEN** the error says "Can't reach the server. Check your connection and try again."
