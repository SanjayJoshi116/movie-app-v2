## Context

**Export** (`src/utils/export.ts` `downloadAllAsZip`) builds a ZIP from the in-memory context data: `watchlist.csv`, `watched.csv` and `lists/<sanitized name>.csv`. Columns are `tmdb_id,title,type,vote_average,added_at|watched_at,poster_path`. Lists with no items are skipped. `ProfileModal` passes only watchlist, watched and lists; ratings are never exported.

**Import All** (`CSVImportAllModal.tsx`):
- splits each CSV with `text.trim().split(/\r?\n/)` plus a per-line `parseRow`, so a quoted newline breaks the row
- fills missing posters with raw `fetch('/api/tmdb/...')`, which bypasses `REACT_APP_API_BASE_URL` and never checks `res.ok`
- calls `addToWatchlist` in an un-awaited loop
- bulk-imports watched entries split by type, with no timestamps
- for a list that doesn't exist yet: calls `createList` (whose result it ignores), then `userApi.get("/lists/")` and `res.data.find(...)`. That response is paginated (`{count, results}`), so it throws a `TypeError` after the watchlist and watched data is written. The toast reports the counts parsed at preview time.

**Single-file imports** (`CSVUploadModal.tsx` for watched, `CSVListImportModal.tsx` for lists):
- use `parseCSVForImport`, which is comma-only
- apply the radio-selected media type to every row and to the poster lookup
- never reset the `<input type=file>` on error
- `CSVUploadModal` sends everything in one `bulkMarkWatched` call, so more than 500 rows gets a `400`

**Backend:**
- `bulk_watched` (hardened in `harden-input-validation`) validates every entry, then does an existing-ids pre-check *outside* the transaction and `bulk_create(ignore_conflicts=True)`. `bulk_create` sends no `post_save`, so `signals.watched_entry_saved` never schedules a recommendation refresh.
- `added_at` / `watched_at` / `rated_at` are `auto_now_add=True`. Django overwrites any supplied value on insert, `bulk_create` included, so a restore can't keep original dates.

**Contexts:**
- `useWatched` has `reload`; `useWatchlist` and `useRatings` don't.
- `useLists.createList` returns `void`.
- `AppContextType` exposes `allRatings` (a map), which the export can use.

## Goals / Non-Goals

**Goals:**
- Export → import into a fresh account reproduces the library: timestamps, runtime and platform, ratings with reviews, list names, descriptions and empty lists.
- v1 backups keep importing. An older app version ignores v2 additions instead of breaking.
- Import never overwrites, is idempotent, and reports actual per-section results. One failing section doesn't sink the others.
- One CSV parser for every import, robust to quoting, delimiters and BOMs.

**Non-Goals:**
- Partial-success bulk requests. All-or-nothing per request stays (from `harden-input-validation` D6). Chunks are independent, so one bad chunk fails only its own entries, and that's reported.
- Pushing imported ratings to TMDB. Bulk rating import is local only.
- Spreadsheet formula escaping (`=`, `+`, `-`, `@` prefixes) in exported CSVs.
- Restoring `original_language` / `release_year` / `genre_ids`. The stats backfill already derives these from TMDB.
- Fixing "re-rating keeps the original `rated_at`". That's `fix-data-correctness`, but D3 below makes it trivial there.

## Decisions

### D1. Backup format v2: additive, with a manifest
The ZIP keeps the v1 files and columns. It adds:
- `manifest.json`:
  ```json
  { "format": "cinedb-backup", "version": 2, "exportedAt": "<ISO>",
    "lists": [{ "file": "lists/Sci-Fi _ Horror.csv", "name": "Sci-Fi / Horror", "description": "..." }] }
  ```
  `lists` covers **every** list, including empty ones. An empty list has a `file` but its CSV is header-only. Duplicate sanitized names get a numeric suffix (`name (2).csv`), so two lists can't share a file.
- `ratings.csv`: `tmdb_id,title,type,user_rating,review,rated_at`.
- `watched.csv` gains `runtime_minutes,platform` columns, appended after the v1 columns.

Import:
- **With a manifest**, it uses it for list names and descriptions, and creates empty lists.
- **Without one (v1)**, the list name comes from the file name, as today.
- Unknown files and columns are ignored either way.
- A manifest with `version > 2` imports what it recognizes and shows a "made by a newer version" note. It doesn't refuse.

*Alternatives considered:*
- **A single JSON backup:** rejected. It breaks v1 compatibility in both directions, and the CSVs are useful to users on their own (opening them in a spreadsheet).
- **Encoding the list name in the file name:** rejected. It can't represent `/`, it's OS-dependent, and it can't carry a description.

