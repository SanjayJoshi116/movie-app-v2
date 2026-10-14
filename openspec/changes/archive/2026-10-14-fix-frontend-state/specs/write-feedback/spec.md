## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: A library reload never undoes a newer write
A reload of the watchlist, watched history, ratings or lists that started before a write to the same collection finished SHALL NOT replace the collection with its result. The collection SHALL be loaded again instead, so what is shown matches the server after both. Removing or changing an item that was just added SHALL work straight away.

#### Scenario: Reload in flight while marking watched
- **WHEN** a watched-history reload is in flight, the user marks a title watched, the mark succeeds, and the reload then returns without that title
- **THEN** the title stays shown as watched, and unmarking it straight away removes it on the server

### Requirement: Clearing a collection is ordered with its item writes
Clearing the watched history, the watchlist or one list SHALL wait for that collection's item writes that are already in flight, and item writes started while a clear is in flight SHALL wait for the clear. The collection shown after both SHALL match the order in which the user acted.

#### Scenario: Clear All while an add is saving
- **WHEN** the user adds a title to the watchlist and, before that finishes, confirms Clear All
- **THEN** the clear is sent after the add finishes, and the watchlist ends up empty, on the server and on screen

#### Scenario: Add while a clear is running
- **WHEN** the user clears a list and, while the clear is in flight, adds a title to that list
- **THEN** the add is sent after the clear finishes, and the list ends up containing only that title
