## ADDED Requirements

### Requirement: Calendar and sort queries are checked against live data
When enabled, the live checks SHALL run the Release Calendar's query and each browse sort's query with the app's own parameters and fail when the results don't make sense: the calendar's movie results falling on only one day of its window, a rating-sorted result below the rating sort's vote floor, or a newest-first result dated after today. The vote floors and other sort parameters the checks restate SHALL be compared with the frontend source in every test run, and that comparison SHALL fail when they differ.

#### Scenario: Calendar collapses to one day
- **WHEN** the calendar's query returns movies dated only on the window's first day
- **THEN** the calendar live check fails, naming the dates it got

#### Scenario: Newest in the future
- **WHEN** the newest-first query returns a title dated after today
- **THEN** the sort live check fails, naming the title and its date

#### Scenario: Floor changed in the frontend only
- **WHEN** the frontend's rating-sort vote floor changes and the live check's copy doesn't
- **THEN** the drift check fails in a normal test run, without network
