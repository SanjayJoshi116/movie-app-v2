## 1. Backend: timestamps and shared bulk import

- [x] 1.1 `models.py`: change `WatchlistEntry.added_at`, `WatchedEntry.watched_at` (keep `db_index=True`) and `RatingEntry.rated_at` to `DateTimeField(default=timezone.now)`. Generate migration `0019` with the Anaconda `manage.py makemigrations userdata`, rename it `0019_bulk_import_timestamps`, and confirm `makemigrations --check` is clean (D3)
- [x] 1.2 `signals.py`: rename `_schedule_refresh` → `schedule_refresh` (public) and update both handlers to call it (D5)
- [x] 1.3 `serializers.py`: add a not-in-the-future timestamp validator (`now + 5 min` margin) and entry serializers for bulk watched (extend the existing `BulkWatchedEntrySerializer` with `mediaType?`, `watchedAt?`, `runtimeMinutes?`, `platform?`), bulk watchlist (`addedAt?`) and bulk ratings (`userRating` finite + half-step, `review?`, `ratedAt?`). Reuse the `harden-input-validation` building blocks (D4)
- [x] 1.4 New `backend/userdata/bulk_import.py` with `bulk_import(request, *, model, entry_serializer, build, after_create=None)`:
  - top-level validation, keeping the existing "entries must be a list." / cap messages
  - per-entry all-or-nothing validation; skip entries with no `mediaId`
  - de-duplicate on `(media_id, media_type)`
  - existing-pairs pre-check + `bulk_create(ignore_conflicts=True)` + `after_create`, all in one `transaction.atomic()`
  - return `{added, skipped}`
- [x] 1.5 Move `watched_views.bulk_watched` onto `bulk_import`. `build` sets `watched_at`/`runtime_minutes`/`platform`, and `after_create` calls `schedule_refresh` when `added > 0`
- [x] 1.6 Add `watchlist_views.bulk_watchlist` (`POST /watchlist/bulk/`) and `ratings_views.bulk_ratings` (`POST /ratings/bulk/`, create-only, no TMDB sync) on `bulk_import`. Route both in `urls.py` before the `<int:pk>/` routes, and re-export them from `views.py`
  - Also: per-entry fields live on shared `BulkEntrySerializer`/`BulkMediaEntrySerializer` bases; top-level body is `BulkImportSerializer`
  - Also: per-entry fields live on shared `BulkEntrySerializer`/`BulkMediaEntrySerializer` bases; top-level body is `BulkImportSerializer`

## 2. Backend tests

- [x] 2.1 Extend `test_watched.py` / add `test_bulk_import.py`:
  - `watchedAt` is stored as sent; a future `watchedAt` → `400`, nothing written
  - per-entry `mediaType` overrides the default
  - `runtimeMinutes`/`platform` are stored
  - counts are correct when some entries already exist
  - `schedule_refresh` is called exactly once when something was added (patch `recommendations.request_refresh`, run `on_commit` callbacks via `captureOnCommitCallbacks`) and not at all when everything was skipped
- [x] 2.2 Bulk watchlist tests: create-only, `addedAt` kept, validation `400`s, counts
- [x] 2.3 Bulk ratings tests:
  - an existing rating is unchanged (value and review) and counted as skipped
  - review and `ratedAt` are stored
  - a `7.3` rating → `400` naming the entry index
  - `tmdb_client.post_rating` is never called even with a connected TMDB profile
- [x] 2.4 Single-item POSTs ignore a client-sent `watchedAt`/`addedAt`/`ratedAt` (still server time)
- [x] 2.5 Run the full backend suite with the Anaconda interpreter

## 3. Frontend: CSV parser and export format

- [x] 3.1 Rewrite `src/utils/csvParse.ts` around `parseCSV(text): string[][]` (D2): quotes with `""` escapes, embedded newlines and delimiters, CRLF/LF, BOM strip, header-based `,`/`;`/tab detection, blank-line skip. Remove `parseRow` and the unused `parseCombinedExport`
- [x] 3.2 `parseCSVForImport` on top of `parseCSV`, adding an optional per-row `type` from a `type`/`media_type` column (D8). Move the modal's `parseExportCSV` into `csvParse.ts` as `parseBackupCSV`. It returns id, type, title, vote, poster and any of `added_at`/`watched_at`/`runtime_minutes`/`platform`/`user_rating`/`review`/`rated_at` present
- [x] 3.3 `src/utils/export.ts`:
  - `escape` also quotes `\r`
  - `downloadAllAsZip(watchlist, watched, ratings, lists)` writes `manifest.json` (every list, including empty ones, with collision-safe file names), `ratings.csv`, and `watched.csv` with `runtime_minutes,platform` appended (D1)
  - `ProfileModal` passes `Object.values(allRatings)`
