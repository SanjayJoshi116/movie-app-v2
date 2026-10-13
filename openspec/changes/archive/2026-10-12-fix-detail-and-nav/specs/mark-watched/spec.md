## Purpose

Defines what the Mark as Watched dialog prefills, what the user can edit before confirming, and how it behaves when part of its TMDB data is missing.

## ADDED Requirements

### Requirement: Watch runtime is prefilled and editable
The Mark as Watched dialog SHALL let the user edit the runtime in minutes for movies and TV shows, and SHALL accept only whole non-negative numbers or an empty value. For a movie it SHALL be prefilled with the movie's runtime. For a TV show it SHALL be prefilled with the number of episodes times the episode runtime when TMDB provides both as positive numbers, using the latest aired episode's runtime when the show lists no episode runtime. Otherwise the field SHALL be empty. The value the user confirms SHALL be the value recorded.

#### Scenario: Whole series prefill
- **WHEN** the user marks a TV show watched whose TMDB data has 62 episodes and a 47-minute episode runtime
- **THEN** the runtime field shows 2914 and the user can change it before confirming

#### Scenario: Show without episode runtime
- **WHEN** TMDB lists no episode runtime and no latest-episode runtime for a show
- **THEN** the runtime field is empty and editable, and confirming without a value records no runtime

#### Scenario: User correction is kept
- **WHEN** the user changes a prefilled movie runtime from 139 to 150 and confirms
- **THEN** the watch is recorded with 150 minutes

### Requirement: Missing provider data keeps the runtime
When the title's details load but its provider data is missing or malformed, the dialog SHALL still prefill the runtime and SHALL offer only the "Other" platform choice. When the details themselves fail to load, the dialog SHALL stay usable with an empty runtime and the "Other" platform choice.

#### Scenario: Provider part malformed
- **WHEN** the details response has a runtime but no usable watch-provider data
- **THEN** the runtime is prefilled and the platform list contains only "Other"
