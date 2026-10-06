## Why

"Export All" followed by "Import All" is supposed to restore a library, and today it doesn't.
- **Import All crashes** whenever the backup has a list that doesn't exist yet. It calls `.find` on the paginated `/lists/` response. By then the watchlist and watched data is already written and an empty list created, so re-running makes duplicates.
- **What survives a restore is incomplete:**
  - The export has no ratings or reviews, and no watched runtime or platform. The import drops `watched_at`, so a restore wipes all ratings and the whole stats history: every title looks watched "today".
  - List names with `/ \ ? % * : | " < >` come back mangled, and empty lists are left out.
  - A review or title containing a newline would split the row in two on import.
- **The success toast is wrong:**
  - It reports parsed counts, not what was saved.
  - The watchlist loop isn't awaited, so failures are silent.
  - Poster lookups use a raw `fetch('/api/tmdb/...')` that bypasses the API base URL (so it fails in dev) and never checks `res.ok`.
- **The single-file CSV imports:**
  - force one media type on every row
  - don't accept `;`-delimited files
  - fail on more than 500 rows
  - can't re-read the same file after an error
- **Backend:** bulk import never refreshes recommendations, because `bulk_create` sends no `post_save`.

This is item 2 of `docs/BUG_BACKLOG.md`, next in the suggested order.

## What Changes

- **Backup format v2:**
  - The ZIP gains a `manifest.json` (format id, version, export time, and for each list its file name, original name and description, including empty lists) and a `ratings.csv` (id, type, title, rating, review, rated time).
  - `watched.csv` gains `runtime_minutes` and `platform` columns.
  - Every new piece is optional on import, so **v1 backups (no manifest) still import** exactly as before. Old app versions importing a v2 file just ignore what they don't know.
- **Faithful restore:**
  - Import keeps each item's original `watched_at` / `added_at` / `rated_at`, watched runtime and platform, ratings with reviews, and list names, descriptions and empty lists.
  - Existing entries are never overwritten; an existing rating is kept as is.
  - Re-running the same import creates no duplicates.
- **Accurate, resilient import:**
  - Every write is awaited.
  - Each section (watchlist, watched, ratings, each list) reports what it actually added, skipped and failed, and the final message reflects those numbers.
  - A failed section doesn't stop the others.
  - New lists are looked up from the create response, not from a paginated GET.
  - Poster lookups go through the shared TMDB API client.
- **Bulk endpoints:**
  - `POST /watched/bulk/` accepts per-entry `mediaType`, `watchedAt`, `runtimeMinutes` and `platform`.
  - New `POST /watchlist/bulk/` and `POST /ratings/bulk/`, with the same validation and all-or-nothing rules. They are create-only (existing entries are skipped) and keep supplied timestamps; timestamps in the future are rejected.
  - Bulk rating import doesn't push to a connected TMDB account.
  - The frontend sends imports in chunks of at most 500 entries.
- **Recommendations:** a bulk watched import that adds at least one title schedules one recommendation refresh, through the existing coalescing `request_refresh` path.
- **Bulk counts:** the existing-entries check and the insert run in one transaction.
- **Stable pagination (added during apply, from backlog item 6):** the watched, watchlist, ratings, followed-people and lists endpoints add an `id` tiebreaker to their timestamp ordering. Bulk imports give many rows the same timestamp, and without the tiebreaker, paging returned duplicates and skipped rows.
- **CSV parsing:**
  - one RFC 4180 parser for every import: quoted commas, quotes and newlines, CRLF, a UTF-8 BOM, and `,` / `;` / tab delimiters detected from the header
  - export escapes `\r` too
- **Single-file CSV imports** (watched, list):
  - a `type`/`media_type` column, when present, sets each row's type
  - the Movies/TV selector becomes the default for rows without one
  - the preview shows the type
  - the file input resets after every read, so re-selecting the same file works
- **Schema:** `WatchlistEntry.added_at`, `WatchedEntry.watched_at` and `RatingEntry.rated_at` change from `auto_now_add` to `default=timezone.now`. Single-item creates behave exactly as before; only the bulk import supplies a value.

## Capabilities

### New Capabilities
- `data-backup`: exporting a user's whole library to a backup file and restoring it, plus importing titles from CSV files. Covers backup contents and format compatibility, faithful and idempotent restore, accurate result reporting, CSV parsing rules, per-row media type, bulk import limits, and the recommendation refresh after an import.

### Modified Capabilities
- `input-validation`: "Bulk watched entries are each validated" now names the new optional per-entry fields (media type, watched time, runtime, platform), and the same rules apply to the new bulk watchlist and rating endpoints.

## Impact

- **Frontend:**
  - `src/utils/export.ts`, `src/utils/csvParse.ts` (parser rewrite)
  - `src/components/lists/CSVImportAllModal.tsx` (rewrite of the import flow), `src/components/CSVUploadModal.tsx`, `src/components/lists/CSVListImportModal.tsx`
  - `src/api/userApi.ts` (bulk helpers + chunking)
  - `useWatchlist.ts` / `useRatings.ts` (new `reload`), `useLists.ts` (`createList` returns the list), `types/context.ts`, `useAppContext.ts`, and `ProfileModal.tsx` (passes ratings to export)
- **Backend:**
  - `serializers.py` (bulk entry serializers)
  - `watched_views.py`, `watchlist_views.py`, `ratings_views.py` (bulk endpoints), `urls.py`
  - `signals.py` (shared refresh helper), `models.py` + one new migration (`0019`, `AlterField` ×3, no data change)
- **API:**
  - two new endpoints
  - `POST /watched/bulk/` gains optional fields
  - no change to existing response shapes
- **Data:** none migrated. Existing backups remain importable.
- **Tests:**
  - backend tests for the bulk endpoints (timestamps, skip-existing, counts, refresh scheduling)
  - frontend unit tests for the CSV parser and the backup build/parse round trip
- **Out of scope:**
  - partial-success bulk imports (all-or-nothing stays, per `harden-input-validation`)
  - spreadsheet formula escaping in exports
  - pushing imported ratings to TMDB
