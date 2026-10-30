## Why

`src/components/Movie.tsx` and `src/components/TVShowCard.tsx` are the same 150-line card. They differ only because TMDB names the title `title` for movies and `name` for TV, and in the `"movie"`/`"tv"` literal (repeated about 10 times in each). Every card fix so far (CardLink, MarkWatchedModal, PosterPlaceholder, action-button labels) has had to land twice, and earlier passes missed one copy. One card removes that class of drift.

## What Changes

- New adapter `toMediaSummary(item, type)` in `src/utils/mediaSummary.ts`: turns a `TMDBMovieSummary` or `TMDBTVSummary` into one `MediaSummary` shape, `{ id, type, title, posterPath, voteAverage }`.
- New `src/components/MediaCard.tsx`, built from the current card markup, taking a `MediaSummary`. Same poster-only `CardLink`, `PosterPlaceholder`, `MarqueeTitle`, rating tag, watched and watchlist buttons, `MarkWatchedModal`, aria-labels and toasts as today.
- `Movies.tsx`, `TVShows.tsx` and `SearchPage.tsx`'s Movies/TV tabs render `MediaCard` through the adapter.
- `Movie.tsx` and `TVShowCard.tsx` are removed.
- Docs that name the two files (README component tree, CLAUDE.md card conventions) point at `MediaCard`.

No user-visible change: same DOM, labels, links, toasts and routes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. A pure refactor (`skip_specs: true`). The `accessibility` requirements on browse and search cards ("Cards with their own buttons keep them separate", "Search result cards match the browse cards", "Card action buttons name their title") keep holding, now from one component.

## Impact

- Frontend only: `src/components/{Movie,TVShowCard,Movies,TVShows}.tsx`, `src/pages/SearchPage.tsx`, new `src/utils/mediaSummary.ts` and `src/components/MediaCard.tsx`, plus Jest tests for both.
- Callers: the Movies and TV grids (`HomePage` renders `Movies`/`TVShows`), the Anime grid (`AnimePage`, same two components) and Search.
- No backend, API, route or dependency change. Existing e2e specs that cover the browse and search cards must pass unchanged.
