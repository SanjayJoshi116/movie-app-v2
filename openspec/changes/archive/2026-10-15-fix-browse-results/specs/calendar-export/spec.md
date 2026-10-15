## ADDED Requirements

### Requirement: The export holds what the calendar shows
The iCal export SHALL contain exactly the releases the calendar currently shows: with a title filter typed, only the matching releases; with a media type picked, only that type. It SHALL NOT include releases hidden by the filter.

#### Scenario: Filtered calendar
- **WHEN** the user types "batman" in the calendar's title filter and exports
- **THEN** the file holds only the releases whose titles match "batman"

#### Scenario: Unfiltered calendar
- **WHEN** no title filter is set
- **THEN** the file holds every release the calendar shows
