## MODIFIED Requirements

### Requirement: Every rating change reaches a connected TMDB account
When the user has a connected TMDB account, the system SHALL send the rating
to TMDB whenever a rating is created, its score is changed by an edit, or it
is deleted. A TMDB sync failure SHALL NOT fail or roll back the local change.
The sync SHALL happen after the local change is saved. The rating request SHALL
respond within a fixed time budget shorter than the server's request timeout,
however slow TMDB is; a sync that doesn't finish in time counts as a failed
sync. Changes made one after another SHALL reach TMDB in that order, so TMDB
ends with the user's latest rating for each title.

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
