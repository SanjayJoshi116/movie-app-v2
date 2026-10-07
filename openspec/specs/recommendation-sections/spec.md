# recommendation-sections Specification

## Purpose

Defines the shape of the recommendation responses (For You, personalized,
followed people), so each section can be identified and rendered reliably and
the user never sees two sections that are the same section twice.

## Requirements

### Requirement: Section keys are unique within a response
Every section in a recommendation response SHALL have a key that no other
section in the same response has. Sections based on a title SHALL be keyed by
both media type and id. Sections based on a person SHALL be keyed by the
person's TMDB id.

#### Scenario: Movie and show share a TMDB id
- **WHEN** a user's "Because you watched" seeds include movie 1399 and TV show 1399
- **THEN** the two sections have different keys

#### Scenario: Two people with the same name
- **WHEN** a user follows two different people who have the same name
- **THEN** their followed-person sections have different keys

### Requirement: Personalized sections don't repeat a label
The personalized response SHALL NOT contain two sections with the same label.
Clusters that produce the same genre label SHALL be merged into one section,
without duplicate titles.

#### Scenario: Two clusters with the same top genres
- **WHEN** two taste clusters both resolve to "Your Taste: Drama & Crime"
- **THEN** the response has one "Your Taste: Drama & Crime" section, and no title appears in it twice
