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
The rating dialog SHALL stay open and show a saving state while a rating save is in flight. It SHALL close only after the save succeeds. When the save fails, the dialog SHALL stay open with the selected stars and review text intact. While a save or removal is in flight, the dialog SHALL NOT close from Cancel, its close button, the Escape key or a click outside it.

#### Scenario: Save succeeds
- **WHEN** the user saves a rating and the request succeeds
- **THEN** the dialog closes and the new rating is shown

#### Scenario: Save fails
- **WHEN** the user saves a rating with a review and the request fails
- **THEN** an error message is shown, and the dialog stays open with the same stars and review text

#### Scenario: Close attempted while saving
- **WHEN** the user presses Escape or clicks outside the dialog while a rating save is in flight
- **THEN** the dialog stays open until the save finishes and shows its result

### Requirement: Users can remove a rating
For a title the user has already rated, the rating dialog SHALL offer an action to remove the rating. Removing it SHALL delete the rating and close the dialog on success. On failure it SHALL show an error and keep the dialog open.

#### Scenario: Remove an existing rating
- **WHEN** the user opens the rating dialog for a rated title and chooses to remove the rating
- **THEN** the rating is deleted and the title shows as unrated

#### Scenario: Unrated title
- **WHEN** the user opens the rating dialog for a title with no rating
- **THEN** no remove action is offered

### Requirement: At most one in-flight write per item
While a write for a given item (identified by media id and type, person id, list and media item, or show for episode progress) is in flight, more requests for that item from repeated activation SHALL NOT be sent. The repeated activation SHALL settle with the outcome of the in-flight write. A different action on the same item SHALL NOT settle with the in-flight write's outcome: it SHALL wait until that write has finished, then be sent, and report its own outcome. This SHALL hold for every library collection (watchlist, watched history, ratings, lists) as well as follows and episode progress.

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

#### Scenario: Remove while Next Episode is saving
- **WHEN** a user clicks "Next Episode →" for a show and, before it finishes, confirms removing that show's episode progress
- **THEN** the remove is sent after the advance finishes, the show ends with no stored progress, and "Episode progress removed." appears only after the remove succeeded

#### Scenario: Double-click on Save rating
- **WHEN** the user saves a rating twice before the first save completes
- **THEN** exactly one rating request is sent

#### Scenario: Unmark while Mark watched is saving
- **WHEN** the user marks a title watched and, before that finishes, unmarks it
- **THEN** the unmark is sent after the mark finishes, and the title ends up not watched

### Requirement: Follow state is consistent across views
Whether a person is followed SHALL be shared state for the session. Every view showing that person SHALL reflect a follow or unfollow made from any other view, without a reload. Showing a grid of people SHALL NOT make a separate followed-people request per card. While the followed-people list is loading or has failed to load, every Follow control, on person cards and on the person page alike, SHALL be disabled rather than claim the person is not followed. The Following page's recommendations SHALL be refetched whenever the set of followed people changes, including when one follow and one unfollow leave the count unchanged.

#### Scenario: Unfollow from a card on the Following page
- **WHEN** the user unfollows a person from their card on the Following page
- **THEN** that person is removed from the Following page's list

#### Scenario: Grid of people
- **WHEN** the People page renders a page of person cards
- **THEN** the followed-people list is fetched at most once for the whole grid

#### Scenario: Person page after a failed load
- **WHEN** the followed-people list failed to load and the user opens a person page
- **THEN** that page's Follow button is disabled

#### Scenario: Swap one followed person for another
- **WHEN** the user follows one person and unfollows another, then opens Following
- **THEN** the recommendations from followed people are fetched again for the new set

#### Scenario: Grid shown before follows have loaded
- **WHEN** the People page shows a person the user already follows while the followed-people list is still loading
- **THEN** that card's follow control is disabled and doesn't read "Follow", and once the list arrives it reads "Unfollow"

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
Every error message shown for a failed request SHALL be a readable sentence. When the server's response carries no usable message (for example an HTML error page from a proxy or a crashed worker), the message SHALL be the action's own failure message. When the server can't be reached or the request times out, the message SHALL say the server can't be reached. This SHALL hold on every page, including the register, forgot-password and reset-password pages, and a message SHALL NOT tell the user to check the backend or show a raw value such as `[object Object]`.

