# ratings Specification

## Purpose

Defines how a user's rating writes are stored and mirrored to a connected TMDB
account, and what a rating's timestamp means, so ratings stay consistent
between the app and TMDB and reflect when the user last rated a title.

## Requirements

### Requirement: Every rating change reaches a connected TMDB account
When the user has a connected TMDB account, the system SHALL send the rating
to TMDB whenever a rating is created, its score is changed by an edit, or it
is deleted. A TMDB sync failure SHALL NOT fail or roll back the local change.

#### Scenario: Edit the score
- **WHEN** a user with a connected TMDB account edits an existing rating from 6 to 8
- **THEN** TMDB receives a rating of 8 for that title

#### Scenario: Edit only the review
- **WHEN** the user edits only the review text of a rating
- **THEN** no rating request is sent to TMDB

#### Scenario: TMDB unavailable
- **WHEN** the user edits a rating and the TMDB sync request fails
- **THEN** the edit is saved and the response is a success

### Requirement: A rating's timestamp reflects the latest change
A rating's `ratedAt` SHALL be the time its score or review was last set. Rating
a title again, or editing an existing rating's score or review, SHALL update
`ratedAt` to the current time. A bulk restore SHALL keep the timestamp
supplied in the backup.

#### Scenario: Re-rate a title
- **WHEN** a user rated a title in January and rates it again today
- **THEN** its `ratedAt` is today, and it sorts first in newest-first rating lists
