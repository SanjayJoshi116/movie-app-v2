## Context

See proposal.md for the findings (backlog item 53). The library views are function views over PostgreSQL, one connection per request thread (gthread workers in production, `runserver` threads in dev). Two advisory-lock patterns already exist: `pg_advisory_xact_lock(hashtext(email))` in registration and `pg_advisory_xact_lock(SAVE_LOCK_NAMESPACE, user_id)` in `save_recommendations`. Rating sync to TMDB runs in the request after the local save, bounded by `TMDB_CALL_DEADLINE`, so TMDB sees changes in order (`ratings` spec).

## Goals / Non-Goals

**Goals:** close the ten verified findings with the smallest change per finding; keep every existing spec scenario passing.

**Non-Goals:** paginating list items inside `GET /lists/` (the user chose caps only); a schema migration (limits are counted, not stored); changing how the frontend loads the library.

## Decisions

### 1. Rating writes: a session-level advisory lock per user and title, held through the TMDB sync
`ratings_list` POST and `ratings_detail` PATCH/DELETE take `pg_advisory_lock(RATING_LOCK_NAMESPACE, hashtext('<user_id>:<type>:<media_id>'))`, then run the read-compare-write in `transaction.atomic()` (committed before the sync), then sync, then `pg_advisory_unlock` in `finally`. PATCH/DELETE look the row up by pk first (scoped to the user, 404 as now), take the lock, then re-read the row.

- Why session-level, not `_xact_`: the sync must come after the commit (a killed request must never leave TMDB with a score the app rolled back), yet a second write must wait until the first one's sync is sent, or the two syncs can still reach TMDB in the wrong order. Only a lock that outlives the transaction covers both.
- Why not `select_for_update` alone: it ends at commit, before the sync, so it fixes the stale compare but not the sync order; and it can't lock a row that doesn't exist yet (first rating).
- Why per title, not per user: a slow TMDB holds the lock up to the 10 s deadline, and other titles shouldn't wait for it. `hashtext` collisions only add rare extra waiting.
- A broken connection drops session locks with it, so a crash between lock and unlock can't leave one held.

### 2. Limits: one module, checked under a per-user transaction lock
New `backend/userdata/library_limits.py`: `LIMITS` (watched, watchlist, ratings 20,000; lists 200; items per list 2,000), `lock_user(user_id)` (`pg_advisory_xact_lock(LIMIT_LOCK_NAMESPACE, user_id)`) and `room(model, scope)` (limit − current count, never below 0). Single adds: inside `atomic()`, lock, check the entry doesn't already exist (an update is never refused), then refuse with 400 `{"detail": "Your <collection> is limited to N titles."}` when `room == 0`. `getApiError` already shows `detail`.

`bulk_import` takes a `limit` (the collection's), locks the user in its existing transaction, and inserts only the first `room` of the entries it would create (request order, so a file's first rows win); the rest are `overLimit`. List items use the per-list limit; the lock is still the user's (one user's writes are what race).
- Alternative: a DB trigger or a stored counter. Rejected: needs a migration and a second source of truth for a count PostgreSQL can do on an indexed `user_id`.
- Rows already above a limit stay; only adds are refused.

### 3. Bulk counts
`ignored` = entries without an id; `skipped` = valid entries − `added` − `overLimit` (covers in-request repeats and already-present titles, and rows a concurrent request inserted first). The response becomes `{added, skipped, ignored, overLimit}`. `bulkImport()` sums all four; `BulkImportResult` gains `ignored` and `overLimit`, and the import dialogs' result text adds "N without a TMDB id" and "N not added: <collection> is full" when non-zero.

### 4. Account deleted during a bulk import
Django's PostgreSQL FKs are `DEFERRABLE INITIALLY DEFERRED`, so the missing user surfaces as `IntegrityError` when `bulk_import`'s `atomic()` exits. `bulk_import` catches it there; if the user row no longer exists it returns 401 `{"detail": ...}` (the session is gone), otherwise re-raises. `list_items_bulk` keeps its own list-gone → 404 handling, checked first.

### 5. Single-item fields and reviews
- `posterPath`/`voteAverage` on the three single serializers get `required=False` (poster `default`-less, so the view's `.get("poster_path")` → None and `.get("vote_average", 0)` apply).
- Rating POST uses `update_or_create(defaults=…, create_defaults=…)` (Django 5.0+): `review` is in `defaults` only when sent, and `create_defaults` always carries it (`""` when absent).
- `BulkRatingEntrySerializer.review` drops `trim_whitespace=False`. The 0.17.0 round-trip reason no longer holds: every review the app itself stores is already trimmed, so only hand-edited files lose end whitespace.

### 6. Watched clear
`watched_clear` deletes with `QuerySet._raw_delete(using)` (one `DELETE`, no per-row `post_delete`) and calls `schedule_refresh(user.id)` once. Safe only because nothing references `WatchedEntry` (no cascades to run); a comment says so, and a test asserts the model has no reverse relations so adding one later fails loudly. Alternative: suppress the signal with a flag and keep `.delete()` — still loads every row.

### 7. Blank titles on the frontend
`mediaLabel(title, id)` in `src/utils/mediaLabel.ts` (`title.trim() || "Untitled (#<id>)"`), mirroring `personLabel`. Used wherever a stored library title is rendered or put in an accessible name: `LibraryItemCard` and its callers' labels, the rating views, list detail, Home's recently watched strip. Server keeps accepting blank bulk titles (rejecting would fail a whole 500-row chunk).

### 8. `views.py`
`urls.py` imports each view from its domain module; tests that import `userdata.views` switch to the domain modules; `views.py` is deleted; `watched_views.py` drops the `MAX_BULK_ENTRIES` re-export (tests import it from `bulk_import`).

## Risks / Trade-offs

- [A second rating write for one title waits for the first one's TMDB sync, up to the 10 s deadline] → Same title, same user, same moment only; the wait plus its own sync stays within the gunicorn timeout budget pinned for the rating endpoint (≤ 2 × `TMDB_CALL_DEADLINE`), which a test asserts.
- [Session-level lock left held if `pg_advisory_unlock` is skipped] → `try/finally`; and `CONN_MAX_AGE` reuse means a leak would persist, so the test checks `pg_locks` is empty after an exception in the sync.
- [`_raw_delete` is private Django API] → One call site, pinned by a test that clears and checks the count and the single refresh; `test_dependency_versions.py` already pins Django's minor version.
- [Limit count costs one `COUNT(*)` per add] → Indexed on `user_id`; adds are interactive-rate.
- [Users above a limit after a big past import] → Nothing removed; they just can't add until under it.
