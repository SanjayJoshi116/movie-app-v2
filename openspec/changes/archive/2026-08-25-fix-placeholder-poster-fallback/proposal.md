## Why

The `improve-movies-page` change (archived 2026-08-25) replaced the
external `https://placehold.co/...` no-poster fallback with the app's own
`<PosterPlaceholder>` component in `Movie.tsx`, `TVShowCard.tsx`, and
`HomePage.tsx`, but explicitly scoped out two other pages with the exact
same anti-pattern to keep that diff focused. Those two pages still have it:

- `SearchPage.tsx` — both the movie-results grid and the TV-results grid
  (two separate `<img>` call sites)
- `RecommendationsPage.tsx` — the `RecCard` component used for all
  recommendation grids on the page

Same problem as before: a missing poster (a normal, expected state — not
every TMDB title has one) makes the app depend on an external, uncontrolled
host at render time instead of the self-contained placeholder built for
exactly this. All three call sites already use `className="movie-poster-img"`,
the same class `<PosterPlaceholder>` was already designed to slot into on the
first pass — so this is the same fix, just at three more sites, with zero
new design decisions.

## What Changes

- Replace the `https://placehold.co/500x750?text=No+Image` fallback in
  `SearchPage.tsx`'s movie-results `<img>` with
  `<PosterPlaceholder className="movie-poster-img" />`.
- Replace the same fallback in `SearchPage.tsx`'s TV-results `<img>` with
  `<PosterPlaceholder className="movie-poster-img" />`.
- Replace the same fallback in `RecommendationsPage.tsx`'s `RecCard` with
  `<PosterPlaceholder className="movie-poster-img" />`.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — this is the same implementation-level conformance fix already
covered by the archived `improve-movies-page` change; it doesn't introduce
a new testable requirement, it extends an existing one to two more call
sites. This change sets `skip_specs: true` in `.openspec.yaml`.)

## Impact

- `src/pages/SearchPage.tsx`
- `src/pages/RecommendationsPage.tsx`
- No backend, API, constants, or routing changes — `PosterPlaceholder` and
  `IMG_URL` are already imported/used correctly at all three sites; only the
  fallback branch changes
- Out of scope: the broader hand-rolled filter-bar pattern in
  `RecommendationsPage.tsx` (and `ListsPage.tsx`/`ListDetailPage.tsx`/
  `FollowingPage.tsx`) that CLAUDE.md flags as a migration candidate onto
  `useLibraryFilters`/`MediaGrid` — that's a separate, larger decision and
  isn't bundled into this poster-fallback fix
