## Why

A code review of the 0.28.0 commit (`acc1492`) found regressions and gaps in work that change shipped (backlog item 42). One can take down the movie detail page, the new route announcer can read out the wrong title, and some JS animations still run when the device asks for reduced motion. Each was checked against the code before this proposal.

## What Changes

- **Certification can't crash the movie page.** The per-region certification reads each country entry's release dates through the shape guards, so a malformed entry empties only the Certification cell (it currently throws and the whole page hits the error boundary).
- **The route announcer speaks the new page's settled title.** It waits for the new route's page to report its title, and for detail and person pages until the real name has loaded or the load has failed, instead of a fixed 1 s after the address changes. It no longer reads out the previous page's title or a generic "Movie · CINE DB", and the first page load is never announced, StrictMode's dev-only replay included.
- **Watchlist keeps a deep-linked page while watched data loads.** With the Watched/Unwatched filter on, the move-to-last-page step also waits for the watched list, so `/watchlist?page=3` isn't reset to page 1 before that data arrives.
- **A region change doesn't reset Mark as Watched's runtime.** Changing the region while the dialog is open recomputes only the platform list, and the runtime the user typed is kept.
- **Oversized CSV `poster_path` is dropped for that row only**, like runtime and platform, instead of failing the whole chunk.
- **Reduced motion covers JS-driven motion the 0.28.0 change missed:** Stats' charts don't animate, and page changes on Watchlist/Watched and Calendar's jump-to-date scroll without smooth scrolling.
- **Re-importing the app's own Watched export skips TMDB lookups** for rows that already carry a poster and a score (the export has both), so a 900-row re-import no longer takes about 10 minutes of paced lookups.

Out of scope: extracting a shared pagination hook for Watchlist and Watched (CLAUDE.md waits for a third caller).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `accessibility`: reduced motion also covers chart animations and programmatic scrolling. The navigation announcement is the new page's own settled title, and the first load isn't announced.
- `load-states`: detail pages degrade per section, including a malformed per-country release-dates entry.
- `library-filters`: the Watchlist page clamp waits for the data its active filter depends on.
- `mark-watched`: a region change while the dialog is open updates platforms only and keeps the entered runtime.
- `data-backup`: an oversized poster value is dropped for that row only. Rows that already carry a poster and a score skip the TMDB lookup.

## Impact

- Frontend only: `MovieDetails.tsx`, `RouteAnnouncer.tsx`, `usePageTitle.ts` and the pages that pass a loaded name (`MovieDetailPage`, `TVDetailPage`, `PersonPage`, `ListDetailPage`), `WatchlistPage.tsx`, `WatchedPage.tsx`, `CalendarPage.tsx`, `StatsPage.tsx`, `MarkWatchedModal.tsx`, `csvParse.ts`, `CSVUploadModal.tsx`, plus their Jest tests.
- No backend, API, migration or dependency changes. No new TMDB requests (the import makes fewer), so no live TMDB check is needed.
