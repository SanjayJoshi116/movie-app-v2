## Context

See proposal.md. Current state, re-checked 2026-10-08:
- `valid_tz_name` catches only `ZoneInfoNotFoundError`/`ValueError`. `ZoneInfo("America")` raises `IsADirectoryError` on Linux and `PermissionError` on Windows, both `OSError`.
- `_compute_personalized` maps `_ensure_cached` over a 10-worker pool, and `_ensure_cached` does a TMDB fetch *and* `TMDBMediaCache.objects.update_or_create` (plus an `IntegrityError` fallback read) inside the worker.
- `_refresh_cache` does `update_or_create` unconditionally. Section builders turn TMDB failures into `[]`.
- Both recommendation endpoints derive `status` from the in-process `_computing_users` set. The cross-process gap only shows when a refresh is started by a signal (marking watched) on one gunicorn worker and the poll lands on another while the cache isn't stale.
- `_fetch_followed_people_credits(user, limit=None)` fetches every uncached person, 5 threads × 10s timeout each, then `cache.set_many` once at the end. It's shared by notifications (`limit=None`) and followed-people recommendations (`limit` set).
- `avatar_upload_path` returns `avatars/user_<id>.<ext>`. The upload view deletes the old file *before* `profile.save()`, and nothing deletes the file on profile deletion.
- `tmdb_client._delete` takes no body, but TMDB's `DELETE /authentication/session` needs `{"session_id": …}`.

## Goals / Non-Goals

**Goals:**
- Each finding fixed in a way a test can fail on.
- No new rule exceptions: worker threads stay HTTP-only, and failures never overwrite good data.

**Non-Goals:**
- Cross-process *coalescing* of refreshes. Duplicate refreshes across workers stay accepted (ARCHITECTURE.md). Only the reported status is fixed.
- Caching TMDB 404s for people who no longer exist. Such a person is retried each poll. It costs one slot of the per-poll cap, which is acceptable.
- Renaming existing avatar files. Old `user_<id>.<ext>` names keep working, and only new uploads get versioned names.

## Decisions

**1. Zones:** `except (ZoneInfoNotFoundError, ValueError, OSError)`. One line. Every caller already goes through `valid_tz_name`/`request_tz`, so the stats, notifications, watched and bulk-import paths are covered at once.

**2. Worker threads only fetch.** `_ensure_cached` splits in two:
- `_fetch_media_details(entry)`: worker, HTTP only. Returns details or `None`.
- `_store_media_cache(entry, details, prefetched)`: calling thread. Does the upsert and the race fallback.

The pool maps the fetch over the entries needing one, then the caller loops and stores. `_refresh_cache`'s `finally` calls `connection.close()` after `_finish_refresh`, as `metadata_backfill._run_backfill` does.

**3. Outage guard via a fetch-health flag.**
- A small `FetchHealth` object (a `threading.Lock` + `failed: bool`) is passed into `_compute_for_you`/`_compute_personalized` and set by the existing except-branches that currently return `[]`.
- `_refresh_cache` counts non-empty sections in the new result and in the stored row. If `health.failed` and the new count is lower (or zero), it logs and keeps the old row. With no stored row and a failed fetch, it writes nothing, so the next request retries.
- *Rejected: raising on any TMDB failure.* One flaky title would then block every refresh. Comparing section counts only blocks a refresh that actually lost content.

**4. Cross-process status via `UserRecommendationCache.refreshing_since` (nullable datetime, additive migration).**
- **Set:** when a refresh is spawned, from the calling thread: `filter(user_id=…).update(refreshing_since=now)`. That's a no-op when the user has no row yet, and then the endpoints already answer `pending`.
- **Cleared:** in `_finish_refresh` when no follow-up run is queued, on the refresh thread itself (not a pool worker), which already writes the row.
- **Status:** `pending` if the user is in `_computing_users` or `refreshing_since` is newer than `REFRESH_STATUS_WINDOW` (10 minutes, well above a normal refresh). A killed process's flag therefore expires on its own.
- *Rejected: client-side polling until `computed_at` changes.* The client can't know a refresh started on another worker, so it would have to poll after every page load.

**5. Notifications poll budget:**
- `_fetch_followed_people_credits` gets `max_fetch` (default `None` = unlimited, keeping today's behavior for followed-people recommendations' small `limit`) and `budget_seconds`.
- Notifications passes `max_fetch=40`, `budget_seconds=15`.
- Uncached people are taken in the same followed order. A poll fetches the first 40, and since those are cached on success, the next poll's first 40 are new ones. 500 cold follows are covered in ⌈500/40⌉ = 13 polls (~39 min at the 3-minute poll interval).
- Results are consumed with `as_completed(timeout=remaining)` on the calling thread, which `cache.set`s each person as it arrives. When the budget runs out, `executor.shutdown(wait=False, cancel_futures=True)`. Threads already running finish their HTTP call in the background and touch no DB or cache.
- A pytest pins `NOTIFICATIONS_BUDGET_SECONDS` ≤ gunicorn `--timeout` − 10 (DB work after the fetch and the response need headroom), parsing `docker-entrypoint.sh` as `test_tmdb_proxy` does.

**6. Avatars:**
- `avatar_upload_path` returns `avatars/user_<id>_<ms timestamp>.<ext>`. Upload flow: remember `old_name`, assign the new file, then `profile.save()` inside `transaction.atomic()`. On success, `transaction.on_commit(lambda: storage.delete(old_name))` when it differs. On any exception, delete the newly written file (if it exists) and re-raise as a 500, so the old row and file are untouched.
- A `post_delete` receiver on `Profile` deletes `instance.avatar` on commit. That covers account deletion (cascade) and any other profile delete.
- The DELETE (remove photo) path already deletes the file. It's kept, and moved to on-commit for consistency.

**7. TMDB revoke:**
- `tmdb_client._delete(path, params=None, json=None)`.
- A helper `revoke_tmdb_session(session_id)` calls `DELETE /authentication/session` with `{"session_id": …}` and catches `requests.RequestException`/`ValueError`. It logs `logger.warning("TMDB session revoke failed for user %s (%s)", user_id, type(e).__name__)`: only the exception type, never `str(e)` or the session id.
- It is called from `tmdb_disconnect` (when a session exists) and from `delete_account` before `user.delete()`.

## Risks / Trade-offs

- [Notification coverage for huge follow lists takes up to ~40 minutes on a cold cache] → It's bounded and progresses each poll, versus today's worker kill on every poll. Credits stay cached 6h, so steady-state polls fetch little.
- [`refreshing_since` adds a DB write per refresh start] → One `UPDATE` by primary key, on the request thread that already handles the trigger.
- [The outage guard could keep stale recommendations after a real drop in content] → Only when TMDB calls failed during that refresh. A clean refresh always writes.
- [Abandoned notification threads keep running after the response] → At most 5, each bounded by the 10s TMDB timeout, and HTTP only.

## Migration Plan

- **One additive migration:** `UserRecommendationCache.refreshing_since`, nullable, no default, generated with the Django 5.2 env. No data migration.
- **Deploy:** the normal image-baked migration flow.
- **Rollback:** reverting the code is safe. The extra column is ignored, and it can be dropped by reverting the migration.
