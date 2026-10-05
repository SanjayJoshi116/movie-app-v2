## Why

The token-refresh flow forcibly logs every active user out about 2 hours into a session. The backend rotates refresh tokens and blacklists the old one (`ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`), but the frontend interceptor saves only the new `access` token and keeps sending the already-blacklisted `refresh`. So the second refresh (~2h in, with 60-min access tokens) always fails and redirects to `/login`. Around that, a session's lifecycle has several gaps: password changes and resets don't revoke existing sessions, logout never tells the server, logout leaves the previous user's cached recommendations and searches in the tab for the next user, and the 500-retry silently re-sends non-idempotent writes.

## What Changes

- Persist the rotated refresh token returned by every refresh, so sessions last the full refresh-token lifetime.
- Make concurrent/late `401` handling safe: a `401` for a request sent with an already-replaced access token is retried with the current token instead of starting another refresh (which would fail against the blacklist).
- Changing your password (profile) or completing a password reset revokes every outstanding refresh token for that account. Profile password change returns a fresh token pair so the current session keeps working; every other session ends at its next refresh.
- Add a server-side logout endpoint that blacklists the session's refresh token; the client calls it best-effort on logout.
- One client-side session teardown path, used by explicit logout and forced logout alike. It clears tokens, the cached user, the per-tab session caches (recommendations, search results, list filters) and recent-search history, so nothing from one account shows up for the next account in the same tab.
- Limit the automatic retry-on-`500` to safe methods (`GET`/`HEAD`/`OPTIONS`), so a write that succeeded server-side but returned 500 is never duplicated (e.g. duplicate lists).

## Capabilities

### New Capabilities
- `auth-session`: Lifetime of an authenticated session: token refresh and rotation, concurrent-request handling during refresh, revocation on credential change and logout, client-side teardown, and retry safety of the authenticated API client.

### Modified Capabilities
<!-- none — login-page covers only the login form, which is unchanged -->

## Impact

- Frontend: `src/api/userApi.ts` (interceptors, new `logoutSession` call), `src/context/AuthContext.tsx` (`logout`, `updateProfile` token handling, shared teardown), callers of `logout()` (`Sidebar.tsx`, `BottomNav.tsx`, `ProfileModal.tsx`) unchanged in signature.
- Backend: new `POST /api/auth/logout/`; `auth_views.profile` (PATCH) and `password_reset_confirm` revoke outstanding tokens; profile PATCH response gains optional `access`/`refresh` keys when the password changed (additive).
- Dependency: raise `djangorestframework-simplejwt` floor so rotated refresh tokens are recorded as outstanding (needed for revoke-all to reach them).
- Tests: backend tests for logout/revocation; Jest tests for the interceptor (rotation, late-401, retry policy) and logout teardown.
- Related: `harden-security-p0` (email-change re-auth) depends on the revocation here to fully close the account-takeover chain.
