## 1. Backend: revocation and logout

- [x] 1.1 Find the minimum simplejwt version whose rotation path calls `outstand()` (changelog), and set the `djangorestframework-simplejwt` floor in `backend/requirements.txt` to it (≥5.5 if unsure)
- [x] 1.2 Add `_revoke_all_refresh_tokens(user)` in `backend/userdata/auth_views.py` (blacklist every `OutstandingToken` for the user via `get_or_create`)
- [x] 1.3 Call it in `password_reset_confirm` after `set_password` + `save`
- [x] 1.4 In `profile` PATCH, when `new_password` was set: revoke all, then issue a fresh pair with `_tokens_for_user` and merge `access`/`refresh` into the response
- [x] 1.5 Mount `POST /api/auth/logout/` in `backend/userdata/urls.py` using simplejwt's `TokenBlacklistView` (wrap like `SafeTokenRefreshView` if a deleted-user token can make it 500)

## 2. Backend tests

- [x] 2.1 Logout: blacklisted token can't be refreshed; malformed/already-blacklisted token returns 4xx, not 500; works without an `Authorization` header
- [x] 2.2 Password reset: refresh tokens issued before (including one obtained by rotation) are rejected afterwards
- [x] 2.3 Profile password change: the old pair is rejected, the returned pair refreshes successfully; a name-only PATCH returns no tokens and revokes nothing
- [x] 2.4 `SafeTokenRefreshView` regression: deleted-user refresh still returns 401 (lock in the existing fix while touching this area)

## 3. Frontend: API client

- [x] 3.1 Export `clearSession()` from `src/api/userApi.ts` (remove the 3 auth keys + `cinedb_recent_searches`, `sessionStorage.clear()`, keep theme/sidebar prefs)
- [x] 3.2 Interceptor: store `data.refresh` alongside `data.access` on refresh success
- [x] 3.3 Interceptor: before refreshing, replay with the current token if the failed request's `Authorization` differs from the stored access token (design D1)
- [x] 3.4 Interceptor: replace both inline key-removal blocks with `clearSession()`
- [x] 3.5 Interceptor: limit the 500-retry to `GET`/`HEAD`/`OPTIONS`
- [x] 3.6 Add `logoutSession(refresh)` calling `POST /auth/logout/` via `publicApi` with a short timeout

## 4. Frontend: auth context

- [x] 4.1 `AuthContext.logout()`: fire `logoutSession(storedRefresh)` without awaiting failures, then `clearSession()`, then `setUser(null)`
- [x] 4.2 `AuthContext.updateProfile()`: if the response includes `access`/`refresh`, store them before `setUserData` (strip them from the user object you persist)
- [x] 4.3 `useRecentSearches`: reset to `[]` when the auth user becomes `null`

## 5. Frontend tests

- [x] 5.1 Jest test for the interceptor (mock axios adapter): refresh stores the rotated refresh token; three consecutive expiries cause no redirect
- [x] 5.2 Burst of five 401s → exactly one refresh; a late 401 with a stale header → replay, no second refresh
- [x] 5.3 500 on GET retried once; 500 on POST not retried
- [x] 5.4 `logout()` clears auth keys, sessionStorage, and recent searches, keeps `cinedb_theme`, and still completes when the logout request rejects

## 6. Verification

- [x] 6.1 `npx tsc --noEmit` and backend `pytest` pass
- [x] 6.2 Manual/Playwright check: shorten `ACCESS_TOKEN_LIFETIME` locally (e.g. 1 min), use the app for >3 min, and confirm no redirect to `/login`; log out as A, log in as B in the same tab, and confirm Recommendations and recent searches don't show A's data
- [x] 6.3 Make sure e2e base fixtures that mock auth don't break (logout now calls `/api/auth/logout/`; add a mock to `mock_base_django_routes` and the TS spec `beforeEach` blocks per CLAUDE.md's unconditional-endpoint rule if any test exercises logout)
- [x] 6.4 Add `docs/ARCHITECTURE.md` bullets: rotation persistence + late-401 comparison, revoke-all on credential change, `clearSession()` as the single teardown, safe-method-only retry
