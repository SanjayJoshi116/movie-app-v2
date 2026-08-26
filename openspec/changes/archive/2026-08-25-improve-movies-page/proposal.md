## Why

The Movies page (`HomePage.tsx` at `/movies`, and its shared `/tv` rendering
path) and the card components it renders (`Movie.tsx`, `TVShowCard.tsx`,
`HeroBanner.tsx`, `Movies.tsx`, `TVShows.tsx`, `FilterPanel.tsx`) were audited
against this repo's own documented conventions (`CLAUDE.md`). A full
`eslint` pass across `src/` (sanity-checked against a deliberately unused
variable to confirm the rule is active) found **zero** unused-import/unused-
variable warnings anywhere in the codebase, so there is no dead code to
remove there. The real findings are a set of small, concrete convention
violations concentrated in the movies/tv browsing surface:

- Every poster-card component (`Movie.tsx`, `TVShowCard.tsx`, and the
  "Recently Watched" strip in `HomePage.tsx`) falls back to an external
  `https://placehold.co/...` image instead of the app's own `<PosterPlaceholder>`
  component — the exact anti-pattern the component's own doc comment says it
  was built to retire. This makes a normal state (a title with no poster)
  depend on a third-party host at render time: if that host is slow, blocked,
  or down, the card shows a broken-image icon instead of a themed placeholder,
  and every such render is an outbound request to an uncontrolled domain that
  didn't need to exist.
- `HomePage.tsx`'s "Recently Watched" strip hardcodes a raw TMDB image URL
  (`https://image.tmdb.org/t/p/w185`) instead of a shared constant.
- `HeroBanner.tsx` locally redeclares `BACKDROP_URL` with the exact value
  already exported from `src/constants/ui.ts`, a needless duplicate of a
  single source of truth.
- `FilterPanel.tsx`'s genre-tag selected-border color hardcodes `#f5c518`
  instead of the shared `RATING_GOLD` constant that already holds that value.
- `Movies.tsx`'s results `<main>` has no `aria-label`, while `TVShows.tsx`'s
  equivalent element does (`aria-label="TV show results"`) — an unintended
  accessibility inconsistency between the two halves of the same page.

None of this requires a backend or API change — it's a self-contained
cleanup of the movies/tv browsing UI's compliance with the app's own
established conventions.

## What Changes

- Replace the `https://placehold.co/...` fallback `<img>` in `Movie.tsx` and
  `TVShowCard.tsx` with `<PosterPlaceholder className="movie-poster-img" />`.
- Replace the `https://placehold.co/...` fallback in `HomePage.tsx`'s
  Recently Watched strip with `<PosterPlaceholder style={{ width: 72, height: 108, borderRadius: 6 }} />`
  (no existing CSS class covers this thumbnail size, so size it inline like
  the component's other non-classed call sites already do).
- Add a `POSTER_THUMB_URL` export to `src/constants/ui.ts`
  (`https://image.tmdb.org/t/p/w185`) and use it in `HomePage.tsx`'s Recently
  Watched strip instead of the inline literal.
- Change `HeroBanner.tsx` to import `BACKDROP_URL` from
  `src/constants/ui.ts` instead of redeclaring it locally.
- Change `FilterPanel.tsx`'s genre-tag selected border to use the shared
  `RATING_GOLD` constant instead of the literal `#f5c518`.
- Add `aria-label="Movie results"` to `Movies.tsx`'s results `<main>` to
  match `TVShows.tsx`.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — these are implementation-level conformance fixes; no user-observable
requirement changes. Poster rendering already has an implicit expectation of
"show something sensible when there's no poster" — swapping which sensible
thing it shows doesn't change a testable requirement. This change sets
`skip_specs: true` in `.openspec.yaml` accordingly.)

## Impact

- `src/components/Movie.tsx`
- `src/components/TVShowCard.tsx`
- `src/components/Movies.tsx`
- `src/components/HeroBanner.tsx`
- `src/components/layout/FilterPanel.tsx`
- `src/pages/HomePage.tsx`
- `src/constants/ui.ts` (new `POSTER_THUMB_URL` export)
- No backend, API, or routing changes
- Out of scope (same anti-patterns exist elsewhere but outside the movies/tv
  browse surface): `SearchPage.tsx`, `RecommendationsPage.tsx` also hardcode
  the same `placehold.co` fallback — worth a follow-up change, not bundled
  here to keep this change's diff scoped to the movies page.
