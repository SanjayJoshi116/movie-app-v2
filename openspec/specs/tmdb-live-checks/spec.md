# tmdb-live-checks Specification

## Purpose

An opt-in check of the app's TMDB dependencies against the live TMDB API, so that a field, appended part or query the app relies on that stops matching real TMDB data is caught, which mocked tests cannot do.

## Requirements

### Requirement: Live checks run only when explicitly enabled
The live TMDB checks SHALL be part of the backend test suite and SHALL run only when an explicit opt-in flag is set and a non-empty TMDB API key is configured. Without both, every live check SHALL be reported as skipped with a reason naming what is missing, and SHALL make no network call. Having a TMDB key configured alone SHALL NOT enable them.

#### Scenario: Plain test run with a key in the local env file
- **WHEN** a developer runs the backend test suite with a TMDB key configured but without the opt-in flag
- **THEN** every live check is skipped, the reason says the opt-in flag is not set, and no request reaches TMDB

#### Scenario: Opt-in without a key
- **WHEN** the opt-in flag is set but no TMDB key is configured
- **THEN** every live check is skipped and the reason says the key is missing

#### Scenario: CI on push
- **WHEN** CI runs the backend test suite on a push or pull request
- **THEN** the live checks are skipped and the run's result doesn't depend on TMDB being reachable

#### Scenario: Selecting only the live checks
- **WHEN** a developer opts in and selects the live checks alone
- **THEN** only the live checks run, without the rest of the backend suite

### Requirement: Every TMDB-reading feature has a shape check
When enabled, the live checks SHALL confirm, against real TMDB responses, that every field and `append_to_response` part the app reads exists with the type the app expects (a value the app treats as optional may be null or missing). They SHALL cover the Movies, TV and Anime browse grids, Search, the Release Calendar, the hero banner, the movie and TV detail pages, the episode guide (specials included), Mark as Watched, the person page, and the backend's own TMDB use: recommendations, followed-people credits and notifications, Stats genre names, and watched-title metadata backfill.

#### Scenario: All shapes match
- **WHEN** the live checks run and TMDB returns the fields and parts the app reads
- **THEN** every shape check passes

#### Scenario: An appended part disappears
- **WHEN** TMDB stops returning the `watch/providers` part of a movie detail request
- **THEN** the movie detail check fails

#### Scenario: A field changes type
- **WHEN** a discover result's `vote_average` is not a number
- **THEN** the browse check fails

### Requirement: Checks use the app's real requests
Frontend-facing checks SHALL go through the app's own TMDB proxy with the same paths and parameters the frontend sends, and backend checks SHALL call the backend's own TMDB functions, so a check exercises what the app actually asks for. A frontend parameter the checks restate (such as an `append_to_response` list or the Anime keyword) SHALL be compared with the frontend source, and the checks SHALL fail when the two differ.

#### Scenario: Frontend adds an appended part
- **WHEN** the frontend's movie detail request gains a new `append_to_response` part that the live check's copy lacks
- **THEN** the drift check fails, naming the request, until the live check is updated (whether or not the live run is enabled)

#### Scenario: Backend check uses backend code
- **WHEN** the recommendations' title-details fetch is checked
- **THEN** the check calls the same backend function the recommendation refresh calls, not a hand-built request

### Requirement: Failures say what broke
A failing live check SHALL name the feature, the TMDB path and the missing or mistyped field or part. A live run SHALL NOT retry a failed request, so a TMDB outage fails the run rather than hiding.

#### Scenario: Missing field
- **WHEN** a person credit lacks `release_date` and `first_air_date` and `media_type` where the app expects them
- **THEN** the failure message names the person page check, the request path and the field

#### Scenario: TMDB unreachable during an opted-in run
- **WHEN** the live checks run and TMDB doesn't answer
- **THEN** the affected checks fail with the request that failed, without retries

### Requirement: Calendar and sort queries are checked against live data
When enabled, the live checks SHALL run the Release Calendar's query and each browse sort's query with the app's own parameters and fail when the results don't make sense: the calendar's movie results falling on only one day of its window, a rating-sorted result below the rating sort's vote floor, or a newest-first result dated after today. The vote floors and other sort parameters the checks restate SHALL be compared with the frontend source in every test run, and that comparison SHALL fail when they differ.

#### Scenario: Calendar collapses to one day
- **WHEN** the calendar's query returns movies dated only on the window's first day
- **THEN** the calendar live check fails, naming the dates it got

#### Scenario: Newest in the future
- **WHEN** the newest-first query returns a title dated after today
- **THEN** the sort live check fails, naming the title and its date

#### Scenario: Floor changed in the frontend only
- **WHEN** the frontend's rating-sort vote floor changes and the live check's copy doesn't
- **THEN** the drift check fails in a normal test run, without network

### Requirement: A crew-only person's work is checked against live data
When enabled, the live checks SHALL fetch a followed person's credits for a person known for crew work and fail unless the result includes crew credits and at least one title released in the last two years or dated ahead, and leaves out talk and news appearances.

#### Scenario: Director's credits
- **WHEN** the live checks fetch a director's credits through the followed-people credit fetch
- **THEN** the result includes titles they directed and a recent or upcoming title

#### Scenario: Talk shows slip back in
- **WHEN** the credit fetch returns a talk-show appearance
- **THEN** the live check fails, naming the title
