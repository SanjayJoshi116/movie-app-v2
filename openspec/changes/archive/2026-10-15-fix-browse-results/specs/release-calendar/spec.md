## Purpose

Defines what the Release Calendar lists for its upcoming window, so it shows the notable releases of every day in the window rather than whichever titles TMDB dates earliest, and says what it is showing.

## ADDED Requirements

### Requirement: The calendar covers its whole window with the most popular releases
The Release Calendar SHALL list, for the next 7 days from the device's today, the most popular movie and TV releases TMDB dates in that window (by TMDB popularity, up to a fixed number per media type), grouped by release day. It SHALL NOT pick titles by earliest date, so a busy first day can't push the rest of the window out. The page SHALL say that it lists the most popular releases.

#### Scenario: Busy first day
- **WHEN** TMDB lists hundreds of movies dated today and more on each later day of the window
- **THEN** the calendar shows releases on the later days too, not only today's

#### Scenario: Shows what it is
- **WHEN** the user opens the calendar
- **THEN** the subtitle says it lists the most popular releases in the next 7 days

#### Scenario: Grouped by day
- **WHEN** the most popular releases fall on several days of the window
- **THEN** they appear under one heading per day, in date order
