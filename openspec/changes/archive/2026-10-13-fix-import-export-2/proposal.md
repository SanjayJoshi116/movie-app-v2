## Why

Backlog item 24. Findings were re-checked against the code on 2026-10-13. One was already fixed in 21c: a library refresh that fails after an import used to be reported as a failed import. The rest still hold. The import/export round trip loses data or reports it wrongly in five ways:
- **The backup leaves out followed people and episode progress.** Export, delete account, re-register and import loses every follow, and with it every notification and followed-people section, plus every SxxEyy position, with no notice.
- **CSV imports hit the 120/min TMDB proxy throttle.** They look up a poster for every row, 20 at a time. A 429 is swallowed, so a 300-row import saves about 180 rows without a poster or score while saying "Import complete". The rest of the app's browsing is throttled for a minute.
- **Re-importing the Watched page's own CSV loses every date and time zone.** The parser keeps only id, title and type, so the whole history becomes "watched today".
- **A backup's lists that share a name merge into one list** on restore, and the second list's description is lost.
- **Bulk imports can count a row as added when a concurrent request created it first.** The count no longer matches what was actually created.

## What Changes

**Backup format v3**, decided 2026-10-13: add followed people and episode progress.
- `followed.csv` holds person id, name, profile path and followed time. `episode_progress.csv` holds show id, season and episode.
- The manifest's version becomes 3. v1 and v2 backups import as before, with these sections simply absent.
- New backend endpoints:
  - `GET /api/episode-progress/` returns a paginated list of the user's progress.
  - `POST /api/followed-people/bulk/` and `POST /api/episode-progress/bulk/` are create-only and all-or-nothing, like the other bulk endpoints.
- `FollowedPerson.followed_at` becomes settable (`default=timezone.now`, migration 0024), so a restore keeps the Following page's order. The followed-people list response adds `followedAt`.
- **Export All** fetches both new sections when it runs. If either fetch fails, no file is produced, and the export says which part couldn't be loaded and offers Retry, the same as for the other parts.
- **Import All** restores both sections, reports their counts, and refreshes the followed-people state afterwards.

**CSV imports are paced and retried in the browser**, decided 2026-10-13.
- Poster and score lookups during any import go through one shared pacer. It stays under the proxy throttle with headroom left for browsing, waits out a 429 (honoring `Retry-After`) instead of dropping the row, and retries a failed lookup a bounded number of times.
- Long imports show progress ("Looking up posters: 40 / 300").
- The result reports how many posters couldn't be found rather than calling the import complete without them.

**Watched CSV round trip.** The Watched CSV import reads `watched_at` and `watched_tz` when the file has them, the columns the Watched page exports. A blank or unreadable date falls back to "now" for that row only. A date in the future is dropped for that row, so one bad cell can't make the server reject the whole batch.

**Lists with the same name.**
- A backup's list joins an existing list only when that list existed before the import started.
- Two lists in one backup that share a name each become their own list, and each keeps its own description.
- The preview tags use a unique key.

**Accurate bulk counts.** Bulk inserts report the number of rows the database actually inserted, so a row a concurrent request created first counts as skipped.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `data-backup`:
  - The "whole library" requirement adds follows and progress.
  - "Export All never saves an incomplete backup" covers the new parts.
  - New requirements cover same-name lists, paced poster lookups, and the Watched CSV keeping its dates.
  - The bulk-import requirement gains an exact-count scenario.

## Impact

- **Backend:**
  - `models.py` and migration 0024 (`FollowedPerson.followed_at`)
  - `social_views.py` (progress list, two bulk endpoints, `followedAt` in the list response) and `urls.py`
  - `bulk_import.py`: a generic identity for person- and show-keyed models, and exact insert counts
  - serializers, and tests in `test_bulk_import.py`, `test_episode_progress.py` and `test_followed_people.py`
- **Frontend:**
  - `backup.ts` (v3 write and read)
  - `export.ts` / `ProfileModal.tsx` (fetching the extra parts, blocking on failure)
  - `CSVImportAllModal.tsx` (new sections, same-name lists, key)
  - `CSVUploadModal.tsx` and `CSVListImportModal.tsx` (pacer, progress, missing-poster count)
  - `csvParse.ts` (watched dates in the CSV import)
  - a new `src/utils/pacedLookup.ts`
  - `userApi.ts` (the new endpoints)
- **Tests:**
  - Jest: `backup.test.ts`, the pacer, `csvParse`
  - e2e: `e2e/import.spec.ts` (v3 round trip, same-name lists, a throttled import), with the mock shape test updated for `followedAt`
- **Docs:** `README.md` (backup contents) and `docs/ARCHITECTURE.md` (the pacer, and the backup v3 note).
