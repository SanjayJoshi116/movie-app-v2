## 1. Per-user date indexes

- [x] 1.1 Add `Meta.indexes` to `WatchedEntry`, `WatchlistEntry`, `RatingEntry`, `FollowedPerson`, `EpisodeProgress` and `UserList`: `(user, -<date>, -id)` matching each list view's `order_by`, reusing 0008's names and `list_user_date_idx` for lists (design decision 1)
- [x] 1.2 Generate the migration with `makemigrations` from the `DJANGO_PYTHON` interpreter (`DEBUG=True`); check it holds only `AddIndex` × 6 and a Django 5.2 header
- [x] 1.3 Test `test_list_indexes.py`: each list model has an index whose fields are `user` followed by its view's `order_by` fields; `makemigrations --check --dry-run` stays clean

## 2. Recommendations first save

- [x] 2.1 `save_recommendations`: take `pg_advisory_xact_lock(<namespace>, user.id)` inside the atomic block before the stored-row read; namespace as a named constant (decision 2)
- [x] 2.2 Test: with no stored row, a save with `started=t1` followed by a save with `started=t0 < t1` returns `SUPERSEDED` and leaves t1's result; plus a two-connection test (threads, `transaction=True`) showing the second save waits for the first's lock and sees its row

## 3. Account security

- [x] 3.1 `password_reset_confirm`: wrap `set_password`/`save`, `_revoke_all_refresh_tokens` and `_clear_login_failures` in `transaction.atomic()` (decision 3)
- [x] 3.2 Test: `_revoke_all_refresh_tokens` patched to raise `DatabaseError` → request fails, old password still checks, the same uid/token resets successfully afterwards
- [x] 3.3 `delete_account`: delete the user and `_clear_login_failures(failure_key)` in one `transaction.atomic()`, TMDB revoke still after it (decision 4)
- [x] 3.4 Test: failures recorded for `alice`, `alice` deletes her account, a new `alice` registers and signs in with her correct password → 200, not 429

## 4. Title-cache pruning

- [x] 4.1 Management command `prune_media_cache`: one `DELETE` of `TMDBMediaCache` rows with `cached_at` older than `CACHE_TTL_DAYS` and no `WatchedEntry` with the same `(media_id, media_type)`; prints the count (decision 5)
- [x] 4.2 `start.py`: `run_warmup([... "prune_media_cache"], timeout=60, label="prune_media_cache")` after `flushexpiredtokens`; `docker-entrypoint.sh`: `timeout 60 python manage.py prune_media_cache || echo "[cinedb] prune_media_cache skipped (failed or timed out after 60s)"`
- [x] 4.3 Tests: command deletes stale unwatched rows, keeps stale watched rows and fresh unwatched rows; `test_startup_warmup` covers the new step in both startup paths (order and bound)

## 5. Comments and docs

- [x] 5.1 Fix the `LoginFailure.key` comment (exact username) and `_revoke_all_refresh_tokens`' "never flushed" docstring (decision 6)
- [x] 5.2 CLAUDE.md: `start.py` pre-startup step list gains `prune_media_cache`; note that list-query indexes live in `Meta.indexes` (never in a migration alone)
- [x] 5.3 `docs/BUG_BACKLOG.md`: item 48 row → 📝 `fix-db-layer`, with session-id encryption left open and the backfill-placeholder finding marked false positive

## 6. Verify

- [x] 6.1 Backend: `pytest` (from `backend/`, `DEBUG=True`), `ruff check backend/`, `makemigrations --check --dry-run`
- [x] 6.2 Run `migrate` on the dev DB and `EXPLAIN` the watched list query for one user to confirm it uses `watched_user_date_idx` with no sort node
