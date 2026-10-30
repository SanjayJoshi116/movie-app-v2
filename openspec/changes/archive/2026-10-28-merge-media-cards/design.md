## Context

See proposal.md (Why). Today:

```
HomePage / AnimePage ──▶ Movies.tsx  ──▶ Movie.tsx       (movie: TMDBMovieSummary)
                     └─▶ TVShows.tsx ──▶ TVShowCard.tsx  (tvShow: TMDBTVSummary)
SearchPage MoviesTab ──────────────────▶ Movie.tsx
SearchPage TVTab     ──────────────────▶ TVShowCard.tsx
```

Both cards are `memo()`-wrapped because a grid holds up to several hundred of them (infinite scroll) and the Watched/Watchlist contexts re-render the grid on every toggle. Memo already works only half the time: `TVShows` passes `onKnowMore` straight through, but `Movies` wraps it in a new `() => onKnowMore(movie.id)` per render, so every movie card re-renders anyway.

Other places already pick `title` vs `name` inline (`HeroBanner.tsx`, `PersonPage.tsx`, `utils/personCredits.ts`). They work on different types (credits, hero items) and are left alone here.

## Goals / Non-Goals

**Goals:**
- One card component and one movie/TV normalizer, with identical DOM, classes, labels, toasts and links to today.
- Memo that actually skips re-renders for both media types.

**Non-Goals:**
- Merging `Movies.tsx` and `TVShows.tsx` (their empty-state copy and `aria-label` differ; 45 lines each, low drift risk). Possible follow-up.
- Moving `HeroBanner`/`PersonPage`/`personCredits` onto the adapter.
- Any visual or behavior change.

## Decisions

**1. Adapter: `toMediaSummary(item, type)` in `src/utils/mediaSummary.ts`, with overloads.**
`(item: TMDBMovieSummary, type: "movie")` and `(item: TMDBTVSummary, type: "tv")` overloads return `MediaSummary = { id; type: MediaType; title; posterPath: string | null; voteAverage: number }`. The caller states the type, which it always knows (it fetched from a movie or TV endpoint), so the adapter never guesses from `"title" in item`. Field names match what `toggleWatched`/`toggleWatchlist` already take (`title`, `posterPath`, `voteAverage`), so the card passes them on without renaming.
*Alternative:* sniff `"title" in item`. Rejected: a TV item and a movie item are both plain JSON, and a guess goes wrong silently. *Alternative:* put the type in `src/types/domain.ts`. Kept next to the adapter; move it if a second user appears.

**2. `MediaCard` takes the summary fields as flat props, not one object.**
`<MediaCard {...toMediaSummary(m, "movie")} onKnowMore={...} />`. The adapter builds a new object every render, so an `item` prop would fail `memo`'s shallow compare on every render. Flat primitives compare equal. *Alternative:* `useMemo` the mapped arrays in each grid. More code at four call sites for the same result.

**3. `onKnowMore: (id: number) => void`, passed through unchanged.**
The card calls `onKnowMore(id)`, as `TVShowCard` does now. `Movies.tsx` drops its per-item closure, so movie cards memoize too. Callers' handlers are already `useCallback`s (`handleKnowMore` in HomePage/AnimePage); Search's inline arrows stay as they are (Search re-renders rarely).

**4. Keep `movie-poster-img`, `glass-card` and every label string exactly.**
CSS, e2e locators (`movies.spec.ts`, `detail-and-nav.spec.ts`, `test_browse.py`, `test_search.py`) and screen-reader text depend on them. The type literal moves into the props; nothing else in the markup changes.

**5. Name: `MediaCard`.**
Matches `MediaGrid`/`MediaCardGrid`. Those are different components (library grid, detail-page grid). The file header says which card this is, so the names don't get mixed up.

## Risks / Trade-offs

- [A string differs between the two old cards and gets unified wrongly] → The diff (checked 2026-10-26) shows the only differences are field names, the type literal and the component name. A Jest test renders both types and asserts the link `href`, aria-labels and `MarkWatchedModal` `mediaType`.
- [Memo change shifts render timing] → No behavior depends on re-render count. The browse and search e2e specs run unchanged.
- [Docs keep naming the deleted files] → Task to update README tree and CLAUDE.md mentions (`Movie.tsx`, `TVShowCard.tsx`).
