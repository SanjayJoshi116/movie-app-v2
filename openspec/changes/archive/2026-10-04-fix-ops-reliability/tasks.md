## 1. Health endpoint

- [x] 1.1 Add `@throttle_classes([])` to `health` in `backend/userdata/health_views.py`
- [x] 1.2 Add `backend/userdata/tests/test_health.py`: health returns 200 when called more times than a test-overridden anon rate (e.g. `anon: 2/day`), and calling it doesn't use up another anon endpoint's allowance

## 2. Bounded Docker warm-up

- [x] 2.1 In `backend/docker-entrypoint.sh`, wrap `compute_recommendations` in `timeout 30 ... || echo "[cinedb] compute_recommendations skipped (failed or timed out after 30s)"`
- [x] 2.2 Check `timeout` exists in the `python:3.11-slim` image (`docker run --rm python:3.11-slim timeout --version`), and check the entrypoint still reaches gunicorn when the command fails
  - Note (2026-10-04): no Docker on the dev machine. Tested entrypoint logic in Git Bash with stubbed `python`/`gunicorn` (timeout cut to 2s): success, exit-1, and hang all reach gunicorn and log the skip message. `timeout` in the image is reasoned (Debian base, coreutils is Essential), not run. Re-run the `docker run` check when Docker is available.

## 3. Coalesced recommendation refresh

- [x] 3.1 In `backend/userdata/recommendations.py`, add `_rerun_users` and a `request_refresh(user_id, *, rerun_if_running)` that implements design D3 under `_computing_lock`
- [x] 3.2 Change the background thread target to load the user by id (`User.objects.filter(pk=...).first()`) and exit quietly if missing; move the rerun/discard bookkeeping into `_refresh_cache`'s `finally`
- [x] 3.3 Make `_start_refresh_if_needed` delegate to `request_refresh(user.id, rerun_if_running=False)`, keeping its return value and the views' `computing` flag behavior unchanged
- [x] 3.4 Rewrite `backend/userdata/signals.py` receivers to call `transaction.on_commit(... request_refresh(instance.user_id, rerun_if_running=True))`, and drop the raw `threading.Thread` helper
- [x] 3.5 In the `post_delete` receiver, return early when `kwargs.get("origin")` is a `User` instance

## 4. Tests for refresh behavior

- [x] 4.1 Bulk clear of N watched entries (patch the thread target / `_refresh_cache`, use `django_capture_on_commit_callbacks(execute=True)`): at most 2 refresh runs
- [x] 4.2 Trigger while a refresh is in flight: exactly one follow-up run; two different users: both run
- [x] 4.3 Deleting a user with watched entries schedules no refresh
- [x] 4.4 A watched entry created in a rolled-back `atomic()` block schedules no refresh
- [x] 4.5 Run the full backend suite (`G:/Anaconda/envs/django/python.exe -m pytest` in `backend/`) and confirm the existing recommendation/watched tests still pass

## 5. Docs

- [x] 5.1 Add a `docs/ARCHITECTURE.md` bullet on refresh coalescing (running + dirty sets, on-commit, `origin` skip) and the health throttle exemption
