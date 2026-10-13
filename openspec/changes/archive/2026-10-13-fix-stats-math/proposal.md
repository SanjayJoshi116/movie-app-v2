## Why

Backlog item 20, from the 2026-10-09 audits, collects small ways the Stats page and list restores are quietly wrong:
- Ratings land in uneven buckets because of banker's rounding.
- The monthly chart skips empty months.
- Unknown TMDB scores drag the average down.
- A followed person's TV show disappears when it shares an id with a movie.
- A backup restore scrambles list dates and order, and spends one request per list item.

Each is low severity, but together they make Stats and restores untrustworthy.

## What Changes

- **Rounding:** every Stats average (`avgUserRating`, `avgTmdbRating`, per-genre `avgRating`) and the rating-distribution buckets round half up (6.5 → 7, 7.25 → 7.3), not half to even.
- **Monthly activity:** contiguous months from the first watch through the current month, with `0` for empty months.
- **Average TMDB rating:** leaves out titles stored with no score (`vote_average` ≤ 0). With none scored, it is `null`.
- **Followed-people recommendations:** dedupe on `(id, type)`, so a movie and a TV show with the same TMDB id both survive.
- **Stats page labels:**
  - The Rating-by-Genre tooltip says "Avg rating", not the raw `avgRating` key.
  - The heatmap tooltip shows `dd-mm-yyyy`.
  - The heatmap can be read from the keyboard: one tab stop, arrow keys move between days, and the focused day is announced.
  - The heatmap's info text says it counts watches. It currently claims ratings and list adds, which the backend never counts.
  - The Top Genres empty text no longer sends the user to For You, since Stats backfills genres itself.
- **List restores keep dates and order:**
  - A new bulk endpoint `POST /api/lists/<id>/items/bulk/` goes through `bulk_import()`, so it is create-only, all-or-nothing and up to 500 entries. Each entry may carry `addedAt`.
  - Creating a list accepts an optional past `createdAt`.
  - `UserList.created_at`/`UserListItem.added_at` move from `auto_now_add` to `default=timezone.now`, with a migration.
  - The backup manifest gains each list's `createdAt` (additive), and the restore sends it.
  - The backup restore and the per-list CSV import both use the bulk endpoint, in chunks of 500. A CSV with no dates keeps its file order as the list's display order.

## Capabilities

### New Capabilities
- `watch-stats`: what the Stats endpoint computes (rounding, monthly range, which scores count in averages) and how the Stats page labels it.

### Modified Capabilities
- `data-backup`:
  - "Restoring a backup is faithful" now covers list creation dates, item added dates and item order.
  - "Bulk imports keep supplied timestamps…" adds list items.
  - Added: a per-list CSV import keeps its file order.
- `input-validation`: "Bulk watched entries are each validated" adds the bulk list-items endpoint and the optional `createdAt` on list creation.
- `recommendation-sections`: added that followed-people sections keep a movie and a TV show sharing an id.
- `accessibility`: added that the activity heatmap is keyboard-readable.

## Impact

- **Backend:**
  - Endpoints and views: `stats_views.py`, `social_views.py`, `lists_views.py`, `urls.py`, `bulk_import.py` (a scoping hook, because list items aren't keyed by `user`).
  - Models and validation: `serializers.py`, `models.py` plus a new migration for the two defaults.
- **Frontend:**
  - Pages and import modals: `StatsPage.tsx`, `lists/CSVImportAllModal.tsx`, `lists/CSVListImportModal.tsx`.
  - Data code: `utils/backup.ts` (manifest `createdAt`), `api/userApi.ts` (bulk list items), `hooks/useLists.ts` (`createList` with an optional `createdAt`).
- **API:** additive only. There is one new route and one new optional field, and older clients and older backups keep working.
- **Throttle:** a 2,000-item list restore drops from 2,000 requests to 4.
- **Out of scope:** the overlapping restore bugs in item 24 (same-name list merge, the reload-failure message, follows and episode progress in backups, throttled posters).
