# calendar-export Specification

## Purpose

Defines the release calendar's `.ics` download, so the file is a valid iCalendar document that calendar apps import without warnings, whatever characters the titles contain.

## Requirements

### Requirement: Exported calendar is valid iCalendar
The exported `.ics` file SHALL be valid per RFC 5545: every event SHALL carry a `DTSTAMP`. Text values SHALL escape backslashes, commas, semicolons and newlines. Content lines longer than 75 octets SHALL be folded.

#### Scenario: Title with special characters
- **WHEN** the calendar holds a title containing a comma, a semicolon and a line break
- **THEN** the exported event's summary carries the escaped title on a single logical line, and the file still parses as one event per release

#### Scenario: Every event is stamped
- **WHEN** the user exports a calendar with several releases
- **THEN** every event in the file has a `DTSTAMP`

#### Scenario: Long title
- **WHEN** a title makes its summary line longer than 75 octets
- **THEN** the line is folded with CRLF plus a space, and unfolds back to the full title
