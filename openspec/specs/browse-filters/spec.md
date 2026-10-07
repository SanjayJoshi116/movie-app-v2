# browse-filters Specification

## Purpose

Defines what the Movies, TV and Anime browse grids return for a given set of
genre, filter, sort and category choices, so the results always match the
filters visible for the media type being browsed.

## Requirements

### Requirement: Genre choices match the browsed media type
The filter panel SHALL offer TMDB's movie genre list when the browse grid
shows movies (Movies page, Anime in Movies mode), and TMDB's TV genre list
when it shows TV (TV page, Anime in TV mode). A genre id from one media type's
list SHALL never be sent to the other media type's discover request.

#### Scenario: TV shows TV genres
- **WHEN** the user opens the filter panel on the TV page
- **THEN** the genre options include "Action & Adventure" and "Sci-Fi & Fantasy" and do not include movie-only genres such as "Science Fiction" or "Thriller"

#### Scenario: TV genre returns TV results
- **WHEN** the user selects "Action & Adventure" on the TV page and applies
- **THEN** the grid shows TV shows tagged with that genre, not an empty result

#### Scenario: Switching media type clears genre picks
- **WHEN** the user has a genre selected on Movies and then opens TV, or toggles Anime between TV and Movies
- **THEN** no genre is selected and the next request carries no `with_genres`

### Requirement: Genre picks always affect the results
When at least one genre is selected, the grid SHALL be fetched from a request
that honours the genre filter. A category request that ignores genres SHALL NOT
be used while a genre is selected, and it SHALL NOT be sent a `with_genres`
parameter.

#### Scenario: Genre on a category
- **WHEN** the user is on the Movies "Top Rated" category and selects "Horror"
- **THEN** every result returned is tagged Horror

### Requirement: Filters count as active only when a real filter is set
The browse grid SHALL treat filters as active only when at least one of year
range, rating range, language, runtime range or genre has a value, or a
non-default sort is chosen. The adult-content switch on its own and a default
sort SHALL NOT make filters active. While filters are inactive, the category
buttons SHALL select what the grid shows.

#### Scenario: Apply with nothing set
- **WHEN** the user opens the filter panel, changes nothing and presses Apply
- **THEN** the category buttons still change the grid's results

#### Scenario: Reset re-enables categories
- **WHEN** the user applies a year filter and then presses Reset
- **THEN** the category buttons change the grid's results again

### Requirement: Applied filters are scoped to one media type
Applied filters and sort SHALL belong to the media type they were applied on.
Moving between Movies, TV, and the Anime TV/Movies modes SHALL reset the
applied filters, the sort and the filter panel's inputs to their defaults. A
request SHALL NOT carry a filter the current media type's panel does not show,
and SHALL NOT carry a sort value the current media type's discover endpoint
does not support.

#### Scenario: Runtime does not carry over to TV
- **WHEN** the user applies a 90–120 minute runtime filter on Movies and then opens TV
- **THEN** the TV request carries no runtime parameter and the panel shows default values

#### Scenario: Title sort on TV
- **WHEN** the user picks "Title (A–Z)" on the TV page and applies
- **THEN** the request sorts by the TV title field and returns results in alphabetical order

### Requirement: Anime "Airing Today" lists only anime airing today
The Anime TV "Airing Today" category SHALL list only anime with an episode
airing on the current date. It SHALL NOT include shows whose first episode
has not aired yet.

#### Scenario: No unaired shows
- **WHEN** the user selects Anime → TV → "Airing Today"
- **THEN** no listed show has a first air date later than today

### Requirement: Browse filters can be opened at every screen size
On the Movies, TV and Anime browse pages, the user SHALL be able to open the filter panel at phone, tablet and desktop widths. Every filter control in the app SHALL open the same panel and show the same open/closed state. The control SHALL NOT appear on pages that are not browse pages.

#### Scenario: Open filters on a phone
- **WHEN** a signed-in user is on `/movies` at 375px width and activates the Filters control
- **THEN** the filter panel opens, and applying a filter changes the browse results the same way it does on desktop

#### Scenario: Control reflects panel state
- **WHEN** the filter panel is open on a phone
- **THEN** the Filters control is shown as active and reports itself as expanded to assistive technology

#### Scenario: No control off browse pages
- **WHEN** a signed-in user is on `/watchlist` at 375px width
- **THEN** no Filters control is shown in the phone navigation
