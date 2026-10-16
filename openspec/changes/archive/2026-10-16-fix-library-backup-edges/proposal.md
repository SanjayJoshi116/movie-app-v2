## Why

A code review after `fix-titles-import-rules` (backlog item 44) found that item 43's own Watchlist fix hides a correct grid when a background reload of the watched history fails, and that a backup restore can still lose a whole 500-row chunk to one bad cell outside the poster and score columns. Each finding was checked against the code.

## What Changes

- **The Watchlist's Watched/Unwatched filter waits for the watched history, and survives a failed background reload.** While the watched history hasn't loaded yet, the page shows its loading placeholder instead of a grid filtered on nothing ("No items match your filters." under Watched, every title under Unwatched). The error with Retry shows only when the watched history has never loaded in this session. A reload that fails after a successful load keeps the grid, filtered on the history already loaded. Item 43 showed the error whenever the last load failed.
- **A backup restore drops any value the server would reject, for that row only.** Besides poster and score (item 43): runtime that isn't a non-negative whole number, a platform over 100 characters, a time zone over 64, an added/watched/rated time that isn't a valid past time after 1900, a personal rating outside 0.5–10 or off the half step (that rating isn't restored), and a review over 5,000 characters (the rating is restored without it). A title over 500 characters is shortened to 500, in both CSV importers. The two CSV readers share one parser per column.
- **A backup's score is taken as given.** A blank or invalid `vote_average` in a backup row stays 0 and isn't looked up on TMDB, so old or hand-made backups restore fast (decided 2026-10-16). The data-backup spec says so explicitly.
- **A detail page that loaded a record without a name keeps the generic title**, not the error heading (TMDB records with a blank title render normally).
- **Moving between two detail or person pages never shows the previous subject.** The page starts fresh for each id, so the old title isn't reported as settled and the old content doesn't flash.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `load-states`: a library filter's data that is still loading shows the loading state; the failure state is only for data that never loaded, and a failed background reload keeps the filtered grid.
- `data-backup`: a backup row drops every value the server would reject (not only poster and score) for that row only; a backup's score is not looked up.
- `accessibility`: a loaded record without a name keeps the generic title; a new id on the same kind of page never reports the previous subject's title.

## Impact

- Frontend only: `src/hooks/useWatched.ts` (+ `WatchedContext`), `src/pages/WatchlistPage.tsx`, `src/utils/csvParse.ts`, `src/hooks/usePageTitle.ts`, `src/App.tsx` (detail/person routes), plus Jest tests and the mocks that stub `useWatchedContext`.
- No backend, API, migration or dependency changes. No new TMDB requests.
