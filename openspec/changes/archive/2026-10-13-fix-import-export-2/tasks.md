## 1. Bulk import: identity and exact counts (backend)

- [x] 1.1 Add `insert_ignoring_conflicts(model, objs) -> int` to `bulk_import.py`:
  - one `INSERT … ON CONFLICT DO NOTHING RETURNING 1` built from the model's concrete non-pk fields
  - values from `field.get_db_prep_save()`
  - returns the number of rows inserted
- [x] 1.2 In `bulk_import()`, use that helper for `added`, and add an `identity=(entry_field, model_field)` option (default: today's media key) for de-duplication, the existing-row check and the "no id: skip" rule.
- [x] 1.3 Tests in `test_bulk_import.py`:
  - a row inserted between the pre-check and the insert counts as skipped (patch the pre-check to miss it)
  - counts stay exact for watchlist, watched, ratings and list items
  - JSON and timestamp fields round-trip through the helper

## 2. Follows and episode progress endpoints (backend)

- [x] 2.1 `FollowedPerson.followed_at` → `default=timezone.now`; generate migration 0024 with the Anaconda `django` env.
- [x] 2.2 The followed-people list response adds `followedAt`, and so do `FollowedPersonEntry` in `userApi.ts` and the TS/Python e2e mocks (the `test_e2e_mock_shapes` coverage is extended if the follow mock is checked).
- [x] 2.3 Add `GET /api/episode-progress/`: paginated `{showId, season, episode, updatedAt}`, ordered `-updated_at, -id`.
- [x] 2.4 Add `POST /api/followed-people/bulk/` (`{personId, name, profilePath?, followedAt?}`) and `POST /api/episode-progress/bulk/` (`{showId, season, episode}`) through `bulk_import(identity=…)`, with bounded serializers (`INT32_MAX`, name max length, a past-only timestamp, season/episode ≥ 1).
- [x] 2.5 Tests:
  - the list endpoint pages with no duplicates
  - both bulk endpoints are create-only (existing progress is kept) and reject a future `followedAt`
  - a 501-entry body gets a 400
  - a restored `followedAt` is stored as given

## 3. Backup v3 (frontend)

- [x] 3.1 `backup.ts`:
  - `BACKUP_VERSION = 3`
  - `buildBackupZip` writes `followed.csv` and `episode_progress.csv` (header-only when empty)
  - `readBackupZip` returns `followed`/`episodeProgress`, empty for v1/v2
  - both count as data
- [x] 3.2 `userApi.ts`:
  - `fetchAllEpisodeProgress()`
  - `bulkImportFollowed()` and `bulkImportEpisodeProgress()`, chunked at 500 like `bulkImport`
- [x] 3.3 `ProfileModal` export: fetch followed people and progress at click time, block with the named part plus Retry on failure, and pass both to `downloadAllAsZip`.
- [x] 3.4 `CSVImportAllModal`:
  - adds "Following" and "Episode progress" sections, each with its own result line
  - shows both counts in the preview tags
  - calls `useFollowedPeople().retry()` after the import
- [x] 3.5 `CSVImportAllModal`:
  - `idByName` comes only from lists that existed before the import, so two same-name lists in one backup stay separate
  - the preview tags use index keys
- [x] 3.6 Jest `backup.test.ts`:
  - a v3 round trip keeps follows (order, `followedAt`) and progress
  - a v2 zip reads with empty follows and progress
  - a backup with only `followed.csv` is accepted

## 4. Paced poster lookups (frontend)

- [x] 4.1 Add `src/utils/pacedLookup.ts` (design §5):
  - a module-level bucket at 90/min, 4 in flight
  - a 429 waits `Retry-After` (10 s default), up to 3 tries
  - a 404 is final; other errors retry once
  - returns `{ results, missing }` and calls `onProgress(done, total)`
- [x] 4.2 Jest tests for the pacer with fake timers:
  - the rate is respected over 200 items
  - a 429 with `Retry-After: 5` retries after 5 s and succeeds
  - a 404 isn't retried and counts as missing
  - progress reaches total
- [x] 4.3 Switch `CSVUploadModal`, `CSVListImportModal` and `CSVImportAllModal.enrichPosterPaths` to the pacer:
  - show `Looking up posters: n / total` while it runs
  - add "N saved without a poster" to the result when `missing > 0`

## 5. Watched CSV keeps dates (frontend)

- [x] 5.1 `parseCSVForImport`:
  - optional `watchedAt`/`watchedTz` from the `watched_at`/`watched_tz` columns
  - drop an unparseable or future time for that row only
- [x] 5.2 `CSVUploadModal` sends `watchedAt`/`watchedTz` in the bulk request.
- [x] 5.3 Jest `csvParse` tests:
  - the Watched page's own export parses with dates and zones
  - a future or garbage date is dropped for that row only
  - a file without the columns is unchanged

## 6. End-to-end and docs

- [x] 6.1 `e2e/import.spec.ts` (extend the stateful mocks with followed/progress bulk and list):
  - a v3 backup restores follows and progress, with their own result lines
  - two same-name lists become two lists
  - a CSV import whose lookups first get a `429` with `Retry-After: 1` still saves posters, with no "saved without a poster" note
  - re-importing a Watched page export sends the original `watchedAt`/`watchedTz`
- [x] 6.2 `e2e`: Export All fails closed when `/api/episode-progress/` returns 500 (no download, the named part, Retry).
- [x] 6.3 Docs:
  - `README.md` backup contents
  - `docs/ARCHITECTURE.md` bullets for the import pacer and backup v3
  - CLAUDE.md: the "Imports, backups" bullet mentions `pacedLookup` and the `bulk_import(identity=…)` option
- [x] 6.4 Run the checks:
  - backend `pytest`, `ruff`, `makemigrations --check` (0024 committed)
  - `npm run typecheck`, `npm run lint`, Jest, `npx playwright test`
- [x] 6.5 Update `docs/BUG_BACKLOG.md`:
  - item 24 → 📝 now, ✅ at archive
  - record decision (24): v3, and pacing in the browser
  - note that the reload-failure bullet was already fixed in 21c
