## Why

The fifth audit (backlog item 30) found that several account protections are weaker in production than the specs and docs say. The per-username login lockout lapses after 5 minutes instead of an hour, and parallel failures barely count. Password-gated actions allow unlimited guessing with a stolen token. A crafted `voteAverage` breaks `/api/stats/` for good. An avatar upload can use most of a GB of RAM. A stalled SMTP server leaves a password change half-applied. Tests run under DEBUG's `LocMemCache`, so none of this shows up there. These are the first items in the suggested order (30 → 31 → …) because they are security and data-integrity bugs.

## What Changes

- **Login lockout really lasts one hour and counts every failure.** Failed-login counting moves from `cache.add` + `cache.incr` (not atomic on `DatabaseCache`, and `incr` resets the expiry to the 300 s default) to an atomic database upsert that keeps the first failure's timestamp. The 20-per-hour limit then holds in production and under parallel bursts.
- **Wrong passwords on password-gated actions count toward the same per-username limit.** A wrong `current_password` on a profile update or a wrong password on account deletion records a failure. Once the username is at the limit, those actions return `429` before the password is checked, just as login does.
- **A successful password reset clears that username's failure count**, so a user locked out by someone else's guessing can sign in right after resetting.
- **Password reset request and confirm get separate throttle scopes** (`password_reset` stays 5/hour for requests; new `password_reset_confirm` scope for confirm), so a few validation errors on the confirm form don't use up the request bucket.
- **`voteAverage` is bounded to 0–10** on every input serializer (watchlist, watched, list items, bulk watched). Stats ignore stored values outside that range, so rows already stored still can't break the page.
- **Avatar decoding is size-capped.** Images over 16 megapixels are rejected with `400`. The stored avatar is downscaled to at most 1024×1024 before re-encoding.
- **Email sending can't hang a request.** `EMAIL_TIMEOUT` defaults to 10 s (env-overridable). The email-change notice is sent after the transaction commits, on a background thread, so token revocation and reissue always run.
- **Episode-progress `PATCH` is removed** (`405`). Only `POST` sets progress, and it requires both `season` and `episode` instead of defaulting omitted fields to 1. The frontend already sends `POST` with both.
- **Smaller race fixes from the same audit:** concurrent avatar uploads lock the profile row, so no orphaned file is left. Adding items to a list that is being deleted gives `404`, not `500`. The email advisory lock keys on the same case fold the uniqueness check uses (`upper`).
- **Followed-people recommendations get a TMDB-cost throttle scope**, as the per-endpoint throttle rule requires.
- Out of scope, and kept in the backlog: `UserAttributeSimilarityValidator` (left out on purpose in 0.15.3; it stays an open decision). The backfill-budget bypass goes to item 28 (media-cache fill cap). The same-day "mark seen" notification goes to item 29.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `account-security`: the per-username limit's window holds in production and counts parallel failures. Wrong passwords on profile/delete count toward it and are blocked by it. A reset clears it. Reset confirm has its own rate limit. The email-change notice is sent after commit with a bounded mail timeout. The email lock is case-consistent.
- `input-validation`: `voteAverage` must be within 0–10. Stats tolerate stored out-of-range values. Episode progress needs both fields and accepts no `PATCH`. Adding to a list that is being deleted is a `404`.
- `avatar-upload`: a pixel cap below the decoder limit, a bounded stored resolution, and concurrent replaces that leave no orphaned file.
- `endpoint-time-budgets`: followed-people recommendations are rate limited per user.

## Impact

- Backend: `userdata/auth_views.py` (failure counter, delete/profile gating, reset-confirm throttle, avatar cap/downscale/lock, email notice on commit, advisory lock), `userdata/serializers.py` (`voteAverage` bounds, episode input), `userdata/social_views.py` (drop `PATCH`, followed-recs throttle), `userdata/lists_views.py` (`IntegrityError` → 404), `userdata/stats_views.py` (ignore out-of-range scores), `cinedb/settings.py` (`EMAIL_TIMEOUT`, new throttle rates).
- New model plus migration for login-failure counters (`0025`).
- Tests: the new tests must not depend on LocMem `incr` semantics. They exercise the DB-backed counter directly.
- Docs: `CLAUDE.md` throttle-scope bullet, `docs/ARCHITECTURE.md` (why the failure counter is a table, not the cache), `docs/BUG_BACKLOG.md` status, CHANGELOG.
- No frontend change expected. The client only uses `POST` for episode progress, and TMDB scores are already within 0–10.
