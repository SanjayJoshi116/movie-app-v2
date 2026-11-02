## ADDED Requirements

### Requirement: An entry without genres doesn't break a detail page
A Movie or TV detail page SHALL render when an entry of its recommendations or similar titles has no genre list (or is not an object at all), and when the title's own genre list is missing. An entry without genres SHALL count as sharing none of the title's genres, a non-object entry SHALL be left out, and a title without genres SHALL show its recommendations and similar titles unfiltered.

#### Scenario: Similar title without genre ids
- **WHEN** a movie's details load and one similar title has no `genre_ids`
- **THEN** the page renders with all its sections, and the Similar section shows the titles that pass the genre filter

#### Scenario: Title without a genre list
- **WHEN** a TV show's details load with no `genres`
- **THEN** the page renders, and Recommendations and Similar show their titles unfiltered
