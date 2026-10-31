## 1. Ratings (design 1, 5)

- [x] 1.1 Add a per-user-and-title session advisory lock helper (`RATING_LOCK_NAMESPACE`, `try/finally` unlock) and wrap `ratings_list` POST and `ratings_detail` PATCH/DELETE: lock → `atomic()` read-compare-write → commit → TMDB sync → unlock; PATCH/DELETE re-read the row after locking
- [x] 1.2 Rating POST: `review` in `defaults` only when sent, always in `create_defaults` (`""` when absent)
- [x] 1.3 `BulkRatingEntrySerializer.review`: drop `trim_whitespace=False`
- [x] 1.4 Tests: two threads rating one title (7 stored; 8 and 7 sent) end with TMDB's last synced score equal to the stored one; lock released after a sync exception (`pg_locks` empty); POST without review keeps it, new rating without review is `""`; restored "Great " stored as "Great" and an unchanged PATCH keeps `rated_at`; rating endpoint worst case (lock wait + own sync) pinned under the gunicorn `--timeout`

## 2. Library limits (design 2)

- [x] 2.1 Add `backend/userdata/library_limits.py`: `LIMITS`, `lock_user(user_id)` (`pg_advisory_xact_lock(LIMIT_LOCK_NAMESPACE, user_id)`), `room(model, scope)`, and the 400 message per collection
- [x] 2.2 Single adds (watchlist, watched, rating, list, list item): inside `atomic()`, lock the user, skip the check when the entry already exists, else refuse at `room == 0`
- [x] 2.3 `bulk_import(limit=…)`: lock the user in its transaction, insert only the first `room` of the new entries, report the rest as `overLimit`; pass each collection's limit (per-list for list items)
- [x] 2.4 Tests: under/at limit for each collection, update at the limit allowed, two concurrent adds at 19,999 store exactly one, bulk crossing the limit (19,900 + 500 → 100 added, 400 over), rows already above a limit still readable and deletable (use a lowered limit via `override`/monkeypatch, not 20,000 real rows)

## 3. Bulk import counts and deleted account (design 3, 4)

- [x] 3.1 `bulk_import` returns `{added, skipped, ignored, overLimit}`: `ignored` = entries without an id, `skipped` = valid − added − overLimit
- [x] 3.2 Catch the deferred-FK `IntegrityError` at `bulk_import`'s commit: user gone → 401, else re-raise; keep `list_items_bulk`'s list-gone → 404 first
- [x] 3.3 Tests: 500-entry chunk with 20 no-id and 10 repeats → 470/10/20/0; account deleted between validation and commit → 401 and no rows
- [x] 3.4 Frontend: `bulkImport()` and `BulkImportResult` (`src/api/userApi.ts`, `src/types/domain.ts` DTO) carry `ignored` and `overLimit`; the three import dialogs and backup restore show "N without a TMDB id" and "N not added: <collection> is full" when non-zero; Jest tests for the sums and messages

## 4. Single-item fields (design 5)

- [x] 4.1 `posterPath`/`voteAverage` `required=False` on `WatchlistEntrySerializer`, `WatchedEntrySerializer`, `UserListItemSerializer`; confirm the views' fallbacks (`None`, `0`) apply
- [x] 4.2 Tests: each single add without either field succeeds with null poster / 0 score; a sent bad value still 400s

## 5. Watched clear (design 6)

- [x] 5.1 `watched_clear`: `_raw_delete` in one statement + one `schedule_refresh(user.id)`, with a comment on why it's safe
- [x] 5.2 Tests: clear returns the count, schedules exactly one refresh; `WatchedEntry` has no reverse relations (fails if one is added)

## 6. Blank titles (design 7)

- [x] 6.1 Add `src/utils/mediaLabel.ts` (`mediaLabel(title, id)`) with a Jest test
- [x] 6.2 Use it wherever a stored library title is shown or named: `LibraryItemCard` and its callers (Watchlist, Watched, List detail), ratings displays, Home's recently-watched strip, and any other stored-title render found by grep
- [x] 6.3 Test: a library card with a blank title reads "Untitled (#603)" and its buttons are named after it

## 7. Cleanup (design 8)

- [x] 7.1 `urls.py` imports from domain modules; delete `views.py`; tests import from domain modules; drop the `MAX_BULK_ENTRIES` re-export in `watched_views.py`
- [x] 7.2 Grep for any remaining `userdata.views` / `from .views` import (runtime and tests)

## 8. Docs and checks

- [x] 8.1 CLAUDE.md: library limits and the rating lock (short, under Imports/Conventions); `docs/ARCHITECTURE.md`: why the rating lock is session-level; README endpoint notes if bulk response shape is documented there
- [x] 8.2 E2E mocks: bulk responses in `e2e/` and `e2e/python` mocks carry the new fields if `test_e2e_mock_shapes.py` or the DTO check needs them
- [x] 8.3 Run backend pytest, `ruff check backend/`, `makemigrations --check --dry-run` (expect no migration), Jest, `npm run lint`, `npm run typecheck`, and the e2e specs touching imports and library cards
- [x] 8.4 Backlog item 53: mark each finding fixed and link the change
