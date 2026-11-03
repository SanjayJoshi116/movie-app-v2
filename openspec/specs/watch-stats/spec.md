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
Monthly activity SHALL list every month from the month of the user's first watch through the current month in the requesting device's time zone, in order, with a count of `0` for months with no watches. A user with no watches SHALL get an empty list. Watches dated before January 1900 (left by imports made before timestamps were bounded) SHALL be left out of monthly activity, so the list starts no earlier than January 1900; they still count everywhere else in Stats.

#### Scenario: A gap between watches
- **WHEN** a user watched titles in January and June of the current year, and it is now August
- **THEN** monthly activity lists January through August, with `0` for February to May and for July and August

#### Scenario: A legacy watch dated year 1
- **WHEN** a user has one watch dated 0001-01-01 and others from March of the current year, and it is now August
- **THEN** monthly activity lists March through August only, and the total watched count still includes the year-1 watch

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

### Requirement: Hot takes compare the user's ratings with TMDB's
The Stats page SHALL show a Hot takes section built only from titles the user has both watched and rated whose stored TMDB score is above 0 and at most 10. For each such title the gap SHALL be the user's rating minus the TMDB score. Titles that are rated but not watched, or whose TMDB score is unknown, SHALL NOT count.

#### Scenario: Unknown TMDB score
- **WHEN** a watched and rated title has a TMDB score of 0
- **THEN** it is left out of every Hot takes figure and list

#### Scenario: Rated but not watched
- **WHEN** a title has a rating but no watched entry
- **THEN** it is left out of Hot takes

### Requirement: Hot takes need five qualifying titles
Hot takes SHALL be shown only when at least 5 titles qualify. With fewer, the section SHALL say how many more rated titles it needs, and link to the page for rating watched titles only while some watched title has no rating (otherwise that page would be empty).

#### Scenario: Too few titles
- **WHEN** 3 titles qualify and some watched titles have no rating
- **THEN** the section says it needs 2 more rated titles, links to the rate page, and shows no figures or lists

#### Scenario: Everything already rated
- **WHEN** 3 titles qualify and every watched title is rated (the others have no TMDB score)
- **THEN** the section says it needs 2 more rated titles with a TMDB score and offers no link to the rate page

### Requirement: Rating habit and contrarian score
With enough titles, Hot takes SHALL show the average gap, rounded half up to one decimal, as "You rate X above TMDB on average" when it is more than 0.2, "below" when it is less than −0.2, and "in line with TMDB" otherwise. It SHALL also show a contrarian score: the average absolute gap, rounded half up to one decimal, with a short explanation.

#### Scenario: Generous rater
- **WHEN** the gaps of the qualifying titles are +2, +1, +1.5, 0 and +2.5
- **THEN** the section says "You rate 1.4 above TMDB on average" and shows a contrarian score of 1.4

#### Scenario: In line
- **WHEN** the average gap is 0.1
- **THEN** the section says the user rates in line with TMDB

### Requirement: Guilty pleasures and not-for-you lists
Hot takes SHALL list up to 5 "guilty pleasures", the qualifying titles with the largest positive gaps of at least 1.5, and up to 5 "not for you" titles, those with the largest negative gaps of at least 1.5 in size, where a title's gap is the one shown: the user's rating minus the TMDB score at one decimal. Each entry SHALL show the title, the user's rating and the TMDB score (one decimal), and link to the title's page. Ties SHALL be ordered by title. A list with no entries SHALL say there are none rather than disappear. A blank stored title SHALL be shown as "Untitled (#id)".

#### Scenario: Guilty pleasure
- **WHEN** the user rated a title 9 and its TMDB score is 5.2
- **THEN** it appears under guilty pleasures as "You 9 · TMDB 5.2", linking to its page

#### Scenario: Small gaps only
- **WHEN** no qualifying title is 1.5 or more below TMDB
- **THEN** the not-for-you list says there are none
