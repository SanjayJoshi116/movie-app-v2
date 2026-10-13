## Context

The findings and the two decisions are in `proposal.md`. Today's state:

- **Backup files.** `backup.ts` writes `watchlist.csv`, `watched.csv`, `ratings.csv`, `lists/*.csv` and `manifest.json` (version 2). `readBackupZip` falls back to the v1 rules when there's no manifest. Export takes its data from the library contexts that `ProfileModal` already holds.
- **Follows and progress.**
  - Follows live in `FollowedPeopleProvider`, which fetches lazily and has `error`/`retry()`.
  - Episode progress has only a per-show endpoint (`/episode-progress/<show_id>/`).
  - `FollowedPerson.followed_at` is `auto_now_add`, and `EpisodeProgress` is unique on `(user, show_id)`.
- **`bulk_import()`** keys entries on `(mediaId, mediaType)`. It pre-checks existing rows inside a transaction, then calls `bulk_create(ignore_conflicts=True)` and reports `added = len(to_create)`. A row a concurrent request inserted first is counted as added.
- **Poster lookups.**
  - `CSVUploadModal` and `CSVListImportModal` look up every row, 20 at a time.
  - `CSVImportAllModal.enrichPosterPaths` looks up rows without a poster, 10 at a time.
  - The proxy is `TmdbProxyThrottle` at 120/min per user, and DRF's 429 carries `Retry-After`. `api/tmdb.ts` doesn't retry, and every caller swallows the error.
- **CSV import parsing.** `parseCSVForImport` keeps id, title and type. `parseBackupCSV` already reads `watched_at` and `watched_tz`.

## Goals / Non-Goals

**Goals:**
- A backup restores follows and progress, older backups still import, and Export All stays fail-closed.
- Imports never silently lose posters to the throttle, and say when a poster is missing.
- The Watched CSV round trip keeps dates and zones.
- Same-name lists stay separate.
- Bulk counts are exact.

**Non-Goals:**
- Server-side poster filling (rejected in the decision).
- Restoring episode-progress update times.
- Exporting followed people's credits or notifications state (derived data).
- Changing the per-user throttle rate.

## Decisions

### 1. Backup v3 adds two CSVs, and older readers skip them
- **New files.**
  - `followed.csv`: `person_id,name,profile_path,followed_at`
  - `episode_progress.csv`: `show_id,season,episode`
- **Writing.** Both are always written, header-only when empty, the same as the other files. `BACKUP_VERSION = 3`.
- **Reading.** `readBackupZip` returns `followed: []` and `episodeProgress: []` when the files are absent (v1 and v2 backups). Both count toward "has data", so a backup with only follows still imports.
- **Older versions of the app** ignore unknown files, so a v3 backup still restores its v2 content there. Format changes stay additive, per CLAUDE.md.

### 2. Export fetches the two new parts at click time, never from a lazy provider
`handleExportAll` reads the four context parts as today, then:
- fetches `fetchAllPages("/followed-people/")` and `fetchAllPages("/episode-progress/")`
- if either fails, sets `exportBlocked` to name it (for example "followed people") and produces no file; the existing Retry button re-runs the export

Why: `FollowedPeopleProvider` is deliberately lazy (CLAUDE.md: making it eager adds a mock to every e2e base fixture), and episode progress has no context at all. Reading both at click time keeps the export fail-closed without new always-on fetches.

### 3. New endpoints follow the existing patterns
- **`GET /api/episode-progress/`** returns `DefaultPagination` over `{showId, season, episode, updatedAt}`, ordered by `-updated_at, -id`. That's the tiebreaker rule for timestamp ordering. The existing `episode-progress/<int:show_id>/` route is unchanged.
- **`POST /api/followed-people/bulk/`** takes entries `{personId, name, profilePath?, followedAt?}`. **`POST /api/episode-progress/bulk/`** takes entries `{showId, season, episode}`. Both go through `bulk_import()`, so they're create-only, all-or-nothing, capped at 500, and timestamps can't be in the future.
- **The list response adds `followedAt`.** The TS `FollowedPersonEntry` type and the Python and TS e2e mocks get it too, and `test_e2e_mock_shapes` enforces that.
- **Migration 0024** switches `FollowedPerson.followed_at` to `default=timezone.now`, the same change 0023 made for lists. It's a field-default change only, with no data migration.

