## ADDED Requirements

### Requirement: Section labels never show raw genre ids
Genre-labelled sections SHALL name their genres. When TMDB's genre list can't be used (the call fails, or the answer is malformed: not a JSON object, a missing or `null` list, entries without an id or a name), the built-in genre names SHALL be used instead, and the refresh SHALL NOT fail because of it.

#### Scenario: Null genre list
- **WHEN** TMDB answers the movie genre list with `{"genres": null}` during a refresh
- **THEN** the taste sections are labelled with genre names such as "Your Taste: Drama & Romance", not ids, and the refresh completes

#### Scenario: Non-object body
- **WHEN** TMDB answers a genre list with a JSON array
- **THEN** the built-in names are used and the refresh completes
