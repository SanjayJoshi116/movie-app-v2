## Why

A password change or reset revokes other sessions with `_revoke_all_refresh_tokens()`. It takes one snapshot of the user's live `OutstandingToken`s and blacklists them. A refresh that is already in flight on another device can pass the blacklist check before that snapshot, and then record its rotated token after it. That new token is never revoked. With `ROTATE_REFRESH_TOKENS`, it keeps rotating for as long as it is used. Compromise is exactly when a user changes their password, and an attacker who refreshes in a loop widens the window. Separately, other sessions' access tokens stay valid for up to 60 minutes after the change. This was logged as deferred in `docs/BUG_BACKLOG.md`.

## What Changes

- Turn on simplejwt's built-in `CHECK_REVOKE_TOKEN`. Every token issued from then on carries a `hash_password` claim derived from the user's current password hash. Rotation and access tokens copy the claim forward.
- `SafeTokenRefreshSerializer` rejects a refresh whose claim doesn't match the user's current password, or that has no claim, with a clean 401. Stock simplejwt checks the claim only on access tokens, not on refresh. This closes the race by construction: a token rotated mid-change still carries the old claim, so it dies at its next use.
- `JWTAuthentication` then also rejects other sessions' access tokens immediately after a password change (built-in check), not up to 60 minutes later.
- `_revoke_all_refresh_tokens()` stays as defense in depth.
- **BREAKING (one-time):** tokens issued before deploy have no claim. Every signed-in user is logged out once at their next request or refresh. Decided 2026-10-07: hard logout, no grace period.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `auth-session`: "Credential changes revoke other sessions". Revocation also holds for a refresh that races the change, and other sessions' access tokens stop working immediately, not at expiry.

## Impact

- `backend/cinedb/settings.py` (`SIMPLE_JWT`), `backend/userdata/auth_views.py` (`SafeTokenRefreshSerializer`).
- Tests in `backend/userdata/tests/`: race reproduction, claimless token rejected, stale access token rejected, the current session survives its own change.
- Frontend: no code change. The existing 401 → refresh → login-redirect path handles it. The profile PATCH already returns and stores a fresh pair, so the session that made the change keeps working.
- Docs: `docs/ARCHITECTURE.md`'s "Revoke-all on credential change" bullet ("access tokens stay valid until they expire… no per-request deny-list" is no longer true), plus the backlog.
- Deploy: one forced re-login for all users.
