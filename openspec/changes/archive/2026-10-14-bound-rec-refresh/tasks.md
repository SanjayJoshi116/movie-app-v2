## 1. Failure backoff

- [x] 1.1 `recommendations.py`: `REFRESH_FAILURE_BACKOFF = 600`; `_refresh_cache` sets `rec_refresh_backoff:<id>` in `default` when `save_recommendations` refuses; a shared endpoint helper skips the stale-trigger while the key exists; `request_refresh(rerun_if_running=True)` clears it and always runs
- [x] 1.2 Tests: refused save → polls within the window start no refresh and return stored sections as ready; no-row case stays pending without re-triggering; a watched-change signal still triggers; after the window a stale poll triggers (cache key expiry simulated)

## 2. Fill cap and chunked lookup

- [x] 2.1 `_fill_media_cache`: per-type `media_id__in` chunks of 1,000; fetch at most `MAX_FILL_PER_RUN` (200), missing first (newest watch), then stale by oldest `cached_at`; unfetched stale rows kept; cap never marks failure
- [x] 2.2 Tests: 250 uncached titles → 200 fetches, result saved (health not failed); stale ordering; stale unfetched rows still used for genre counts; no OR-per-entry query (assert query count or SQL shape)

## 3. Per-user daily budget

- [x] 3.1 `TmdbTitleBudget` model + migration `0027` (project Django env); `tmdb_budget.take(user_id, n)` with `select_for_update`, UTC day reset, `DAILY_TITLE_FETCHES = 1000`
- [x] 3.2 `backfill_entries` and `_fill_media_cache` take a grant before fetching and trim to it; a short grant isn't a failure
- [x] 3.3 Tests: `take` grants up to the limit, resets next day, concurrent takes never exceed it (two threads, transactional test); clear+import loop stops at the budget; budget exhausted mid-refresh → result still saved

## 4. Warm-up order

- [x] 4.1 `compute_recommendations`: skip fresh rows, order no-row first then oldest `computed_at`
- [x] 4.2 Test: fresh users skipped (no compute call); order is no-row, oldest, newer-stale

## 5. Refresh concurrency and start failure

- [x] 5.1 `BoundedSemaphore(MAX_CONCURRENT_REFRESHES=4)` acquired in `_refresh_thread` before work
- [x] 5.2 `_spawn_refresh`: on `RuntimeError` from `start()`, log and `_finish_refresh` without rerun
- [x] 5.3 Tests: with compute blocked, at most 4 run concurrently and all finish after release; `Thread.start` raising leaves the user not in `_computing_users` and its stamp cleared

## 6. Docs and verification

- [x] 6.1 CLAUDE.md: refresh-trigger rule gains the backoff marker and semaphore; any background TMDB title fetch for a user goes through `tmdb_budget.take`; fill cap
- [x] 6.2 `docs/ARCHITECTURE.md`; CHANGELOG `[Unreleased]` (deploy note: migration 0027); `features.txt` ("can't flood TMDB"); README test list; `docs/BUG_BACKLOG.md` item 28 split into 28a (this, 📝) and 28b (⏳)
- [x] 6.3 `ruff check backend/`, `makemigrations --check --dry-run` (DEBUG=True), full backend pytest