- [x] 3.4 Unit tests in `src/utils/__tests__/csvParse.test.ts`: quoted comma/quote/newline, CRLF, BOM, `;` and tab detection, blank lines, per-row `type`, invalid ids dropped
- [x] 3.5 Unit test in `src/utils/__tests__/export.test.ts`: build a v2 ZIP from fixtures (a review with quotes, comma and newline; an empty list named `Sci-Fi / Horror`; two lists that sanitize to the same file name), read it back with JSZip + `parseBackupCSV` + the manifest, and assert every field round-trips. Also assert a v1-layout CSV still parses
  - Done as `src/utils/backup.ts` (`buildBackupZip`/`readBackupZip`, with `downloadAllAsZip` delegating) and `src/utils/__tests__/backup.test.ts`. Building and reading the format live together, so the round trip is testable without the modal
  - Done as `src/utils/backup.ts` (`buildBackupZip`/`readBackupZip`, with `downloadAllAsZip` delegating) and `src/utils/__tests__/backup.test.ts`. Building and reading the format live together, so the round trip is testable without the modal

## 4. Frontend: contexts and API helpers

- [x] 4.1 `useWatchlist` and `useRatings`: extract the initial fetch into a `reload` `useCallback` (mirroring `useWatched.reload`). Expose them as `reloadWatchlist`/`reloadRatings` on `AppContextType` and `useAppContext`, and update the context mocks in existing tests if needed
- [x] 4.2 `useLists.createList` returns the created `UserList`; update `ListsContextType` (`Promise<UserList | undefined>`)
- [x] 4.3 `userApi.ts`: `bulkImport(kind, entries)` chunks at 500, posts sequentially, and returns summed `{added, skipped, failed}`, counting a rejected chunk's entries as failed (D6). Keep `bulkMarkWatched` as a wrapper. Add a unit test for chunking and failure accounting to `src/api/__tests__/userApi.test.ts`
  - Put in its own `src/api/__tests__/bulkImport.test.ts`: `userApi.test.ts`'s `beforeEach` swaps in a fake-server adapter that a `post` spy doesn't need
  - Put in its own `src/api/__tests__/bulkImport.test.ts`: `userApi.test.ts`'s `beforeEach` swaps in a fake-server adapter that a `post` spy doesn't need

## 5. Frontend: import flows

- [x] 5.1 Rewrite `CSVImportAllModal` `handleSubmit` per D7:
  - optional manifest; poster fill-in via `fetchMoviePoster`/`fetchTVPoster` for rows missing a poster
  - sequential sections, each in its own try/catch: watchlist, watched (with timestamps/runtime/platform), ratings, lists (fresh `fetchAllPages("/lists/")` name map, `createList` return value, manifest descriptions and empty lists, item batches counting `201`/`200`/rejected)
  - reload all four contexts
  - summary from actual counts, as a warning if anything failed; mention that ratings were restored locally
  - The summary is shown in an `Alert` inside the modal (it stays open with a Done button), plus a short toast. `useToast` has no warning variant, and a 2s toast is too short for a per-section breakdown
  - The summary is shown in an `Alert` inside the modal (it stays open with a Done button), plus a short toast. `useToast` has no warning variant, and a 2s toast is too short for a per-section breakdown
  - preview tags gain a ratings count and the empty lists; show a note for a manifest `version > 2`
- [x] 5.2 `CSVUploadModal`: per-row type (`row.type ?? selected`) for the poster lookup and the entry, "Default type" label, Type column in the preview, `bulkImport("watched")`, `failed` in the toast, and reset the file input at the end of `handleFileChange`
- [x] 5.3 `CSVListImportModal`: same per-row type, label, preview column and input reset
- [x] 5.4 `npx tsc --noEmit` and `npx react-scripts test --watchAll=false`

## 6. End-to-end check and docs

- [x] 6.0 (Added during apply, D9.) Add an `-id` tiebreaker to the list orderings in `watched_views`, `watchlist_views`, `ratings_views`, `social_views` (followed people) and `lists_views`. Add `PaginationWithTiedTimestampsTests` to `test_bulk_import.py` (250 rows with identical timestamps page with no duplicates)

- [x] 6.1 With `npm run dev`, a Playwright `verify_backup.py` (deleted afterwards):
  - account A: add watchlist/watched (one with runtime/platform), a rating with a multi-line review containing quotes and commas, an empty list named `Sci-Fi / Horror`, and a list with items
  - export the ZIP, register account B, import it, and compare B's data via the API to A's (including `watchedAt`)
  - import again and confirm no duplicates and an "all skipped" summary
  - import a v1-layout ZIP; import a `;`-delimited watched CSV with a mixed `type` column and 1,200 rows
- [x] 6.2 `docs/ARCHITECTURE.md`: replace the "Bulk watched import" bullet with the shared `bulk_import` design, and add a "Backup format v2" bullet (manifest, compatibility rules, create-only restore, no TMDB push)
- [x] 6.3 `docs/BUG_BACKLOG.md`: row 2 → ✅ when archived, with a pointer to the archive in section 2
