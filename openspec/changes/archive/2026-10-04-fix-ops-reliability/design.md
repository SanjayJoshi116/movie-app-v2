## Context

- `health_views.health` is `AllowAny` but has no `@throttle_classes`, so it gets `REST_FRAMEWORK.DEFAULT_THROTTLE_CLASSES` (`AnonRateThrottle` at `300/day`). `docker-compose.yml` polls it every 10s (8,640/day).
- `backend/docker-entrypoint.sh` runs `python manage.py compute_recommendations || true` with no time limit. `start.py` (local dev) already wraps the same step in `subprocess.run(..., timeout=30)`.
- `signals.py` starts a raw `threading.Thread(target=_refresh_cache)` on every `WatchedEntry` `post_save(created)` / `post_delete`. It skips the existing per-user guard in `recommendations.py` (`_computing_users` + `_computing_lock`, used by `_start_refresh_if_needed`), which the recommendation views already use. `QuerySet.delete()` sends `post_delete` once per row, so `watched_clear` fans out one thread per row. Account deletion cascades through the same path.

## Goals / Non-Goals

**Goals:**
- One shared refresh-scheduling path for both signals and views.
- No change to API responses, including the `status: "pending"` behavior the recommendation views derive from `_computing_users`.

**Non-Goals:**
- Coalescing across gunicorn workers or hosts. The guard stays in-process, like today's `_computing_users`. Cross-worker dedupe would need a shared lock (DB/Redis), which isn't justified at this scale.
- Replacing threads with a task queue (Celery/RQ).
- Other entrypoint issues from the audit (`--run-syncdb`, root user, missing `media/` in `.dockerignore`). They are tracked separately.

## Decisions

### D1. Health exemption via `@throttle_classes([])`
An empty throttle list on the view is DRF's own documented way to opt out. Alternatives considered: a dedicated high-rate scope (still a cap, still breaks eventually), or serving health from nginx (wouldn't prove Django and the DB are alive). The endpoint does no DB/TMDB work beyond the request cycle, so leaving it unthrottled doesn't add a DoS surface beyond any other 404 path.

### D2. Entrypoint uses coreutils `timeout 30`
`timeout 30 python manage.py compute_recommendations || echo "[cinedb] compute_recommendations skipped (failed or timed out after 30s)"`. `python:3.11-slim` (Debian) ships coreutils, so no new dependency. This mirrors `start.py`'s 30s budget so both paths behave the same. Rejected alternative: moving the warm-up into the background after gunicorn starts. It would race the first requests and the entrypoint would need process supervision.

### D3. Coalescing = "running" set + "dirty" set, under the existing lock
Extend `recommendations.py`:
- `_computing_users` (existing): user ids with a refresh in flight.
- `_rerun_users` (new): user ids that got another trigger while in flight.
- `request_refresh(user_id, *, rerun_if_running)`: under `_computing_lock`, if not in flight, add the id and start a thread. If in flight and `rerun_if_running`, add the id to `_rerun_users`.
- `_refresh_cache` `finally`: under the lock, if the user is in `_rerun_users`, remove the id and start one more thread (the id stays in `_computing_users`). Otherwise discard it from `_computing_users`.

Signals call this with `rerun_if_running=True` (the data changed, so the in-flight result is stale). Views keep calling `_start_refresh_if_needed`, which delegates with `rerun_if_running=False` (a stale-TTL refresh doesn't need a second pass). Rejected alternative: a time-based debounce (e.g. wait 2s, then compute once). It adds latency to every single mark-watched and still needs the same lock bookkeeping.

### D4. Trigger on commit, by user id
Signals register `transaction.on_commit(lambda: request_refresh(instance.user_id, rerun_if_running=True))`. Using `user_id` instead of `instance.user` avoids one `User` query per deleted row during a bulk clear. The thread target loads the user with `User.objects.filter(pk=user_id).first()` and returns quietly if it's gone. Outside a transaction (autocommit), `on_commit` runs immediately, so behavior matches today's.

### D5. Skip account-deletion cascades via `origin`
On Django ≥ 4.1 (`requirements.txt` pins 4.2), `post_delete` receives `origin`, the instance or queryset `delete()` was called on. If `origin` is a `User` instance, the receiver returns without scheduling. This is more precise than checking whether the user still exists (inside the cascade the `User` row isn't gone yet), and the D4 "user gone" check covers any remaining race.

## Risks / Trade-offs

- [A follow-up refresh still starts at least one extra TMDB-heavy run after a bulk clear] → Accepted. It's bounded to 1, and needed so the final cache matches post-clear state.
- [In-process sets don't dedupe across the 3 gunicorn workers] → Worst case is 3 concurrent refreshes for one user (one per worker), down from N. Same limitation `_computing_users` already has.
- [`on_commit` callbacks don't run in tests that use the default transactional test case] → Tests use pytest-django's `django_capture_on_commit_callbacks(execute=True)`.
- [Unthrottled health endpoint] → It returns a constant body. Rate limiting at nginx is the right layer for raw request floods anyway.

## Migration Plan

No data migration. Deploy normally. Rollback is reverting the commit. The new sets are in-memory only.
