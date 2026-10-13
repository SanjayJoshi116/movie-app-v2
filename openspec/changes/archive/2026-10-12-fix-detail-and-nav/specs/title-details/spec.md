## Purpose

Defines which facts a movie or TV detail page shows and how its "Where to Watch" section reports where a title can be streamed, rented or bought.

## ADDED Requirements

### Requirement: Numeric facts show only when known
A detail page SHALL show the runtime, number of seasons and number of episodes only when TMDB gives a positive number for them. A missing, zero or non-numeric value SHALL hide that fact, and SHALL NOT render as a bare `0` or any other placeholder digit.

#### Scenario: Unreleased film with runtime 0
- **WHEN** the user opens a movie whose TMDB runtime is `0`
- **THEN** no runtime is shown and no stray `0` appears in the facts row

#### Scenario: Show without an episode count
- **WHEN** the user opens a TV show whose number of episodes is `0` or missing
- **THEN** the episode count is hidden and the season count still shows if it is positive

### Requirement: Where to Watch lists every way to watch in the US
The "Where to Watch" section SHALL list the US streaming, rent and buy providers under separate headings. A heading SHALL appear only when it has at least one provider. When there is no US provider of any kind (including when the providers data is missing or malformed), the section SHALL say the title is not available to stream, rent or buy in the US, naming the region rather than saying "your region".

#### Scenario: Buy-only title
- **WHEN** a title's only US providers are under "buy"
- **THEN** the section shows a "Buy" heading with those providers and no empty "Streaming" or "Rent" heading

#### Scenario: No US providers
- **WHEN** TMDB has no US entry for a title
- **THEN** the section says it is not available to stream, rent or buy in the US
