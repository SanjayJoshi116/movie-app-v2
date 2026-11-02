## 1. Library type filter

- [x] 1.1 Pass a module-level `getType = (i) => i.type` to `useLibraryFilters` from `WatchlistPage.tsx`, `WatchedPage.tsx` and `ListDetailPage.tsx`; note on `Options.getType` that a page rendering the type select must pass it
- [x] 1.2 Page-level tests (Jest or `e2e/library-filters.spec.ts`): "TV Shows" / "Movies" filter the Watchlist, Watched and list detail grids, combined with search; the choice survives a reload

## 2. Import parsing

- [x] 2.1 `csvParse.ts`: add the real-moment field check (month, day per month with leap years, hour ≤ 23, minute/second ≤ 59, offset hour) to `normalizeWatchedAt`, for date-times and date-only values
- [x] 2.2 `csvParse.ts`: replace `parsePositiveInt` with a strict `parseId` (`/^\d+$/`, 1…`INT32_MAX`), used by both CSV readers; export it with `parseTitle`, `parsePosterPath`, `normalizeWatchedAt`
- [x] 2.3 `backup.ts`: drop `positiveInt`; `readFollowed` uses `parseId`, `parseTitle` for `name`, `parsePosterPath` for `profile_path`, `normalizeWatchedAt` for `followed_at`; `readEpisodeProgress` uses `parseId` for show, season and episode
- [x] 2.4 Tests in `csvParse.test.ts` / `backup.test.ts`: `2024-02-30T12:00:00Z`, `2023-02-29`, `2024-04-31`, `T24:00Z`, minute 60 dropped; `2024-02-29` kept; ids `550x`, `1.9`, `1e9`, `99999999999` skipped, `2147483647` kept; follow with future time, 700-char name, non-`/` profile path; progress row with `1e3`

## 3. Overlapping reloads

- [x] 3.1 `guardedReload`: optional `reloadSeq` ref; drop the result of a reload that is no longer the newest; return whether this call was the newest; rethrow only for the newest
- [x] 3.2 `useWatched`, `useWatchlist`, `useRatings`, `useLists.fetchLists`, `FollowedPeopleContext`: pass a `reloadSeq` ref and set `reloading` false, `loadedGen`/`loadedOkGen` and `error` only when this reload was the newest
- [x] 3.3 Tests: `guardedReload` unit tests (older finishes last → dropped; older fails after newer succeeded → error not set); one hook test (`useWatched`): two overlapping reloads, the older resolves last, the newer's list stays and `isLoading` stays true until the newer settles

## 4. Back-restore

- [x] 4.1 `usePaginatedFetch`: fetch saved pages with at most 4 in flight, in page order; keep `isRestoringRef` set after a failed restore so `retry()` restores the same pages
- [x] 4.2 Tests in `usePaginatedFetch.test.tsx`: at most 4 concurrent fetches for 10 saved pages; a failed page shows `error`, and `retry()` fetches all 10 pages again (not page 1 only); the StrictMode replay tests still pass

## 5. Genre overlap

- [x] 5.1 `filterByGenreOverlap`: drop non-object items, read `genre_ids` and the source ids through `arrayOr` (numbers only); callers in `MovieDetails.tsx` / `TVShowDetails.tsx` pass `arrayOr(genres)`
- [x] 5.2 Tests: an item without `genre_ids`, a `null` item, missing source genres

## 6. Inflight and cleanups

- [x] 6.1 `inflight.run`: a same-action repeat shares the pending promise only when no `runExclusive` started after it; otherwise it queues behind the clear
- [x] 6.2 Remove `whenIdle` from `Inflight` and its tests
- [x] 6.3 `todayLocalISO` returns `localISODate(now)`
- [x] 6.4 `inflight.test.ts`: add → clear → add again sends the second add after the clear and resolves with its own outcome

## 7. Verify and docs

- [x] 7.1 `npm run typecheck`, `npm run lint`, full Jest (`--maxWorkers=2` if the known 5 s timeouts show)
- [x] 7.2 Touched e2e only: `library-filters.spec.ts`, `import.spec.ts`, `browse-restore.spec.ts`, `write-feedback.spec.ts`, `detail-and-nav.spec.ts`
- [x] 7.3 CLAUDE.md: the strict id/real-moment rule in the imports bullet, `getType` note in the filter-bar bullet, newest-reload rule in the load-feedback bullet; BUG_BACKLOG item 57 and status table
