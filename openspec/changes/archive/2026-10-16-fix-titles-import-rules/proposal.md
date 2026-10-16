## Why

A code review after 0.28.1 (backlog item 43) found that detail pages can report the wrong title to the tab and to screen readers, that the Watchlist silently filters on watched data that failed to load, and that the import "skip rows the file already covers" rule from item 42 holds in one of the three import dialogs only. Each finding below was checked against the code.

## What Changes

- **A malformed address names the page "Page Not Found".** Movie, TV and person pages with an invalid id render `NotFoundPage`, but their own title call runs after the child's (React runs parent effects last) and overwrites it with "Movie" / "TV Show" / "Person". The parent page now reports the not-found title itself.
- **A detail page that fails names what it shows.** A 404 titles and announces the page "Movie not found" (TV, person alike), and a failed load "Couldn't load movie", instead of the generic "Movie" while the page shows the error. **Changes the accessibility spec's "Detail page fails to load" scenario**, which named the generic title.
- **The Watchlist shows an error when its Watched/Unwatched filter can't be applied.** With that filter on and the watched history failed, the page now shows the error with Retry in place of a grid filtered on missing data (where the page clamp, correctly, never ran and a deep-linked page stayed blank).
- **Every import follows one lookup rule.** Rows whose file gives both a poster and a score skip the TMDB lookup, and the file's values beat the lookup's, in the Watched CSV import, the list CSV import (which looked up every row and overwrote the file's values) and the backup restore (which checked the poster only). The rule moves into `lookupImportPosters`, so callers no longer filter and remap themselves.
- **A bad poster or score in a backup row is dropped for that row only.** `parseBackupCSV` gets the same poster bound as the Watched CSV (leading `/`, at most 500 characters) and the same 0–10 score check, through one shared score parser, so one oversized or out-of-range value no longer fails a 500-row restore chunk.

Not changed, after checking:
- *Rows with a null score re-looked-up on every re-import:* `vote_average` is a non-null column with default 0, so the export never writes an empty score.
- *A selected platform kept after a region change:* the mark-watched spec keeps what the user entered; the platform is where they watched, not current availability.
- *A nested `usePageTitle` unmount clearing the parent's title:* the only nested caller is `NotFoundPage` under a detail page, and when the id becomes valid the parent's `loading` flips, so it re-emits in the same commit. No current path shows plain "CINE DB".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `accessibility`: an invalid id is titled and announced "Page Not Found"; a detail page that fails is titled and announced with the state it shows, not the generic title.
- `load-states`: a library filter whose data failed to load shows that failure with Retry, not a filtered grid.
- `data-backup`: the lookup-skip rule applies to list CSV imports and backup restores too; a backup row's oversized poster or out-of-range score is dropped for that row only.

## Impact

- Frontend only: `MovieDetailPage.tsx`, `TVDetailPage.tsx`, `PersonPage.tsx`, `WatchlistPage.tsx`, `src/utils/importPosters.ts`, `CSVUploadModal.tsx`, `lists/CSVListImportModal.tsx`, `lists/CSVImportAllModal.tsx`, `src/utils/csvParse.ts`, plus their Jest tests.
- No backend, API, migration or dependency changes. Imports make the same or fewer TMDB requests, so no live TMDB check is needed.