### 4. `bulk_import()` gets a pluggable identity and exact counts
- **Identity.** A new `identity` parameter: a pair `(entry_field, model_field)`, or `None` for today's media default. With an identity, de-duplication and the existing-row check use that single id, and the "entry without an id is skipped" rule reads that field. Media-keyed callers don't change.
- **Exact counts.** `bulk_create(ignore_conflicts=True)` is replaced by `insert_ignoring_conflicts(model, objs) -> int`. It builds one `INSERT … ON CONFLICT DO NOTHING RETURNING 1` from the model's concrete fields, with values from `field.get_db_prep_save()`, and returns the number of rows Postgres actually inserted. `added` is that number, and `skipped = len(unique) - added`.
- Rejected:
  - one savepoint per row: 500 round trips
  - re-counting after the insert: a concurrent row lands in the same count, so it's still wrong
  - leaving the race: the spec says the counts are exact

### 5. One shared pacer for import lookups
`src/utils/pacedLookup.ts` exports `pacedLookup(items, lookup, { onProgress })`. It returns `{ results, missing }`.
- **Rate.** A module-level token bucket at 90 requests/min (below `tmdb_proxy: 120/min`, leaving about 30/min for browsing), with at most 4 in flight.
- **A `429`** is retried after `Retry-After` seconds (10 s when the header is missing), at most 3 times per item, while the bucket keeps everyone else paced.
- **A `404`** (unknown id) is final, with no retry.
- **Other failures** are retried once.
- **The result.** An item whose lookup finally fails is counted in `missing`. Its row is still imported, without a poster.

The three dialogs switch from their own batching loops to this. Each shows `Looking up posters: n / total` while it runs, and the result toast or alert adds "N saved without a poster" when `missing > 0`.

Why a bucket in the browser: the throttle is per user, and the alternative, server-side filling, was declined. A 300-row CSV with no posters takes about 3.5 minutes at 90/min. That's slow but complete, and the progress line makes the wait visible.

### 6. The Watched CSV import reads dates when present
`parseCSVForImport` gains optional `watchedAt`/`watchedTz` per row. The columns are matched by the header names the Watched page exports (`watched_at`, `watched_tz`).
- A value that `Date` can't parse, or a time in the future, is left out for that row, and the server then uses the import time.
- An unknown zone name is passed through, because the server stores unknown names blank.

`CSVUploadModal` sends both fields. `CSVListImportModal` ignores them, since list items have no watched time.

### 7. Lists match only lists that existed before the import
In `importLists`, `idByName` is built once from the fresh pre-import read and never updated during the run. A list created in this run is used only for its own items. The preview tags use `key={index}`.

## Risks / Trade-offs

- **Slow big imports.** A pacer at 90/min makes a large CSV import take minutes. → A progress line is shown, and rows that already have a poster (backups) skip the lookup.
- **Raw SQL insert.** The `INSERT … RETURNING` helper is Postgres-specific raw SQL. → The project runs only on PostgreSQL (dev, tests and Docker). The helper builds columns from model metadata and is covered by `test_bulk_import` for every bulk model, so a model change can't silently diverge.
- **Restored episode progress loses its update time.** → `updated_at` is `auto_now`, and nothing in the UI orders by it.
- **A v3 backup in an older app version** drops follows and progress silently there. → Expected, since that version can't restore them. The forward direction (older backup into the new app) is what the spec guarantees.
- **The export's two extra fetches** add a second or so before the file downloads. → They're paged at the default 100 and done once per click.
