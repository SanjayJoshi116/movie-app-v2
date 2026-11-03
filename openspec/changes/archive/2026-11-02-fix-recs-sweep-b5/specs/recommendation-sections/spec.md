## ADDED Requirements

### Requirement: A section reserves only the titles it shows
A title SHALL be withheld from later For You or personalized sections only when an earlier section of the same response shows it. Titles an earlier section scanned but cut off (each section shows at most 12) SHALL stay available to later sections. Within one section a title SHALL appear at most once.

#### Scenario: Loved genre and taste genre share a family
- **WHEN** a user's top loved genre is Drama and Drama is also one of their top genres, and TMDB returns 40 Drama titles the user hasn't seen
- **THEN** "More like what you love" shows 12 of them and "Based on your taste in Drama" shows up to 12 others, instead of being dropped

#### Scenario: Two taste clusters share a genre
- **WHEN** two personalized taste clusters both ask TMDB for Drama titles
- **THEN** the second cluster's section can show Drama titles the first cluster's section didn't show

### Requirement: A malformed TMDB list empties only its own section
When a TMDB answer used by a recommendation section has a missing or null result list, or entries that aren't objects with an integer id, the system SHALL ignore the unusable entries (or the whole list) for that section only. The rest of the compute SHALL continue and be saved.

#### Scenario: Trending answers a null list
- **WHEN** TMDB's trending answer has `"results": null` during a refresh
- **THEN** the refresh saves every other section, and only the trending section is missing

#### Scenario: A non-object entry in an actor's credits
- **WHEN** an actor's credits list contains a string among valid credits
- **THEN** the actor's section is built from the valid credits

### Requirement: "Because you watched" names a blank title
When the stored title of a "Because you watched" seed is blank, the section label SHALL name it "Untitled (#<id>)", the same label the library pages show for that title.

#### Scenario: Imported row without a title
- **WHEN** a watched movie with id 550 and a blank title seeds a section
- **THEN** the section's label is "Because you watched Untitled (#550)"
