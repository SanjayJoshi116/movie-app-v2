## 1. Backend: refresh/logout throttle (B3)

- [x] 1.1 Add `"token_refresh": "60/min"` to `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES` in `backend/cinedb/settings.py`
- [x] 1.2 Add `TokenSessionThrottle(AnonRateThrottle)` with `scope = "token_refresh"` in `auth_views.py`, and set `throttle_classes = [TokenSessionThrottle]` on `SafeTokenRefreshView`. The comment should say why it is anon-based and replaces the defaults
- [x] 1.3 Wire logout as `TokenBlacklistView.as_view(throttle_classes=[TokenSessionThrottle])` in `urls.py`
- [x] 1.4 Tests (new `test_session_throttle.py`):
  - refresh and logout still succeed after the `anon` bucket for that IP is exhausted
  - refresh returns `429` past 60/min
  - 50×24 refreshes from one IP spread across minutes are not limited (override the cache timer, or assert the scope and rate directly)

## 2. Backend: rehash during profile edit (B5)

- [x] 2.1 In `profile` PATCH, snapshot `get_md5_hash_password(request.user.password)` before `serializer.is_valid()`. After save, return `_tokens_for_user(user)` when `new_password` was set or the claim changed. Revoke only for `new_password`
- [x] 2.2 Test in `test_password_bound_tokens.py`:
  - store a PBKDF2 hash with a non-default iteration count, change the email with `current_password`, and assert the response has `access`/`refresh` that pass a refresh and an authenticated GET
  - assert a name-only edit still returns no tokens (existing test stays green)

## 3. Frontend: refresh failure handling (B3)

- [x] 3.1 In `userApi.ts`'s response interceptor, call `forceLogout()` only when the refresh error is an axios error with status `400` or `401`. Rethrow other errors to the original caller and the queue without clearing storage
- [x] 3.2 Tests in `src/api/__tests__/userApi.test.ts`:
  - a refresh returning `429` / `503` / network error rejects the original request, keeps `cinedb_access`/`cinedb_refresh`, does not redirect, and lets a later `401` trigger a new refresh
  - a `401` refresh still forces logout

## 4. Frontend: tab bound to its account (F1)

- [x] 4.1 Export `bindSessionUser(id: number | null)` from `userApi.ts`. In the request interceptor, reject with `SessionChangedError` when a user is bound and `storedUserId()` differs
- [x] 4.2 In `AuthProvider`, call `bindSessionUser(user?.id ?? null)` whenever `user` changes. Bind synchronously in `login`/`register`/`setUserData`/`logout`, before `setUser`, so the first post-login request isn't rejected
- [x] 4.3 Add a `storage` listener in `AuthProvider` for `cinedb_user`/`cinedb_access` (and `e.key === null`). It re-reads storage and compares user ids with the current user:
  - stored session gone: `sessionStorage.clear()` + `setUser(null)`
  - a different id while signed in: `sessionStorage.clear()` + `window.location.reload()`
  - signed-out tab sees a new user: `setUser(parsed)`
  - same id with a changed payload: `setUser(parsed)`
- [x] 4.4 Tests in `src/context/__tests__/AuthContext.sync.test.tsx`, with dispatched `StorageEvent`s:
  - sign-out elsewhere clears state and sessionStorage
  - account switch reloads (mock `window.location.reload`)
  - same-user profile update adopts the new data without a reload
  - token-only rotation does nothing
- [x] 4.5 Interceptor test in `userApi.test.ts`: bound to user A with storage holding user B, a `userApi.post` rejects with no request sent (assert the adapter/mock was not called)

## 5. Verify and document

- [x] 5.1 Run `npm run typecheck`, `npm run lint`, the frontend unit tests, backend pytest, `ruff check backend/` and `makemigrations --check --dry-run`
- [x] 5.2 Live two-tab check with a `verify_*.js` Playwright script against `npm run dev`:
  - two pages in one context; switch accounts in page 1 and confirm page 2 reloads to B, and a click made in page 2 before the reload never writes to B
  - sign out in page 1 and confirm page 2 shows the signed-out state
  - delete the script afterwards
- [x] 5.3 Docs:
  - `docs/ARCHITECTURE.md`: a cross-tab account binding bullet, plus the login-time rehash ending other sessions once per hasher upgrade
  - CLAUDE.md: add `TokenSessionThrottle` to the throttle-scope bullet, and note under session teardown that `forceLogout` is 400/401-only and tabs bind via `bindSessionUser`
  - `docs/BUG_BACKLOG.md` item 11: status set to 📝 proposed now, ✅ when archived
