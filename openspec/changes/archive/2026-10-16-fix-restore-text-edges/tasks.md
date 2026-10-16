## 1. Character-based limits and timestamps (`src/utils/csvParse.ts`)

- [x] 1.1 Add `charLength` and `cutChars` code-point helpers. Use them in `parseTitle`, `parseBoundedText`, `parsePosterPath` and the backup review check.
- [x] 1.2 Add `FUTURE_LEEWAY_MS` (5 min, commented as mirroring the backend's `BULK_TIMESTAMP_SKEW`) to `normalizeWatchedAt`'s upper bound.
- [x] 1.3 Tests in `csvParse.test.ts`:
  - a 520-character title with an emoji at position 500 is cut to 500 code points and ends with the whole emoji
  - a 4,000-character review with 1,100 emoji is kept
  - a 60-emoji platform is kept
  - a time 2 minutes ahead is kept
  - a time one day ahead is still dropped

## 2. Lookups once per title (`src/utils/importPosters.ts`)

- [x] 2.1 Document `ImportRow`'s contract on `posterPath` and `voteAverage`: `undefined` means unknown and is looked up, a number (0 included) means given.
- [x] 2.2 Group rows needing a lookup by `${type}:${mediaId}`, look each key up once, and fan the result out to every row in the group. Progress counts unique lookups.
- [x] 2.3 Make `missing` count distinct titles left without a poster. Update the helper's doc comment.
- [x] 2.4 Tests in `importPosters.test.ts`:
  - the same title in three rows makes one lookup and all three rows get its values
  - `missing` counts that title once
  - a row with its own file poster in a duplicated group keeps it

## 3. Backup restore keeps the looked-up score (`CSVImportAllModal.tsx`)

- [x] 3.1 In `enrichPosterPaths`, pass `voteAverage: undefined` for rows without a poster whose score is 0, and write back both `posterPath` and `voteAverage` (lookup value, else 0). Replace the item-44 comment with the new rule.
- [x] 3.2 Tests:
  - a poster-less backup row with a blank score restores with TMDB's score
  - a poster-less row with score 6.5 keeps 6.5
  - a row with a poster and blank score makes no lookup and restores 0
  - one title in watchlist, watched and two lists makes one lookup and the note says 1 without a poster

## 4. Import dialogs stop after sign-out

- [x] 4.1 In `CSVUploadModal.tsx` and `CSVListImportModal.tsx`, call `guard.check()` right after `lookupImportPosters` returns, before `setProgress(null)`.
- [x] 4.2 Extend `importSession.test.tsx`: a sign-out during the lookups leaves `setProgress` uncalled afterwards and makes no bulk write, for both dialogs.

## 5. Watchlist retry and clamp (`WatchlistPage.tsx`)

- [x] 5.1 Read `isLoading` from `useWatchedContext()`. Show LoadError only when `!filterReady && watchedError && !watchedLoading`, and the skeleton for any other `!filterReady`.
- [x] 5.2 Skip the clamp while the watched filter is on and the watched history is loading.
- [x] 5.3 Tests in `WatchlistPagination.test.tsx`:
  - Retry after a failed watched load shows the skeleton while pending, the grid on success, and the error again on failure
  - with the watched filter on and a watched reload pending, `?page=3` isn't clamped until the reload settles

## 6. A response without a record is a failed load

- [x] 6.1 In `MovieDetailPage.tsx`, `TVDetailPage.tsx` and `PersonPage.tsx`, set `error = "failed"` when the main response's `data` isn't a plain object.
- [x] 6.2 Test in `detailTitles.test.tsx`: a `200` with an empty body shows the failed heading with Retry, and titles the tab with it, for each of the three pages.

## 7. Verify and record

- [x] 7.1 Run `npm run typecheck` and `npm run lint`, then the Jest suites touched (CI-style workers). Run `e2e/import.spec.ts`, and `e2e/accessibility` / library specs only if their assertions are affected.
- [x] 7.2 Update `docs/BUG_BACKLOG.md`:
  - set item 45's status row to 📝 `fix-restore-text-edges`
  - link the change in the item 45 heading
  - record the score decision (keep the looked-up score when the backup gave 0)
- [x] 7.3 Update CLAUDE.md's import bullet. `lookupImportPosters` dedupes per title and counts missing titles, and limits count code points. Correct the "A backup's score is taken as given" wording to match the new rule.
