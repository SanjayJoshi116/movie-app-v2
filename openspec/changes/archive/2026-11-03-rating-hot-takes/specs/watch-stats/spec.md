## ADDED Requirements

### Requirement: Hot takes compare the user's ratings with TMDB's
The Stats page SHALL show a Hot takes section built only from titles the user has both watched and rated whose stored TMDB score is above 0 and at most 10. For each such title the gap SHALL be the user's rating minus the TMDB score. Titles that are rated but not watched, or whose TMDB score is unknown, SHALL NOT count.

#### Scenario: Unknown TMDB score
- **WHEN** a watched and rated title has a TMDB score of 0
- **THEN** it is left out of every Hot takes figure and list

#### Scenario: Rated but not watched
- **WHEN** a title has a rating but no watched entry
- **THEN** it is left out of Hot takes

### Requirement: Hot takes need five qualifying titles
Hot takes SHALL be shown only when at least 5 titles qualify. With fewer, the section SHALL say how many more rated titles it needs, and link to the page for rating watched titles.

#### Scenario: Too few titles
- **WHEN** 3 titles qualify
- **THEN** the section says it needs 2 more rated titles and shows no figures or lists

### Requirement: Rating habit and contrarian score
With enough titles, Hot takes SHALL show the average gap, rounded half up to one decimal, as "You rate X above TMDB on average" when it is more than 0.2, "below" when it is less than −0.2, and "in line with TMDB" otherwise. It SHALL also show a contrarian score: the average absolute gap, rounded half up to one decimal, with a short explanation.

#### Scenario: Generous rater
- **WHEN** the gaps of the qualifying titles are +2, +1, +1.5, 0 and +2.5
- **THEN** the section says "You rate 1.4 above TMDB on average" and shows a contrarian score of 1.4

#### Scenario: In line
- **WHEN** the average gap is 0.1
- **THEN** the section says the user rates in line with TMDB

### Requirement: Guilty pleasures and not-for-you lists
Hot takes SHALL list up to 5 "guilty pleasures", the qualifying titles with the largest positive gaps of at least 1.5, and up to 5 "not for you" titles, those with the largest negative gaps of at least 1.5 in size. Each entry SHALL show the title, the user's rating and the TMDB score (one decimal), and link to the title's page. Ties SHALL be ordered by title. A list with no entries SHALL say there are none rather than disappear. A blank stored title SHALL be shown as "Untitled (#id)".

#### Scenario: Guilty pleasure
- **WHEN** the user rated a title 9 and its TMDB score is 5.2
- **THEN** it appears under guilty pleasures as "You 9 · TMDB 5.2", linking to its page

#### Scenario: Small gaps only
- **WHEN** no qualifying title is 1.5 or more below TMDB
- **THEN** the not-for-you list says there are none
