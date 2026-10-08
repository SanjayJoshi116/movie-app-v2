## Why

Backlog item 12 (2026-10-07 audit, re-checked 2026-10-08). The backend still breaks several of its own rules:
- Some time-zone values cause a 500, not the UTC fallback.
- Recommendation refreshes write to the DB from worker threads, and a TMDB outage replaces good recommendations with empty ones.
- A poll can report a refresh "ready" while another worker is still running it.
- The notifications poll has no time bound, so many follows can get a gunicorn worker killed every poll.
- Avatars and TMDB sessions outlive what the user removed.

## What Changes

- **Zones (B1):** `valid_tz_name` also catches `OSError`, so a tzdata *directory* name (`America`, `Etc`) falls back like any unknown zone.
- **Recommendation refresh:**
  - **B2:** worker threads only fetch from TMDB. `TMDBMediaCache` upserts and fallback reads move to the calling thread, and the refresh thread closes its DB connection in `finally`.
  - **N1:** the compute records whether any TMDB call failed. When one did and the new result has fewer non-empty sections than the cached one (or none), the old cache row is kept and nothing is written.
  - **T1:** `UserRecommendationCache` gets `refreshing_since`, set when a refresh starts and cleared when it ends. Both endpoints answer `pending` while it is recent on *any* worker. Additive migration.
- **Notifications (B4):**
  - Each poll fetches at most a fixed number of uncached people within a wall-clock budget that stays under gunicorn's timeout.
  - Each person is cached as their fetch completes, not after the whole batch.
  - Later polls pick up the people not yet cached, so coverage of every followed person completes over a bounded number of polls instead of a single request.
- **Avatars:**
  - **B6:** deleting a profile (including by account deletion) deletes its avatar file.
  - **B7/R2:** each upload gets a new versioned file name (`avatars/user_<id>_<stamp>.<ext>`), so `avatar_url` changes and caches can't serve the old photo. The old file is deleted only after the new one is saved and committed.
- **TMDB session (T2):** disconnecting TMDB and deleting the account make a best-effort `DELETE /authentication/session` call to TMDB before the session id is cleared. Failure is logged and never blocks the disconnect or the deletion.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `local-dates`: the "device's time zone reaches the server" requirement gains a scenario for zone names that are tzdata directories.
- `recommendation-refresh`:
  - status reflects a refresh running on any server process
  - an upstream outage keeps the previous recommendations
- `notifications`:
  - "cover every followed person" becomes coverage within a bounded number of polls
  - each poll has a bounded duration
- `avatar-upload`:
  - a replaced or deleted avatar is no longer served
  - a new upload is visible immediately
  - a failed replace keeps the old photo
- `account-security`: disconnecting TMDB or deleting the account revokes the TMDB session.

## Impact

- **Backend only:**
  - `timezones.py`, `recommendations.py`, `models.py` (+ one additive migration for `refreshing_since`)
  - `social_views.py`, `notifications_views.py`, `auth_views.py`, `tmdb_views.py`, `tmdb_client.py` (`_delete` gains a JSON body)
  - `signals.py` (`post_delete` on `Profile`)
- **Frontend:** no code change. The new avatar URL is just a different string, and `resolveAvatarUrl` is unchanged.
- **Tests:** new pytest cases beside `test_local_dates.py`, `test_recommendation_refresh.py`, `test_notifications.py`, `test_avatar.py`, `test_tmdb_auth.py`. The notifications time budget is pinned against `docker-entrypoint.sh`'s `--timeout`, the way `test_tmdb_proxy` pins its own.
- **Docs:** `docs/ARCHITECTURE.md` (refresh status, notification coverage, avatar versioning) and `docs/BUG_BACKLOG.md`.
