## Context

Backend only. Motivation is in proposal.md and requirements in `specs/`. Current code (re-checked 2026-10-14):

- Both recommendation endpoints call `_start_refresh_if_needed` whenever `_is_stale(row)` (12 h on `computed_at`, an `auto_now` field). `save_recommendations` refuses a TMDB-damaged result, so `computed_at` doesn't move and every poll re-triggers. With no row at all, every poll triggers too. `request_refresh` coalesces only within one process, while a refresh is running.
- `_fill_media_cache(entries)` builds one `Q(media_id=…, media_type=…)` per entry, OR'd together, then fetches every missing or stale (older than 7 days) title on 10 workers.
- `metadata_backfill.backfill_entries` caps at `MAX_PER_RUN` (100), newest first, with in-process backoff for transient failures. It has no cross-run or per-user bound.
- `compute_recommendations` (the warm-up `start.py` runs with a 30 s timeout) iterates every user with watch history in default order and recomputes them all.
- `_spawn_refresh` starts an unbounded daemon thread per refresh. `request_refresh` adds the user to `_computing_users` before `_spawn_refresh`, so if `Thread.start()` raises, the slot is never released.
- CLAUDE.md's rules apply: worker threads do HTTP only, DB and `django.core.cache` stay on the calling thread, and counters must not use `DatabaseCache.incr`.

## Goals / Non-Goals

**Goals:**
- One TMDB outage costs at most one refresh per user per backoff period, across processes.
- No single refresh, and no single user per day, can spend an unbounded number of TMDB calls on the server's key.
- The warm-up uses its 30 s where it helps.
- Thread and connection use per process is bounded, and no stuck "pending".

**Non-Goals:**
- Recommendation quality fixes (28b).
- A global (all-users) TMDB budget. The per-user budget plus the per-user proxy throttle bound what one account can do. Many real users are expected load.

## Decisions

1. **Backoff marker in the `default` cache, set not incremented.**
   - When `save_recommendations` refuses a result, `_refresh_cache` does `cache.set(f"rec_refresh_backoff:{user_id}", 1, REFRESH_FAILURE_BACKOFF)` (600 s), on the refresh thread. That thread already does DB work, and the cache is DB-backed in production, which is fine there.
   - The endpoints skip `_start_refresh_if_needed` while the key exists. Both endpoints share a helper so their logic can't drift.
   - `request_refresh(..., rerun_if_running=True)` (data-change triggers) ignores the marker and clears it.
   - *Why the cache and not a column:* the no-row case needs the marker too, and a placeholder row would read as "ready, empty". The marker is tiny and per user, like the throttle counters, and losing it in a cull only allows one early retry. `set` with a timeout has none of `incr`'s expiry-reset problem.
   - *Alternative:* a `last_attempt_at` column on `UserRecommendationCache`. Rejected because of the no-row case.

2. **Fill cap and chunked lookup.**
   - `MAX_FILL_PER_RUN = 200`.
   - Existing rows are read per media type with `media_id__in=` in chunks of 1,000 instead of one OR'd `Q`.
   - Priority for fetching: no row first (newest watch first), then stale rows by oldest `cached_at`.
   - Unfetched stale rows are returned as-is, so they still count toward genres and cast. Missing ones are simply absent this run.
   - Being capped never calls `health.mark_failed()`. Fetch failures still do.

3. **Per-user daily budget: `TmdbTitleBudget(user OneToOne, day DateField, used PositiveInteger)`, in `tmdb_budget.py`.**
   - `take(user_id, n) -> granted` runs in `transaction.atomic()` with `select_for_update()` on the row. It creates the row if missing, resets `used` when `day` isn't today (UTC), grants `min(n, LIMIT − used)` and saves. It always runs on the calling thread.
   - `DAILY_TITLE_FETCHES = 1000`.
   - Both `backfill_entries` and `_fill_media_cache` take a grant before fetching and trim their batch to it. A grant smaller than needed is not a failure (like the per-run caps).
   - *Alternative:* the cache. Rejected: `DatabaseCache.incr` isn't atomic and resets the expiry, the exact pitfall CLAUDE.md documents for the login counter.
   - *Alternative:* a global set of known-missing ids. Rejected: an attacker just uses fresh random ids.
   - `backfill_entries(entries)` gets the user id from the entries (all one user's). An empty list or a mixed list never happens, but a mixed list would be charged per user.

4. **Warm-up order.**
   - Users with watch history, annotated with `rec_cache__computed_at`.
   - Exclude rows fresher than `RECOMMENDATIONS_TTL_HOURS`.
   - Order by `computed_at` ascending with nulls first, then id.
   - It still computes in-process (no threads) and still honors `save_recommendations`. The 30 s bound stays in `start.py`.

5. **Concurrency bound: `_refresh_slots = threading.BoundedSemaphore(MAX_CONCURRENT_REFRESHES)` (4).**
   - `_refresh_thread` acquires a slot before `_refresh_cache_by_id` and releases it in `finally`, before closing its connection.
   - Waiting threads haven't touched the DB, so they hold no connection.
   - *Alternative:* a `ThreadPoolExecutor(4)` for refreshes. Rejected: a semaphore keeps the existing per-user thread and stamp model unchanged. The status stamp is written before the wait, so polls read "pending" while queued, which is accurate.
   - Because of the wait, the stamp could age past `REFRESH_STATUS_WINDOW` (10 min) only with more than ~40 queued refreshes on one process. Accepted; the stamp is refreshed when the compute starts.

6. **Thread start failure.**
   - `_spawn_refresh` catches `RuntimeError` from `Thread.start()`, logs it, and calls `_finish_refresh(user_id)`, which discards the slot, pops `_own_stamp` and clears the matching stamp.
   - A queued rerun is dropped in that path, so it can't loop.

## Risks / Trade-offs

- **A user who genuinely needs more than 1,000 title fetches** (a 3,000-title library on a cold server) fills over several days. Recommendations still compute from what's cached. → Acceptable, and the cap is a constant.
- **A user with no stored result during an outage sees "taking longer than usual"** after the page stops polling, and Retry within the backoff does nothing new. → Accepted. The page already offers Retry, and after 10 minutes the next visit retries.
- **`select_for_update` on the budget row** serializes one user's background fetch batches. They are already single-flight per user, so there is no contention in practice.

## Migration Plan

Migration `0027_tmdbtitlebudget`: a new table, nothing backfilled. Rollback: revert, and the table is inert.
