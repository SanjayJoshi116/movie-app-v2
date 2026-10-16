## MODIFIED Requirements

### Requirement: Detail pages degrade per section
Movie and TV detail pages SHALL treat only the title's main details as essential. When the data for a secondary section is missing, empty or malformed (reviews, similar titles, watch providers, release dates or content ratings, credits, images, videos, recommendations), whether it failed separately or is absent from a combined response, only that section SHALL render empty or hidden, and the rest of the page SHALL render normally. This SHALL hold at every level of a section's data, including a single malformed entry inside an otherwise valid list (one country's release dates). When the main details request returns 404, the page SHALL show a "not found" state. Any other failure of the main request SHALL show an error with a Retry control that refetches without reloading the browser page.

#### Scenario: Reviews data missing
- **WHEN** the movie details load but the reviews part is absent or malformed in the response
- **THEN** the page renders the movie with its other sections, and the reviews section is empty

#### Scenario: One country's release dates malformed
- **WHEN** the movie details load and one country entry in the release dates part has no release-date list
- **THEN** the page renders normally, and the certification comes from the remaining entries (or shows that the title isn't rated)

#### Scenario: Unknown title id
- **WHEN** the user opens a movie or TV id that TMDB reports as not found
- **THEN** the page shows a "not found" state, not the generic error

#### Scenario: Main request fails transiently
- **WHEN** the main details request fails with a network error or 5xx and the user activates Retry
- **THEN** the details are fetched again without a full browser reload
