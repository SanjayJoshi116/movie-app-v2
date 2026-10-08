Same rule as `honest-tests`: a task that adds or changes a test is done only when that test has been shown to fail against a temporary break of the behavior it covers, then the break was reverted.

## 1. Zones (B1)

- [x] 1.1 `timezones.valid_tz_name`: add `OSError` to the except
- [x] 1.2 pytest (`test_local_dates.py`): `America`, `Etc`, `America/Argentina` as `X-Timezone` on `/stats/`, `/notifications/new-releases/` and `POST /watched/`, plus `watchedTz` in a bulk watched import. All are 2xx, dates are in UTC, and the stored `watched_tz` is blank

## 2. Recommendation refresh (B2, N1, T1)

- [x] 2.1 Split `_ensure_cached` into a worker-side fetch and a caller-side store. The pool runs only the fetch
- [x] 2.2 Add `connection.close()` in `_refresh_cache`'s `finally`, after `_finish_refresh`
- [x] 2.3 pytest: during a refresh, no `TMDBMediaCache` write or read happens off the calling thread (patch the manager methods to record `threading.current_thread()`)
- [x] 2.4 `FetchHealth` passed into both compute functions, set by the except-branches that return `[]`. `_refresh_cache` keeps the stored row when `failed` and the new result has fewer non-empty sections (or none)
- [x] 2.5 pytest:
  - stored row + all TMDB failing → row unchanged
  - stored row + some failures with an equal section count → new result saved
  - no row + failure → nothing written
- [x] 2.6 Model field `UserRecommendationCache.refreshing_since` (nullable) + migration (Django 5.2 env, check the header), with `makemigrations --check` clean
- [x] 2.7 Set it on spawn (calling thread, `update()`) and clear it in `_finish_refresh` when no follow-up is queued. Endpoints report `pending` while it's within `REFRESH_STATUS_WINDOW`
- [x] 2.8 pytest:
  - with `refreshing_since` recent and the user not in `_computing_users` (simulating another process), both endpoints say `pending`
  - older than the window → `ready`
  - after a finished refresh the field is `None`

## 3. Notifications budget (B4)

- [x] 3.1 `_fetch_followed_people_credits(user, limit=None, max_fetch=None, budget_seconds=None)`:
  - fetch at most `max_fetch` uncached people
  - consume with `as_completed(timeout=remaining)` and `cache.set` each as it arrives
  - on timeout, `shutdown(wait=False, cancel_futures=True)`
- [x] 3.2 Notifications calls it with `NOTIFICATIONS_MAX_FETCH=40` and `NOTIFICATIONS_BUDGET_SECONDS=15`. Followed-people recommendations keep their current call
- [x] 3.3 pytest:
  - 100 cold follows → the first poll fetches 40, the second the next 40, and the third the last 20
  - every TMDB call sleeping past the budget → the endpoint returns within budget + margin, and people that finished before the budget are cached
  - a failed person is retried next poll (existing test stays green)
- [x] 3.4 pytest pin: `NOTIFICATIONS_BUDGET_SECONDS` ≤ the gunicorn `--timeout` parsed from `docker-entrypoint.sh` − 10

## 4. Avatars (B6, B7, R2)

- [x] 4.1 `avatar_upload_path` → `avatars/user_<id>_<ms>.<ext>` (extension whitelist unchanged)
- [x] 4.2 Upload view:
  - save the new file and the row in `atomic()`, then delete the old file `on_commit`
  - on failure, delete the new file and leave the row and the old file alone
  - the remove-photo path also deletes on commit
- [x] 4.3 `post_delete` receiver on `Profile` deletes the avatar file on commit
- [x] 4.4 pytest (`test_avatar.py`, temp `MEDIA_ROOT`):
  - a re-upload returns a different `avatar_url`, and the old file is gone
  - account deletion removes the file
  - simulated `profile.save()` failure → the old file still exists and the row still points to it

## 5. TMDB revoke (T2)

- [x] 5.1 `tmdb_client._delete(..., json=None)`, plus a `revoke_tmdb_session(user_id, session_id)` helper that logs only the exception type
- [x] 5.2 Call it from `tmdb_disconnect` and from `delete_account` (before `user.delete()`) when a session id exists
- [x] 5.3 pytest (`test_tmdb_auth.py`):
  - disconnect calls TMDB DELETE with the session id in the body
  - a TMDB failure still disconnects (200) and logs without the session id
  - account delete with a session calls revoke before the user is gone

## 6. Docs and verification

- [x] 6.1 `docs/ARCHITECTURE.md`: bullets for cross-process refresh status, the outage guard, the notifications poll budget/coverage, and avatar versioning. Update the "Recommendation refresh coalescing" bullet to mention `refreshing_since`
- [x] 6.2 CLAUDE.md:
  - the "Upstream failures" bullet gains the refresh-level guard
  - the throttle/time-budget note mentions the notifications budget pin
- [x] 6.3 Run backend pytest, `ruff check backend/` and `makemigrations --check --dry-run`. Jest and both e2e suites are skipped: no frontend code changed, the e2e suites mock every `/api/**` call so a backend change can't reach them, the avatar URL is an opaque string to `resolveAvatarUrl`, and mock/API shape drift is already covered by `test_e2e_mock_shapes.py` inside backend pytest
- [x] 6.4 `docs/BUG_BACKLOG.md`: item 12 → 📝 now, ✅ on archive
