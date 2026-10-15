# title-details Specification

## Purpose

Defines which facts a movie or TV detail page shows and how its "Where to Watch" section reports where a title can be streamed, rented or bought.

## Requirements

### Requirement: Numeric facts show only when known
A detail page SHALL show the runtime, number of seasons and number of episodes only when TMDB gives a positive number for them. A missing, zero or non-numeric value SHALL hide that fact, and SHALL NOT render as a bare `0` or any other placeholder digit.

#### Scenario: Unreleased film with runtime 0
- **WHEN** the user opens a movie whose TMDB runtime is `0`
- **THEN** no runtime is shown and no stray `0` appears in the facts row

#### Scenario: Show without an episode count
- **WHEN** the user opens a TV show whose number of episodes is `0` or missing
- **THEN** the episode count is hidden and the season count still shows if it is positive

### Requirement: Where to Watch lists every way to watch in the US
The "Where to Watch" section SHALL list the streaming, rent and buy providers of the region it shows (the user's region, or the US as a fallback) under separate headings. A heading SHALL appear only when it has at least one provider. When neither the user's region nor the US has a provider of any kind (including when the providers data is missing or malformed), the section SHALL say the title is not available to stream, rent or buy, naming the user's region rather than saying "your region".

#### Scenario: Buy-only title
- **WHEN** a title's only providers in the shown region are under "buy"
- **THEN** the section shows a "Buy" heading with those providers and no empty "Streaming" or "Rent" heading

#### Scenario: No providers anywhere
- **WHEN** TMDB has no entry for the user's region nor for the US
- **THEN** the section says it is not available to stream, rent or buy in the user's region

### Requirement: The user's region decides where-to-watch data
The app SHALL have a region preference: by default the region of the device's locale (US when it has none), changeable in Edit Profile, and kept on that device like the theme. Where to Watch and the certification on movie pages SHALL use that region's TMDB data. When TMDB has nothing for that region, they SHALL show the US data instead and name the US as its region; otherwise they SHALL name the user's region.

#### Scenario: Device in India
- **WHEN** a user whose browser locale is `en-IN` opens a movie with Indian streaming providers
- **THEN** Where to Watch lists the Indian providers and names India

#### Scenario: Changed in the profile
- **WHEN** the user picks Germany in Edit Profile
- **THEN** Where to Watch and the certification use German data from then on, on that device

#### Scenario: Nothing for the region
- **WHEN** TMDB has no providers for the user's region but has US providers
- **THEN** the US providers are shown under a label saying they are for the US
