## MODIFIED Requirements

### Requirement: Monthly activity has no gaps
Monthly activity SHALL list every month from the month of the user's first watch through the current month in the requesting device's time zone, in order, with a count of `0` for months with no watches. A user with no watches SHALL get an empty list. Watches dated before January 1900 (left by imports made before timestamps were bounded) SHALL be left out of monthly activity, so the list starts no earlier than January 1900; they still count everywhere else in Stats.

#### Scenario: A gap between watches
- **WHEN** a user watched titles in January and June of the current year, and it is now August
- **THEN** monthly activity lists January through August, with `0` for February to May and for July and August

#### Scenario: A legacy watch dated year 1
- **WHEN** a user has one watch dated 0001-01-01 and others from March of the current year, and it is now August
- **THEN** monthly activity lists March through August only, and the total watched count still includes the year-1 watch
