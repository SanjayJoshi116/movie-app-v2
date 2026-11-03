## Purpose

Lets a signed-in user rate the watched titles they never rated, one after another with a single tap each, so recommendations and Stats have more ratings to work from.

## ADDED Requirements

### Requirement: The queue holds watched titles without a rating
The rate page SHALL offer every title in the user's watched history that has no rating, movies and TV together, most recently watched first. A title the user has rated SHALL NOT appear, whether it was rated on this page, elsewhere in the app, or before. A title with no stored name SHALL be shown as "Untitled (#id)".

#### Scenario: Mixed history
- **WHEN** the user has watched five titles and rated two of them
- **THEN** the page offers the other three, the most recently watched first

#### Scenario: Rated elsewhere meanwhile
- **WHEN** a title in the queue gets a rating from another page or tab and the ratings reload
- **THEN** it leaves the queue

#### Scenario: Nothing to rate
- **WHEN** every watched title has a rating, or the history is empty
- **THEN** the page shows an "All caught up" state with a link back to Watched, and no rating buttons

### Requirement: One tap rates and moves on
The page SHALL show one title at a time (poster or placeholder, title, release year when known, the day it was watched) with ten buttons scored 1 to 10, each named with its score and the title. Choosing a score SHALL save that rating for the title, with no review, and show the next title at once without waiting for the save. A progress line SHALL show how many titles were rated on this visit and how many are left.

#### Scenario: Rate one
- **WHEN** the user taps 8 on "Dune"
- **THEN** a rating of 8 for Dune is saved, the next title is shown, and the progress line counts one more rated and one fewer left

#### Scenario: Last title
- **WHEN** the user rates the only title left
- **THEN** the "All caught up" state is shown

### Requirement: A failed save puts the title back
A save that fails SHALL show the error through the app's usual error message and return the title to the front of the queue, unrated. The page SHALL NOT report a title as rated until its save succeeded.

#### Scenario: Server error
- **WHEN** saving the rating for "Dune" fails
- **THEN** an error message is shown, "Dune" is the current title again, and it is not counted as rated

### Requirement: Skip and undo
Skip SHALL move the current title to the end of the queue for this visit without storing anything; leaving and reopening the page restores the normal order. Undo SHALL remove the most recent rating saved on this page and make that title the current one again; undo is offered only while such a rating exists, and steps back one rating at a time.

#### Scenario: Skip
- **WHEN** the user skips "Dune" with three titles in the queue
- **THEN** the next title is shown, and "Dune" comes up again after the other two

#### Scenario: Undo
- **WHEN** the user rates "Dune" 8, then chooses Undo
- **THEN** Dune's rating is removed and "Dune" is the current title again

#### Scenario: Undo before anything was rated
- **WHEN** no rating has been saved on this visit
- **THEN** no Undo control is offered

### Requirement: The page works from the keyboard
Keys `1` to `9` and `0` (for 10) SHALL rate the current title, `S` SHALL skip and `U` SHALL undo, unless focus is in a text field. Every action SHALL also be a labelled button reachable with Tab. The page SHALL have its own tab title.

#### Scenario: Rate with a key
- **WHEN** the user presses `0` on the rate page
- **THEN** the current title is rated 10

### Requirement: The page waits for the data it is built on
The page SHALL show a loading state until both the watched history and the ratings have loaded, and an error with Retry if either failed to load, never an empty or "All caught up" queue built on missing data.

#### Scenario: Ratings failed to load
- **WHEN** the ratings could not be loaded
- **THEN** the page shows an error with Retry instead of a queue

### Requirement: Entry points show how many titles are unrated
The Watched page SHALL show "N watched titles aren't rated" with a link to the rate page whenever N is at least 1 and both the history and the ratings have loaded. The Recommendations page SHALL show a prompt to rate watched titles, with the same link, when at least 3 are unrated.

#### Scenario: Watched page
- **WHEN** the user has 11 watched titles without a rating
- **THEN** the Watched page shows "11 watched titles aren't rated" and a link to rate them

#### Scenario: All rated
- **WHEN** every watched title has a rating
- **THEN** neither page shows the prompt