#### Scenario: Proxy returns an HTML 502 page
- **WHEN** saving a rating gets a `502` whose body is an HTML page
- **THEN** the error says "Failed to save rating.", not a single character such as `<`

#### Scenario: Network failure
- **WHEN** a write fails because the server is unreachable or the request times out
- **THEN** the error says "Can't reach the server. Check your connection and try again."

#### Scenario: Reset password while the server is unreachable
- **WHEN** the user submits a new password from a reset link and the request gets no response, or a `502` HTML page
- **THEN** the message says the server can't be reached (no response) or that the reset failed (`502`), not "Invalid or expired reset link."

#### Scenario: Forgot password while the server is unreachable
- **WHEN** the user requests a reset link and the server can't be reached
- **THEN** the message is "Can't reach the server. Check your connection and try again.", with no mention of the backend

#### Scenario: Register with a nested error body
- **WHEN** registration fails with a field error whose value isn't a plain string or list of strings
- **THEN** the message is a readable sentence (the field's message or "Registration failed."), never `[object Object]`

### Requirement: Confirmation buttons are never covered
When an icon action asks for confirmation, its confirm button SHALL be clickable and tappable as soon as the confirmation opens. The action's tooltip SHALL NOT be shown while the confirmation is open.

#### Scenario: Unmark from the Watched page
- **WHEN** the user clicks or taps "Mark as unwatched" on a Watched card and then the confirmation's "Mark Unwatched" button
- **THEN** the title is unmarked, without having to move the pointer away first

### Requirement: Created items appear where the server orders them
After creating a list or following a person, the new list or person SHALL be shown in the same position it will have after a reload. Lists and followed people are ordered newest first.

#### Scenario: New list
- **WHEN** a user with three lists creates a fourth
- **THEN** the new list is shown first on the Lists page, as it is after a reload

#### Scenario: New follow
- **WHEN** a user who follows two people follows a third
- **THEN** the new person is shown first on the Following page

### Requirement: A library reload never undoes a newer write
A reload of the watchlist, watched history, ratings, lists or followed people that started before a write to the same collection finished SHALL NOT replace the collection with its result. The collection SHALL be loaded again instead, so what is shown matches the server after both. Removing or changing an item that was just added SHALL work straight away.

#### Scenario: Reload in flight while marking watched
- **WHEN** a watched-history reload is in flight, the user marks a title watched, the mark succeeds, and the reload then returns without that title
- **THEN** the title stays shown as watched, and unmarking it straight away removes it on the server

#### Scenario: Followed-people reload in flight while following
- **WHEN** a followed-people reload is in flight (after a restore, or Retry), the user follows a person, the follow succeeds, and the reload then returns without that person
- **THEN** the person stays shown as followed

### Requirement: Clearing a collection is ordered with its item writes
Clearing the watched history, the watchlist or one list SHALL wait for that collection's item writes that are already in flight, and item writes started while a clear is in flight SHALL wait for the clear. The collection shown after both SHALL match the order in which the user acted.

#### Scenario: Clear All while an add is saving
- **WHEN** the user adds a title to the watchlist and, before that finishes, confirms Clear All
- **THEN** the clear is sent after the add finishes, and the watchlist ends up empty, on the server and on screen

#### Scenario: Add while a clear is running
- **WHEN** the user clears a list and, while the clear is in flight, adds a title to that list
- **THEN** the add is sent after the clear finishes, and the list ends up containing only that title

### Requirement: Edit Profile holds while a change is being saved
While the Edit Profile dialog is saving a profile change, uploading or removing a photo, or deleting the account, it SHALL NOT close: no close button, no closing by clicking outside it, and no closing with Escape. It SHALL become closable again once the operation succeeds or fails.

#### Scenario: Closing during a password change
- **WHEN** the user saves a new password and tries to close the dialog before the server answers
- **THEN** the dialog stays open until the save finishes
