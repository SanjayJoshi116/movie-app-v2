## MODIFIED Requirements

### Requirement: Poster lookups during imports respect the rate limit
Looking up posters and scores for imported rows SHALL stay within the per-user rate limit of the TMDB passthrough, leaving room for the user's other browsing. A rate-limited lookup SHALL be retried after the wait the server asks for, not dropped. When any lookup is rate-limited, no further lookups SHALL be sent until that wait has passed, from any import running in the tab. A row whose file already gives both a poster and a score SHALL NOT be looked up. While lookups run, the import SHALL show its progress. When the import finishes, its result SHALL say how many rows were saved without a poster.

#### Scenario: Large CSV import
- **WHEN** a user imports a 300-row watched CSV without posters
- **THEN** every row is saved with its poster and score when TMDB has one, no lookup is abandoned because of the rate limit, and progress is shown while the lookups run

#### Scenario: Re-importing the app's own export
- **WHEN** a user imports a 900-row watched CSV exported from the Watched page, where every row has a poster and a score
- **THEN** no TMDB lookup is made, and every row is saved with the file's poster and score

#### Scenario: Some rows lack a poster or score
- **WHEN** an imported file has a poster and a score on some rows and not on others
- **THEN** only the rows missing either are looked up

#### Scenario: A lookup is rate-limited
- **WHEN** a poster lookup during an import is answered with `429` and a `Retry-After` of 5 seconds
- **THEN** the lookup is retried after about 5 seconds and the row gets its poster

#### Scenario: Other lookups wait out the same 429
- **WHEN** several lookups are running and one is answered with `429` and a `Retry-After` of 5 seconds
- **THEN** no lookup request of any kind is sent for about 5 seconds, and afterwards the lookups continue without any row losing its poster to the rate limit

#### Scenario: A title TMDB doesn't know
- **WHEN** one imported row's id doesn't exist on TMDB
- **THEN** the row is still imported, and the result says 1 row has no poster

### Requirement: The Watched CSV round-trips runtime, platform and poster
The Watched page's CSV export SHALL include each watch's runtime, platform and poster, and the Watched CSV import SHALL read them back when present, so exporting and re-importing keeps them. A value the server would reject (a poster path longer than the server accepts, an out-of-range runtime, an overlong platform) SHALL be dropped for that row only, and the rest of the row and of the file SHALL be imported.

#### Scenario: Export then import
- **WHEN** a user exports Watched as CSV and imports that file into an account without those titles
- **THEN** the imported watches have the same runtime, platform and poster

#### Scenario: One oversized poster value
- **WHEN** one row of an imported Watched CSV has a 600-character `poster_path`
- **THEN** every row is imported, and that row's poster comes from the TMDB lookup instead