### D2. One RFC 4180 parser: `parseCSV(text) → string[][]`
Rewrite `src/utils/csvParse.ts` around a character-level state machine:
- handles quoted fields with `""` escapes, and newlines and delimiters inside quotes
- accepts CRLF or LF
- strips a leading `\uFEFF`
- detects the delimiter from the header line, outside quotes: whichever of `,` `;` `\t` occurs most, defaulting to `,`
- skips blank lines

`parseRow` is removed. Every consumer moves to `parseCSV`:
- `parseCSVForImport`
- the backup reader (currently `parseExportCSV` inside the modal; it moves into `csvParse.ts` as `parseBackupCSV`)
- `parseCombinedExport`: unused today, so it's deleted rather than migrated

Export's `escape` also quotes fields containing `\r` (and the chosen delimiter, which is always `,` for exports).
- *Alternative:* add `papaparse`. Rejected: a ~60-line pure function covers our needs, is unit-testable, and avoids a dependency for a rarely-used feature.

### D3. Timestamps: `default=timezone.now` instead of `auto_now_add`
`WatchlistEntry.added_at`, `WatchedEntry.watched_at` (keeps `db_index=True`) and `RatingEntry.rated_at` become `models.DateTimeField(default=timezone.now)`. Migration `0019` is three `AlterField`s, generated explicitly with `makemigrations` (per CLAUDE.md, never at boot), and makes no DB-level change. Single-item create paths never pass these fields, so they behave exactly as before. Bulk endpoints pass the supplied value, or `timezone.now()`.
- *Alternative:* keep `auto_now_add` and `bulk_update` the timestamps after insert. Rejected: twice the queries, an extra window where wrong dates are visible, and fighting the ORM.

### D4. Bulk endpoints share one implementation
A helper in a new `backend/userdata/bulk_import.py`:
```python
def bulk_import(request, *, model, entry_serializer, build, after_create=None, max_entries=MAX_BULK_ENTRIES) -> Response
```
It owns what `bulk_watched` does today:
- validate the top-level body: `entries` list ≤ 500, default `mediaType`
- validate each entry, all-or-nothing; skip entries with no `mediaId`
- de-duplicate on `(media_id, media_type)`, now that the type is per entry
- then **inside one `transaction.atomic()`**: query the existing `(media_id, media_type)` pairs for the user, `bulk_create(ignore_conflicts=True)` the rest, and compute `added`/`skipped` from that pre-check

