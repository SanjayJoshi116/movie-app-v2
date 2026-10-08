## Context

See proposal.md for the three bugs. The current state that shapes the fixes:

- `AuthProvider` (`src/context/AuthContext.tsx`) reads `cinedb_user`/`cinedb_access` once on mount. Every library hook (`useWatched`, `useWatchlist`, `useLists`, `useRatings`, `useEpisodeProgress`, `FollowedPeopleProvider`, `useNotifications`) fetches on `isAuthenticated` only. A direct A→B user swap without passing through `null` would therefore refetch nothing.
- `userApi`'s request interceptor reads `cinedb_access` fresh on every call. `storedUserId()` and `SessionChangedError` already exist, but only the refresh path uses them.
- `refreshTokens()` rethrows any error. The response interceptor then calls `forceLogout()` for everything except `SessionChangedError`.
- The simplejwt refresh and blacklist views set `authentication_classes = ()`, so the default `AnonRateThrottle` (`anon: 300/day`) always applies and `UserRateThrottle` keys by IP too.
- `UserProfileUpdateSerializer._require_current_password` calls `request.user.check_password()`. When the PBKDF2 iteration count differs from the running Django's, it re-saves `user.password`, which changes `get_md5_hash_password(user.password)`, the `CHECK_REVOKE_TOKEN` claim. `profile` reissues tokens only when `new_password` is set.

## Goals / Non-Goals

**Goals:**
- No request is ever sent under an account the tab isn't showing, even before the `storage` event arrives.
- A transient refresh failure never ends a session.

**Non-Goals:**
- Preventing the one-time "other sessions end" effect of a login-time rehash. We document it instead (see Decisions).
- Attaching the JWT to TMDB proxy calls (F6). That belongs to item 14, `harden-deploy-2`.
- Live cross-tab sync of library *data* within the same account. Only account identity is synced.

## Decisions

**1. A different account in another tab → `window.location.reload()`, after clearing this tab's `sessionStorage`.**
Every hook keys on `isAuthenticated`, and pages hold local state (open modals, route params like `/lists/:id` that belong to A). A reload is the one reset that can't miss a store.
- *Rejected: remounting `AuthProvider`'s children under `key={user.id}`.* It would reset the providers nested inside it. But `BrowserRouter` sits outside it, so `location.state` and the history entries that `stashReturnState()` wrote for A survive. Module-level caches (`userApi`'s `failedQueue`, the inflight slots) survive too.
- *Rejected: `setUser(null)` then `setUser(B)`.* React 18 batching makes this a no-op, and it relies on every hook resetting on a flip.
- Sign-out elsewhere doesn't reload: `sessionStorage.clear()` + `setUser(null)`. The route guards then redirect, the hooks see `isAuthenticated` go false, and this is the same path as a local logout. Sign-in elsewhere while this tab is signed out adopts the user through `setUser(parsed)`. The hooks then fetch on the false→true flip, so nothing stale exists to discard.
- The same user id with a changed payload (profile edit, avatar) adopts it with `setUser`. Token-only rotations (`cinedb_access`/`cinedb_refresh` changing with the same user) are ignored.
- The listener compares ids, not raw strings, so a re-serialized but identical user does nothing. It treats `e.key === null` (another tab ran `localStorage.clear()`) like a key removal, then re-reads storage to decide.

**2. A request guard bound to the tab's user: `bindSessionUser(id | null)` exported from `userApi.ts`.**
- `AuthProvider` calls it whenever its `user` changes (mount, login, register, logout, storage adoption).
- The request interceptor rejects with `SessionChangedError` when a user is bound and `storedUserId()` differs. That also covers "bound to A, storage now empty" (stored id `undefined`).
- This closes the window before the `storage` event fires. Chromium delivers storage events asynchronously, and a background tab's click handler can run first.
- No user bound (signed-out tab): no guard. Signed-out pages don't call `userApi`.
- *Rejected: an interceptor-only fix without the listener.* The tab would keep showing A while silently failing every call.

**3. Refresh failures: end the session only on `400`/`401` from the refresh endpoint.**
- `SafeTokenRefreshSerializer` turns every bad, expired, blacklisted, password-mismatched or ownerless token into `InvalidToken` (`401`). A `400` means the stored token is missing or malformed, which is also unrecoverable.
- Everything else is rethrown to the waiting callers without `forceLogout()`. The queue is rejected with the same error, and `isRefreshing` resets in `finally`, so the next `401` tries again.
- The callers already surface this through `LoadError` / `showError` (`surface-failures`).
- The `rotationArrives` grace logic is unchanged.

**4. A `TokenSessionThrottle(AnonRateThrottle)` with `scope = "token_refresh"`, `60/min`, set as the *only* throttle on both views.**
- Refresh: `SafeTokenRefreshView.throttle_classes = [TokenSessionThrottle]`. Logout: `TokenBlacklistView.as_view(throttle_classes=[TokenSessionThrottle])` in `urls.py`, so no subclass is needed.
- Replacing the class list (not adding to it) is what removes the 300/day anon cap.
- `AnonRateThrottle` is correct here despite the CLAUDE.md "use `UserRateThrottle` for authenticated" rule: these views authenticate nobody, so `request.user` is always anonymous and the key is the IP either way.
- 60/min per IP is 86,400/day. That is far above ~24 refreshes per device per day for any realistic NAT, and still bounds a token-guessing flood.
- One shared scope for both views keeps the settings to one line. Logout volume is negligible.

**5. `profile`: snapshot the claim before the serializer validates.**
- `claim_before = get_md5_hash_password(request.user.password)` is read first, before `is_valid()`, which is where the rehash happens. After save, issue a token pair when `new_password` was set **or** the claim changed.
- Revocation still runs only for `new_password`. A rehash is the same password, and other sessions are already invalidated by the claim check regardless.
- The client's `updateProfile` already stores `access`/`refresh` whenever they are present, so no frontend change is needed.
- *Rejected: a custom PBKDF2 hasher whose `must_update` ignores iteration downgrades.* It would also stop the login-time logout, but it adds a project-specific hasher to `PASSWORD_HASHERS` forever to fix a one-time effect of the Django 6.0→5.2 pin. Documenting it is the backlog's decided path. The same snapshot pattern doesn't help login: the session logging in gets fresh tokens anyway, and the sessions it ends are other devices.

## Risks / Trade-offs

- [A reload discards unsaved input in tab 2 (e.g. a half-typed review)] → Acceptable. That input belongs to account A, which has left this tab, and saving it would be the bug itself.
- [A guard rejection shows an error toast just before the reload] → `SessionChangedError` callers show a generic error briefly. This is acceptable for an event the user caused in another tab, and silencing it would need per-call-site changes.
- [Rate-limited refresh leaves the user "signed in" with failing calls] → Each call shows `LoadError` with Retry, and the next attempt refreshes again. This is better than a forced logout that would also be rate-limited on re-login (`login: 10/min`).
- [`storage` events don't fire in the tab that made the change] → Intended. That tab already updates its own state.

## Migration Plan

No data migration, and no change to the token format. Deploying changes only the throttle buckets: the old anon-scope counters for these two views are simply no longer consulted. To roll back, revert the commit.
