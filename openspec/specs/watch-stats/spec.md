# watch-stats Specification

## Purpose

Defines what the Stats endpoint computes from a user's watch history and ratings, and how the Stats page labels it, so the numbers and charts are accurate and readable.

## Requirements

### Requirement: Averages and rating buckets round half up
Every average the Stats endpoint returns (average user rating, average TMDB rating, average rating per genre) SHALL be rounded to one decimal place with halves rounded up. Each rating SHALL be counted in the whole-star bucket it rounds to with halves rounded up, so every bucket from 1 to 10 covers two half-star values (a 0.5 rating counts as 1).

#### Scenario: Half-star bucket
- **WHEN** a user's ratings are 6.5 and 7.5
- **THEN** the distribution counts one rating at 7 and one at 8

#### Scenario: Half-step average
- **WHEN** a user's ratings are 7.0 and 7.5
- **THEN** the average user rating is 7.3

### Requirement: Monthly activity has no gaps
Monthly activity SHALL list every month from the month of the user's first watch through the current month in the requesting device's time zone, in order, with a count of `0` for months with no watches. A user with no watches SHALL get an empty list.

#### Scenario: A gap between watches
- **WHEN** a user watched titles in January and June of the current year, and it is now August
- **THEN** monthly activity lists January through August, with `0` for February to May and for July and August

### Requirement: Unknown TMDB scores don't count toward the average
The average TMDB rating SHALL include only watched titles with a positive stored TMDB score. Titles stored with a score of `0` (an unreleased title or an import with no score) SHALL be left out. When no watched title has a score, the average SHALL be `null`.

#### Scenario: One unscored import
- **WHEN** a user's watched titles have TMDB scores 8.0, 7.0 and 0
- **THEN** the average TMDB rating is 7.5

### Requirement: Stats labels are readable
Chart tooltips on the Stats page SHALL label values in words ("Avg rating", "items"), never with an internal field name. Dates in the activity heatmap SHALL be shown as `dd-mm-yyyy`. The heatmap's explanation SHALL describe what it counts: titles marked watched per day. When watched titles have no genre data yet, the Top Genres card SHALL say genres are still being looked up, not ask the user to visit another page.

#### Scenario: Rating by Genre tooltip
- **WHEN** the user hovers a bar in Rating by Genre
- **THEN** the tooltip reads like "7.3 Avg rating"

#### Scenario: Heatmap date
- **WHEN** the user hovers or focuses the heatmap cell for 5 March 2026
- **THEN** it shows "05-03-2026" with that day's count

### Requirement: Genre charts combine movie and TV equivalents
Top Genres and Rating by Genre SHALL count a movie genre and its TV counterpart as one genre, named the way TMDB names the combined TV genre: Action and Adventure with Action & Adventure (shown as "Action & Adventure"), Science Fiction and Fantasy with Sci-Fi & Fantasy (shown as "Sci-Fi & Fantasy"), and War with War & Politics (shown as "War & Politics"). A title tagged with two genres of the same group SHALL count once for that group.

#### Scenario: Action movies and action TV
- **WHEN** a user watched two movies tagged Action and one TV show tagged Action & Adventure
- **THEN** Top Genres shows "Action & Adventure" with 3, and no separate "Action" entry

#### Scenario: Movie tagged Action and Adventure
- **WHEN** a user watched one movie tagged both Action and Adventure
- **THEN** "Action & Adventure" counts it once
