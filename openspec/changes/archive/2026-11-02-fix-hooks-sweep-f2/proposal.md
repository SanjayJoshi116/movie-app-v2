## Why

The F2 module sweep (backlog item 57, `src/hooks` and `src/utils`) found a library filter that has done nothing since 0.15.8, import values the client lets through but the server rejects (failing a whole 500-row chunk), library reloads where an older load can overwrite a newer one, and a Back-restore that loses everything on one failed page. All ten findings were checked against the code: eight confirmed (two reproduced), one confirmed in code without a UI trigger, plus cleanups.

## What Changes

- The Movies/TV type filter works on the Watchlist, Watched and list detail pages: the three pages pass the type accessor to `useLibraryFilters`, which they never did.
- Import parsing drops, for that row only, more values the server rejects:
  - a date-time that names a day or hour that doesn't exist (`2024-02-30`, `2023-02-29`, `T24:00`), which `Date.parse` silently rolls into the next day;
  - an id that isn't a whole number (`550x`, `1.9`, `1e9`, now skipped instead of read as 550, 1 or 1) or is above the server's 2,147,483,647.
- Backup follows and episode progress go through the shared `csvParse.ts` helpers: strict bounded ids, seasons and episodes, `followed_at` through the watched-time rule, `name` cut to 500 characters, `profile_path` through the poster rule.
- Library reloads (watchlist, watched, ratings, lists, followed people) apply only the newest reload's result, and "loading" lasts until that newest one settles.
- A Back-restore fetches its saved pages at most 4 at a time, and after a failure Retry restores the same pages again instead of falling back to page 1.
- A recommendation or similar item without a `genre_ids` list (or a details answer without a `genres` list) no longer crashes the detail page.
- A repeated click on a pending item write no longer joins it when a clear was queued after it: it runs after the clear.
- Cleanup: `todayLocalISO` reuses `localISODate`; the unused `Inflight.whenIdle` is removed.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
All deltas are added requirements; no existing requirement text changes.
- `library-filters`: the type filter filters the Watchlist, Watched and list detail grids.
- `data-backup`: imported times must name a real moment; imported ids are strict whole numbers within the server's range; backup follows drop bad values per row.
- `write-feedback`: overlapping library reloads show the newest; a repeated write click doesn't skip a queued clear.
- `view-state-restore`: a Back-restore requests at most 4 pages at a time and survives a failed page.
- `load-states`: an entry without genres doesn't break a detail page.

## Impact

- Frontend only: `src/hooks/useLibraryFilters.ts` callers (`WatchlistPage`, `WatchedPage`, `ListDetailPage`), `src/utils/csvParse.ts`, `src/utils/backup.ts`, `src/utils/guardedReload.ts` and its callers (`useWatched`, `useWatchlist`, `useRatings`, `useLists`, `FollowedPeopleContext`), `src/hooks/usePaginatedFetch.ts`, `src/utils/filterByGenreOverlap.ts` and its callers in `MovieDetails`/`TVShowDetails`, `src/utils/inflight.ts`, `src/utils/browseFilters.ts`.
- No backend, API, migration or dependency change.
- Tests: Jest for each util/hook plus a page-level type-filter test; the touched e2e specs (library filters, import, browse restore).
