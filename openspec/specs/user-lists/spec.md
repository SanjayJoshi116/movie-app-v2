# user-lists Specification

## Purpose

Defines how a user's custom lists and their items are returned by the API, so
every client sees list contents in the same, predictable order.

## Requirements

### Requirement: List items have a fixed order
Each list's items SHALL be returned newest-added first. Items added at the
same instant SHALL be ordered by descending id. The order SHALL be the same on
every request.

#### Scenario: Items added at different times
- **WHEN** a list has items added on Monday, Tuesday and Wednesday
- **THEN** the API returns them Wednesday, Tuesday, Monday

#### Scenario: Items with the same timestamp
- **WHEN** two items share the same added time
- **THEN** the one with the higher id comes first, on every request
