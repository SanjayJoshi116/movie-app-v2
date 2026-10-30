## Context

See proposal.md (Why). Current state of each piece:

- **Indexes.** `0008_add_indexes` added `(user, <date>)` indexes on five tables with `AddIndex` only; no model declared them, so the next `makemigrations` (0009, Django 4.2) generated `RemoveIndex` for all six. Today each list endpoint (`watched_views.py:19`, `watchlist_views.py:17`, `ratings_views.py:55`, `social_views.py:38,97`, `lists_views.py:18`) runs `filter(user=…).order_by("-<date>", "-id")` paginated at up to 500, and Postgres can only use the `(user, media_id, media_type)` unique index for the filter, then sort.
- **Recommendations save.** `save_recommendations` (`recommendations.py:735`) locks with `select_for_update().filter(user=user).first()`. With no row there is nothing to lock; `_set_refreshing_since` only `update()`s, so a new user has no row until the first save. `update_or_create` then lets the last writer win.
- **Password reset.** `password_reset_confirm` (`auth_views.py:311-318`) runs three writes outside a transaction; `ATOMIC_REQUESTS` is off. The `hash_password` token claim (`CHECK_REVOKE_TOKEN`) already rejects old refresh tokens after a password change, so the blacklist write is defense in depth; the gap is consistency, not an open session.
- **Account deletion.** `delete_account` (`auth_views.py:390`) deletes the user; `LoginFailure` is keyed by `sha256(username)` with no FK, so its row survives. `_clear_login_failures(key)` already exists (used by reset).
- **Title cache.** `TMDBMediaCache` is written by `_store_media_cache` and read only for watched entries (`_cached_rows`); a row past `CACHE_TTL_DAYS` (7) is refetched on use, but kept as the fallback when that refetch fails ("A failed TMDB fetch never replaces cached metadata").

## Goals / Non-Goals

**Goals:**
- Indexes that match the list queries and can't be dropped by a future `makemigrations`.
- A first recommendations save that obeys the same "newer compute wins" rule as later ones.
- All-or-nothing password reset; no failed-attempt carry-over to a reused username.
- A bounded `TMDBMediaCache`.

**Non-Goals:**
- `session_id` encryption (separate change).
- Re-adding `watched_user_year_idx`: no query filters or orders watched entries by `(user, release_year)`; Stats aggregates in Python over the user's rows.
- `CREATE INDEX CONCURRENTLY` (see Risks).

## Decisions

**1. Indexes declared in `Meta.indexes`, ordered like the queries.**
`models.Index(fields=["user", "-watched_at", "-id"], name="watched_user_date_idx")`, and the same shape for watchlist (`-added_at`), ratings (`-rated_at`), followed people (`-followed_at`), episode progress (`-updated_at`) and lists (`UserList`, `-created_at`, not in 0008 but the same query shape). Reuse 0008's names (all free since 0009) except for `UserList` (`list_user_date_idx`). Generated with `makemigrations` from the dev interpreter (Django 5.2), never hand-written, so the model and migration state agree. Including `-id` matches the tiebreaker, so Postgres reads the page in index order with no sort step.
*Alternative:* `(user, date)` only, as 0008 had. Postgres can scan it backward, but bulk imports create equal timestamps and the `-id` tiebreaker would still need a sort per group; the three-column index costs little more.
*Pin:* a test asserts each list model's `Meta.indexes` contains an index whose fields match its view's `order_by` prefixed by `user`, so a model edit that drops one fails the suite, and CI's `makemigrations --check` keeps the migration in step.

**2. Per-user advisory lock in `save_recommendations`.**
Inside the existing `transaction.atomic()`, first `SELECT pg_advisory_xact_lock(<namespace>, <user_id>)` (two-int form: a fixed namespace constant plus the user id, so it can't collide with the email lock's `hashtext` keys), then the existing read-compare-write. The lock serializes every save for a user whether or not a row exists, and is released at commit.
*Alternative:* `get_or_create` an empty row before locking. Rejected: an empty row reads as "computed, nothing to show" to `_recommendations_response` and the outage rule's section count until the compute finishes, changing visible behavior. *Alternative:* catch the race through `source_started_at` in a conditional `UPDATE … WHERE source_started_at IS NULL OR < started`. Works for updates but not for two concurrent inserts.
The project already uses a transaction-scoped advisory lock for the email race (`_email_taken_under_lock`), and the database is PostgreSQL in every environment, tests included.

**3. `transaction.atomic()` around the reset's three writes.**
`set_password` + `save`, `_revoke_all_refresh_tokens`, `_clear_login_failures` in one block. A failure rolls back the password, so the reset token (which hashes the password) stays valid, as the spec requires. The view returns the same 500 it would today; no new error message.

**4. Account deletion clears the key in the same transaction as the delete.**
`with transaction.atomic(): request.user.delete(); _clear_login_failures(failure_key)`. The TMDB revoke stays after it, in the background, as now. The `failure_key` is already computed at the top of the view.

**5. Cache pruning as a management command, run like `flushexpiredtokens`.**
New `prune_media_cache` command: delete `TMDBMediaCache` rows with `cached_at` older than `CACHE_TTL_DAYS` and no `WatchedEntry` with the same `(media_id, media_type)` (`~Exists(...)` subquery, one `DELETE`). `start.py` runs it through `run_warmup(..., timeout=60, label="prune_media_cache")` after `flushexpiredtokens`; `docker-entrypoint.sh` runs it under `timeout 60` with the same skipped message pattern. Watched titles are kept at any age because their stale row is the outage fallback; unwatched ones can only be refetched on use, so deleting them loses nothing.
*Alternative:* prune inside each recommendations refresh. Rejected: puts a global delete on a per-user background path.
*Alternative:* delete unreferenced rows regardless of age. Rejected: a title just unwatched and re-marked within the week would refetch needlessly.

**6. Comments.** `models.py` `LoginFailure.key`: "sha256 of the exact username". `_revoke_all_refresh_tokens`: expired rows are flushed at startup; the `expires_at` filter still keeps the query to live tokens between restarts.

## Risks / Trade-offs

- [Index build locks writes on large tables during migrate] → Migrations run at container start before gunicorn, so no requests are served meanwhile; at this app's size (thousands of rows per user) the build takes seconds. `CONCURRENTLY` would need a non-atomic migration and `AddIndexConcurrently`, which isn't worth it here.
- [Advisory lock wait] → Only concurrent saves for the same user wait, and a save is one short transaction.
- [Pruning races a refresh writing the same row] → The `DELETE` and `_store_media_cache`'s `update_or_create` are each atomic; worst case a just-written row for a title watched seconds ago is deleted and refetched next refresh.
- [Tests on the reset rollback need a forced DB error] → Patch `_revoke_all_refresh_tokens` to raise `DatabaseError` and assert the password and token are unchanged (needs `transaction=True` or a check after the atomic block rolls back under the test's outer transaction; the savepoint is enough).

## Migration Plan

One schema migration (`AddIndex` × 6), no data change. Rollback: reverse the migration (drops the indexes) and revert code; nothing else persists.
