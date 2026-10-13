## 1. Stats math (backend)

- [x] 1.1 Add `round_half_up()` in `stats_views.py`; use it for `avgUserRating`, `avgTmdbRating` and per-genre `avgRating`, and half-up integer rounding (clamped 1–10) for the distribution buckets
- [x] 1.2 Monthly activity: contiguous months from the first watch through the device's current month (or a later stored watch), zeros included; empty history → `[]`
- [x] 1.3 Average TMDB rating over `vote_average > 0` only; `None` when none qualify; confirm `StatsPage.tsx` renders `null` as "—"/hidden
- [x] 1.4 Backend tests (`backend/userdata/tests/`): 6.5/7.5 buckets, 0.5 → bucket 1, 7.0+7.5 → 7.3, 7.25 → 7.3 for a genre average, Jan+Jun gap filled through the current month, unscored titles excluded and all-unscored → `null`

## 2. Followed-people dedupe

- [x] 2.1 `social_views.followed_people_recommendations`: dedupe on `(id, media_type)`
- [x] 2.2 Test: a person credited on movie N and TV N gets both in their section

## 3. List bulk endpoint and timestamps (backend)

- [x] 3.1 `UserList.created_at` and `UserListItem.added_at` → `default=timezone.now`; generate the migration with `G:/Anaconda/envs/django/python.exe backend/manage.py makemigrations` and check `makemigrations --check --dry-run` is clean
- [x] 3.2 `bulk_import()`: add a `scope` kwarg (default `{"user": request.user}`) used by the existing-pairs pre-check; existing callers unchanged
- [x] 3.3 `POST /api/lists/<list_pk>/items/bulk/` in `lists_views.py` + `urls.py` (before the `<item_pk>` route): owner check → 404, `BulkWatchlistEntrySerializer` entries, `added_at` from `addedAt` or now
- [x] 3.4 `UserListSerializer`: `createdAt` writable on create only (past timestamp validators), ignored on update
- [x] 3.5 Tests: bulk list items keep `addedAt`, skip existing, 400 on a malformed entry with nothing written, 404 on another user's list, >500 entries rejected; list create with past `createdAt` stored, future → 400, update can't change it; list items still ordered newest first

## 4. Restore and CSV list import (frontend)

- [x] 4.1 `userApi.ts`: `bulkAddListItems(listId, entries)` chunking at 500, summing `{added, skipped}`, counting rejected chunks as failed; `useLists.createList(name, description, createdAt?)` sends `createdAt` only when given
- [x] 4.2 `backup.ts`: manifest lists carry `createdAt` on export; the reader passes a string `createdAt` through and tolerates its absence (older backups); unit tests for both
- [x] 4.3 `CSVImportAllModal.tsx`: create lists with `createdAt`, add items through `bulkAddListItems` with `addedAt` from `added_at`; undated rows sent in reverse file order; keep the per-section counts
- [x] 4.4 `CSVListImportModal.tsx`: same bulk path (undated rows reversed so the list shows file order); counts from the bulk responses
- [x] 4.5 Tests: a Jest test that the helper chunks 1,200 entries into 3 calls and sums counts; an e2e (or Jest) check that a CSV of A, B, C sends C, B, A so the list shows A, B, C; update any e2e mocks that relied on per-item `POST /lists/<id>/items/` for imports

## 5. Stats page (frontend)

- [x] 5.1 Rating by Genre bar `name="Avg rating"`; `CustomTooltip` prints the series name for non-count series
- [x] 5.2 Heatmap: `formatDateDMY` in its tooltip; info text "Counts the titles you marked watched each day."
- [x] 5.3 Heatmap keyboard: one tab stop, arrow keys follow the grid (Up/Down ±1 day, Left/Right ±1 week) clamped to shown days, visible active outline, bubble positioned from the active cell, `aria-live` announcement
- [x] 5.4 Top Genres empty text: "still being looked up" when there are watches, no For You link
- [x] 5.5 e2e (Stats page, mocked `/api/stats/`): genre tooltip says "Avg rating"; heatmap Tab → Up shows a `dd-mm-yyyy` date and count; Tab again leaves the heatmap; empty-genres text; a gap month renders as a point (monthly data with zeros passes through)

## 6. Verify and document

- [x] 6.1 `npm run typecheck`, `npm run lint`, Jest, `npx playwright test`, backend `pytest`, `ruff check backend/`, `makemigrations --check --dry-run`; keep `test_e2e_mock_shapes` green if Python `MOCK_*` stats dicts change
- [x] 6.2 Live check with `npm run dev` + Playwright: register a throwaway account, rate titles 6.5/7.5, see buckets 7/8 and the average; export a backup with a 3-day list, import into a second throwaway account, compare list order and dates; delete both accounts and any `verify_*` scripts
- [x] 6.3 `docs/ARCHITECTURE.md`: bullet for list bulk import + reversed undated rows and the half-up rounding; `CLAUDE.md` imports bullet mentions the list-items bulk endpoint; `docs/BUG_BACKLOG.md` item 20 status
