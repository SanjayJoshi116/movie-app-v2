## Why

Backlog item 11 (2026-10-07 audit). Three session bugs, one of them high severity:

- **F1:** a second tab can save writes to a different account than the one it shows.
- **B3:** token refresh and logout share the anonymous 300/day per-IP throttle, and any refresh error forces a logout. Users behind one NAT get logged out by a 429.
- **B5:** Django's automatic password rehash changes the password-bound token claim. One email change through the profile dialog logs out the session that made it.

The fixes are small, so they ship together before the other second-audit changes.

## What Changes

- **Tabs follow the signed-in account (F1).** `AuthProvider` listens for `storage` events on the auth keys:
  - keys removed (logout elsewhere): clear this tab's session data and show the signed-out state
  - a different user stored (another login): reload the tab so no state from the previous account survives
  - the same user updated: adopt the new profile data
- **The request interceptor refuses mismatched writes (F1).** It refuses to send a request when the stored user differs from the user this tab is rendering. This covers the gap before the `storage` event arrives.
- **Refresh and logout get their own throttle scope (B3).** A new `token_refresh` scope (60/min per IP) applies to `SafeTokenRefreshView` and the logout view, in place of the default anon/user throttles.
- **Only a rejected refresh ends the session (B3).** The client forces a logout only when the refresh is rejected (`400`/`401`). A `429`, `5xx`, timeout or network error fails the original request and keeps the session.
- **A rehash during a profile edit reissues tokens (B5).** `profile` snapshots the password claim before validation. If a rehash changed it, the response carries a fresh token pair, as a password change already does. The once-per-upgrade logout of *other* sessions after a login-time rehash is documented, not prevented.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `auth-session`:
  - new requirement: tabs stay bound to the account they show
  - new requirement: refresh and logout have their own rate limit
  - "Concurrent unauthorized responses trigger at most one refresh" narrows the "refresh genuinely fails" case to a rejected refresh, so transient failures keep the session
  - "Credential changes revoke other sessions" gains a scenario: a rehash during a profile edit keeps the current session

## Impact

- **Frontend:** `src/context/AuthContext.tsx` (storage listener, binding the active user), `src/api/userApi.ts` (request-interceptor guard, `forceLogout` only on a rejected refresh). Tests go in `src/api/__tests__/userApi.test.ts` and a new `src/context/__tests__/AuthContext.sync.test.tsx`.
- **Backend:** `backend/userdata/auth_views.py` (throttle class, `profile` claim snapshot), `backend/userdata/urls.py` (logout view throttle), `backend/cinedb/settings.py` (`token_refresh` rate). New tests sit beside `test_password_bound_tokens.py`.
- **Docs:**
  - `docs/BUG_BACKLOG.md` status row
  - `docs/ARCHITECTURE.md` gets a note on cross-tab account binding and the login-rehash behavior
  - CLAUDE.md gets the throttle-scope and session-teardown convention updates
- **No API shape changes.** A `profile` PATCH may now return `access`/`refresh` without `new_password`. The client already stores them whenever they are present.
