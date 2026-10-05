## Context

- `settings.SIMPLE_JWT`: 60-min access, 7-day refresh, `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`, and `token_blacklist` is installed. Every refresh blacklists the submitted refresh token and returns a new one.
- `src/api/userApi.ts` response interceptor: on `401` it refreshes through a bare `axios.post`, then `localStorage.setItem("cinedb_access", data.access)` and drops `data.refresh`. `isRefreshing`/`failedQueue` queue requests that fail *during* a refresh, but `isRefreshing` resets in `finally`, so a stale-token `401` that arrives *after* the refresh starts a second refresh with the (now blacklisted) refresh token. That forces a logout.
- The same interceptor retries any `500` once after 2s, whatever the method.
- `AuthContext.logout()` removes the three `cinedb_*` auth keys and nulls `user`. It makes no server call. The interceptor's forced-logout branch repeats the key removal inline.
- Account-scoped data that survives logout in the same tab: `sessionStorage` (`cinedb_recommendations` in `RecommendationsPage`, Search's per-query result cache, `useLibraryFilters`' keys, Calendar/Recommendations filter keys) and `localStorage` `cinedb_recent_searches` (`useRecentSearches` via `useLocalStorage`, also held in React state by the always-mounted `SearchBox`).
- Backend: `password_reset_confirm` and `profile` (PATCH with `new_password`) call `set_password` and nothing else. The installed simplejwt is 5.5.1. Its `TokenRefreshSerializer` calls `refresh.outstand()` on rotated tokens, so rotated tokens appear in `OutstandingToken`. `requirements.txt` only says `>=5.3`.

## Goals / Non-Goals

**Goals:**
- One client-side teardown function used by every logout path.
- Revocation that reaches every refresh token the account ever got, including rotated ones.

**Non-Goals:**
- Instant access-token revocation. Access tokens stay valid until they expire (≤60 min) because they are stateless JWTs. Revocation takes effect at the next refresh. This is the standard simplejwt trade-off, and this change doesn't add a per-request deny-list.
- Moving tokens out of `localStorage` (httpOnly cookies). Worth doing for XSS resilience, but it's a bigger cross-cutting change.
- Cross-tab logout broadcast. Other tabs already fail closed at their next refresh, and their `storage` event sees the key removal.

## Decisions

### D1. Persist the rotated refresh, and compare tokens before refreshing
In the interceptor:
1. On refresh success, store `data.access` and, when present, `data.refresh`.
2. Before starting a refresh, compare the failed request's `Authorization` header with `Bearer ${localStorage cinedb_access}`. If they differ, another refresh already replaced the token, so replay `original` with the current token (still marking `_retry`) and skip the refresh.
3. Keep the existing `isRefreshing` + `failedQueue` for requests that fail *while* a refresh is in flight.

Rejected: keeping a module-level "refresh promise" that every `401` awaits. That also works, but step 2 is a smaller diff and handles the late-arrival case directly.

### D2. Revoke-all helper on the backend
`_revoke_all_refresh_tokens(user)`: for every `OutstandingToken` of the user, `BlacklistedToken.objects.get_or_create(token=t)`. Called from `password_reset_confirm` after `set_password`, and from `profile` PATCH when `new_password` is set. In the profile case it runs *before* issuing a fresh pair with `_tokens_for_user(user)`, so the new pair isn't revoked. The fresh pair is added to the response as `access`/`refresh` alongside the serialized user fields. The change is additive: existing consumers that read only user fields are unaffected.

Raise `djangorestframework-simplejwt` to `>=5.5` in `requirements.txt` (matches the installed 5.5.1). Older versions don't outstand rotated tokens, so revoke-all would silently miss every token after the first refresh. During implementation, check the exact minimum version against simplejwt's changelog and pin that.

Rejected: Django's session-auth-hash style invalidation (embedding a password-hash fragment in the JWT and checking it on refresh). That needs a custom token class and refresh serializer, while the blacklist tables already exist.

### D3. Logout = simplejwt's `TokenBlacklistView`
Mount `rest_framework_simplejwt.views.TokenBlacklistView` at `POST /api/auth/logout/` (`AllowAny`, body `{refresh}`). It already validates the token, blacklists it, and returns `401` for invalid/blacklisted tokens. It inherits the default anon/user throttles. It does call `User.objects.get` indirectly in some versions, so wrap it the same way `SafeTokenRefreshView` does if a deleted-user token can reach it (verify in a test).

The client calls it through `publicApi` (no interceptors), so an expired access token can't trigger a refresh during logout. The call is fire-and-forget with a short timeout: teardown doesn't wait for it to succeed.

### D4. `clearSession()` as the single teardown
Export `clearSession()` from `src/api/userApi.ts` (the interceptor can't import from the React context, and the context can import from the API module). It removes `cinedb_access`, `cinedb_refresh`, `cinedb_user`, `cinedb_recent_searches`, and calls `sessionStorage.clear()`. Device preferences (`cinedb_theme`, `cinedb_sidebar_collapsed`) are kept. `AuthContext.logout()` = best-effort server logout → `clearSession()` → `setUser(null)`. The interceptor's forced-logout branch = `clearSession()` → redirect.

`sessionStorage.clear()` instead of an allow-list of keys: every key the app writes there is account- or session-derived, and an allow-list would rot as new caches are added.

In-memory copies: `useRecentSearches` resets its state to `[]` when the auth `user` becomes `null`. Page-level sessionStorage readers (`RecommendationsPage`, `SearchPage`) read on mount, so they are fine once storage is cleared. Rejected: a full page reload on logout (`window.location.assign`). It's simplest and most thorough, but it adds a visible reload flash to every logout and throws away the SPA navigation the callers do today (`navigate("/movies")`).

### D5. Retry-on-500 only for safe methods
Gate the existing `_retry500` branch on `["get","head","options"].includes(original.method)`. Rejected: an idempotency-key scheme so writes can be retried safely. Nothing on the backend consumes such keys, and transient 500s on writes are rare enough to surface.

## Risks / Trade-offs

- [Revoked sessions keep working for up to 60 min on their current access token] → Documented as a non-goal. Acceptable at this scale. Shortening `ACCESS_TOKEN_LIFETIME` is a separate knob.
- [`OutstandingToken` grows without bound] → Already true today. simplejwt's `flushexpiredtokens` command handles it. Note it in ARCHITECTURE.md and leave scheduling it out of scope.
- [`sessionStorage.clear()` also drops browse-page scroll/pagination restore state] → On logout that's desirable, not a regression.
- [A profile PATCH that changes the password and then fails to return tokens (network drop) leaves the client holding revoked tokens] → The next refresh fails and forces a re-login with the new password. Correct, if slightly abrupt.

## Migration Plan

1. Deploy backend first. The new endpoint and the additive response keys are backward compatible with the old frontend.
2. Deploy frontend.
3. Existing users holding a refresh token that was already blacklisted by a previous rotation get one final forced logout. After that, sessions persist normally.

Rollback: revert the frontend first (it tolerates the backend change), then the backend.