`build(user, validated) -> model instance` is the per-model part. The three endpoints:
- `POST /watched/bulk/`: existing route. Entry fields: `mediaId`, `mediaType?`, `title`, `posterPath`, `voteAverage`, `watchedAt?`, `runtimeMinutes?`, `platform?`.
- `POST /watchlist/bulk/` (new): `mediaId`, `mediaType?`, `title`, `posterPath`, `voteAverage`, `addedAt?`.
- `POST /ratings/bulk/` (new): `mediaId`, `mediaType?`, `title`, `userRating` (finite, 0.5 step, 0.5–10), `review?`, `ratedAt?`. Create-only: an existing rating is skipped, never updated (unlike `POST /ratings/`'s `update_or_create`). No TMDB sync. A backup restore shouldn't push hundreds of writes to a third-party account. The import summary says ratings were restored locally.

The entry serializers reuse `harden-input-validation`'s building blocks: `INT32_MAX` bounds, `FiniteFloatField`, the `ChoiceField(MEDIA_TYPES)`, `max_length`s and the half-step validator. Timestamps are `DateTimeField(required=False)`, plus a validator rejecting values later than `now + 5 minutes` (margin for client/server clock skew; exports come from server timestamps anyway).

The pre-check inside the transaction makes the counts correct against everything committed before it. A concurrent single-item POST of the same title can still land between the check and the insert; `ignore_conflicts` keeps that safe, and the only effect is that the count is off by one. That's acceptable for an import summary.

### D5. One refresh after a bulk watched import
`signals.py` gains a public `schedule_refresh(user_id)` (the existing `_schedule_refresh`, renamed, with the signal handlers calling it). `bulk_import` takes an optional `after_create(user, added)` hook, which it runs inside the atomic block. `bulk_watched` passes one that calls `schedule_refresh(user.id)` once when `added > 0`. It's `on_commit`-deferred and coalesced by `request_refresh`, per the CLAUDE.md "recommendation refresh triggers" rule. Watchlist and rating imports don't trigger a refresh: the signals don't trigger one for single-item changes to those either.

### D6. Frontend bulk helpers chunk at 500
`userApi.ts` gets `bulkImport(kind, entries)` for `watched` | `watchlist` | `ratings`. It splits `entries` into chunks of 500 (the server cap), posts them sequentially, and returns `{added, skipped, failed}`. A rejected chunk adds its size to `failed` and the loop continues. `bulkMarkWatched` stays as a thin wrapper for compatibility, but its callers move to `bulkImport`. Per-entry `mediaType` is sent, so callers no longer split by type.

### D7. Import All flow (rewrite of `handleSubmit`)
1. Read the manifest (optional) and the CSVs with `parseBackupCSV`.
2. Fill in missing posters with `fetchMoviePoster`/`fetchTVPoster` (the axios TMDB client: correct base URL, throws on non-2xx), 10 concurrent, only for rows missing a poster. v2 backups normally have posters, so this mostly runs for v1 or hand-made files.
3. Run the sections **sequentially, each in its own try/catch**, collecting `{added, skipped, failed}` or an error per section:
   - watchlist → `bulkImport("watchlist")`
   - watched → `bulkImport("watched")`, with `watchedAt`, `runtimeMinutes` and `platform`
   - ratings → `bulkImport("ratings")`
   - lists:
     - resolve a name→id map from a fresh `fetchAllPages("/lists/")`, not the possibly stale context
     - for each manifest or file list, create it if missing using `createList`'s **returned** list (`useLists.createList` changes to return the created `UserList`)
     - post items in batches of 20 and count `201` as added, `200` as skipped, and rejected as failed
4. Reload the affected contexts: `reloadWatchlist`, `reloadWatched`, `reloadRatings` and `reloadLists`. `useWatchlist`/`useRatings` gain a `reload` by extracting their existing fetch effect into a `useCallback`, mirroring `useWatched.reload`. It's exposed on `AppContextType` as `reloadWatchlist`/`reloadRatings`.
5. Show one summary built from the actual numbers: `showSuccess` if nothing failed, otherwise a warning listing the failed sections.

Idempotence follows from create-only endpoints, `get_or_create` for list items, and matching lists by exact name.

### D8. Single-file imports: per-row type, reset, chunking
- `parseCSVForImport` also looks for a `type`/`media_type` column. Each row gets `type?: "movie" | "tv"`; anything else is treated as absent.
- Both modals compute `rowType = row.type ?? selectedType` for the poster lookup and the write.
- The radio label becomes "Default type".
- The preview table gets a Type column.
- `handleFileChange` always ends with `e.target.value = ""`, so the browser fires `change` again for the same file.
- `CSVUploadModal` uses `bulkImport("watched")` (chunked), and its toast includes `failed`.

### D9. Stable pagination order (folded in from backlog item 6 during apply)
The live check found that a 1,200-row import produced only 16 distinct `watched_at` values: Windows clock resolution, plus `timestamp_or_now` being called per row. Paging `order_by("-watched_at")` then returned 1,203 ids with only 1,170 distinct. So after a large import the UI's `fetchAllPages` showed duplicates and missed titles, even though the DB was correct. The four list endpoints from `fix-data-correctness`'s first bullet (watched, watchlist, ratings, followed people), plus `lists_list` (same pattern), now order by `(timestamp desc, id desc)`. The fix is one line each, and the user chose to fold it in here, since bulk imports are what make the ties common.

## Risks / Trade-offs

- **Changing `auto_now_add` → `default`** lets any code path that passes the field set it. → Only the bulk serializers expose it as writable. The single-item serializers keep it `read_only` (they already declare `addedAt`/`watchedAt`/`ratedAt` as `read_only=True`). Tests pin that a single POST with `watchedAt` ignores it.
- **Create-only rating import** means a backup can't "correct" a rating. → Intended: never overwrite (spec). Users can edit a rating in the UI.
- **Chunked imports aren't atomic across chunks.** A failure mid-import leaves earlier chunks written. → Re-running is idempotent, and the summary reports what failed.
- **A large v1 import still pays one TMDB poster lookup per row without a poster** (10 concurrent). → Unchanged from today and only for v1 or hand-made files. The `TmdbProxyThrottle` (120/min) may slow a very large v1 import. Lookups that fail leave the poster empty rather than failing the import.
- **Manifest/file mismatch in a hand-edited ZIP.** → A manifest entry whose file is missing is still created as an (empty) list. A CSV with no manifest entry falls back to its file name.

## Migration Plan

- Migration `0019_bulk_import_timestamps` (three `AlterField`s, no data change). Generate it with `G:/Anaconda/envs/django/python.exe manage.py makemigrations userdata`, and check `makemigrations --check` is clean afterwards.
- Deploy the backend before or with the frontend. The new frontend calls `/watchlist/bulk/` and `/ratings/bulk/`, and an old backend would 404 them; that's acceptable for this single-deploy app, since both ship together.
- Rollback: revert both. Existing v2 backups still import into an older app's v1 code path (extra files and columns ignored).

## Open Questions

- **Format decision (from the backlog), proposed here:** an additive v2 with `manifest.json` + `ratings.csv` + extra watched columns (D1). Confirm before applying, or adjust in the proposal.
