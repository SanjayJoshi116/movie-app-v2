## Why

The 2026-10-28 database review (backlog item 48) found four confirmed gaps in the data layer: the per-user date indexes every library page needs were dropped by migration 0009 and never came back, a user's first recommendations save can be overwritten by an older compute, a password reset can half-apply, and a deleted account's failed-sign-in count carries over to whoever registers that username next. One more, the shared title cache, grows without bound. Each is small, but together they touch every library load, sign-in and recommendations page.

## What Changes

- Declare per-user date indexes in the models' `Meta.indexes` (watched, watchlist, ratings, followed people, episode progress, lists), matching the `order_by(<date> desc, id desc)` each list endpoint uses, and add the migration. Declaring them in the models is what stops a later `makemigrations` from dropping them again, as 0009 did.
- `save_recommendations` serializes saves per user with a transaction-scoped advisory lock, so the "superseded" check holds even when the user has no stored row yet.
- `password_reset_confirm` sets the password, revokes refresh tokens and clears the failure count in one transaction.
- Account deletion clears that username's `LoginFailure` row.
- A new best-effort startup step deletes `TMDBMediaCache` rows older than `CACHE_TTL_DAYS` that no watched entry references, in `start.py` and the Docker entrypoint, bounded like `flushexpiredtokens`.
- Fix two stale comments: the `LoginFailure.key` comment (exact username, not folded) and `_revoke_all_refresh_tokens`' "never flushed".

Out of scope: encrypting TMDB `session_id` at rest (its own change later), and the backfill-placeholder finding (false positive: `None` means "never fetched", so storing it would refetch forever; `metadata_settled` already separates a 404).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `recommendation-refresh`: "An older recompute never replaces a newer one" also holds for a user's first save, when no row exists yet.
- `account-security`: a password reset applies completely or not at all; deleting an account clears its username's failed-attempt count.
- `service-health`: stale, unreferenced title-cache rows are cleaned up at startup, best-effort and time-bounded.

## Impact

- Backend only: `backend/userdata/models.py` + one new migration (indexes; no data change), `recommendations.py`, `auth_views.py`, a new management command, `backend/start.py`, `backend/docker-entrypoint.sh`, and tests.
- No API, frontend or dependency change. The index migration builds indexes on existing tables; on a large table that takes a lock for the duration of the build (acceptable at this app's size; see design).
- Docs: CLAUDE.md startup-step list, `docs/BUG_BACKLOG.md` item 48 status.
