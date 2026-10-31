## MODIFIED Requirements

### Requirement: Every rating change reaches a connected TMDB account
When the user has a connected TMDB account, the system SHALL send the rating
to TMDB whenever a rating is created, its score is changed by an edit, or it
is deleted. A TMDB sync failure SHALL NOT fail or roll back the local change.
The sync SHALL happen after the local change is saved. The rating request SHALL
respond within a fixed time budget shorter than the server's request timeout,
however slow TMDB is; a sync that doesn't finish in time counts as a failed
sync. Changes made one after another SHALL reach TMDB in that order, so TMDB
ends with the user's latest rating for each title. Writes to the same title's
rating that arrive at the same time SHALL be applied one after another, each
deciding whether the score changed against the score the previous one stored,
so TMDB ends with the score the app stores.

#### Scenario: Edit the score
- **WHEN** a user with a connected TMDB account edits an existing rating from 6 to 8
- **THEN** TMDB receives a rating of 8 for that title

#### Scenario: Edit only the review
- **WHEN** the user edits only the review text of a rating
- **THEN** no rating request is sent to TMDB

#### Scenario: TMDB unavailable
- **WHEN** the user edits a rating and the TMDB sync request fails
- **THEN** the edit is saved and the response is a success

#### Scenario: TMDB hangs
- **WHEN** a user rates a title while TMDB accepts connections but never answers
- **THEN** the rating is saved and the success response arrives within the budget, before the server's request timeout

#### Scenario: Rate then delete quickly
- **WHEN** a user rates a title 8 and deletes that rating a moment later
- **THEN** TMDB receives the rating and then the deletion, and ends with no rating for that title

#### Scenario: Two tabs rate at once
- **WHEN** a title is rated 7, and one tab rates it 8 while another rates it 7 at the same moment
- **THEN** TMDB ends with the same score the app stores for that title

## ADDED Requirements

### Requirement: Rating without a review keeps the stored review
Rating a title again without sending a review SHALL keep the review already stored for it. A new rating sent without a review SHALL start with an empty review.

#### Scenario: Re-rate without review field
- **WHEN** a rating with the review "Loved it" is re-rated to 9 by a request that has no review field
- **THEN** the rating is 9 and the review is still "Loved it"

### Requirement: Reviews are stored the same way on every write path
A review's surrounding whitespace SHALL be removed the same way whether it is written by a single rating write or by a bulk import, so saving a restored review unchanged is not a change.

#### Scenario: Restored review saved unchanged
- **WHEN** a backup restores the review "Great " and the user saves that review unchanged
- **THEN** the stored review is "Great" both times and the rating's timestamp doesn't move on the save
