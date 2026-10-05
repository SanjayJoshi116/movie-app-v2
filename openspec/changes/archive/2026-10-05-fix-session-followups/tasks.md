## 1. Frontend: logout teardown holds on every page

- [x] 1.1 Add `saveSessionCache(key, value)` to `src/api/userApi.ts` (writes `sessionStorage` only while `cinedb_access` exists) (D1)
- [x] 1.2 Route the unmount save in `RecommendationsPage.tsx` (`REC_CACHE_KEY`) and `SearchPage.tsx` (per-query cache) through `saveSessionCache`
- [x] 1.3 Grep for any other unmount-cleanup `sessionStorage`/`localStorage` writes and route them the same way if account-scoped

## 2. Frontend: token refresh coordination

- [x] 2.1 Wrap the refresh network step in `navigator.locks.request("cinedb-token-refresh", …)` with an unlocked fallback when `navigator.locks` is undefined; inside, skip the POST and use the stored access token if `cinedb_refresh` changed since the 401 was handled (D2)
- [x] 2.2 On refresh rejection, adopt stored tokens instead of `forceLogout()` when `cinedb_refresh` changed since the request was sent (D2 fallback)
- [x] 2.3 After a successful refresh, store the new pair only if `cinedb_refresh` still equals the token sent; otherwise discard, reject queued/original requests, no redirect (D3)
- [x] 2.4 Give the refresh POST an explicit 10s axios `timeout` so the lock is always released

## 3. Frontend tests

- [x] 3.1 Logging out while `RecommendationsPage` (and `SearchPage` with results) is mounted leaves no `cinedb_recommendations` / search cache in `sessionStorage`
- [x] 3.2 With a mocked `navigator.locks`: two "tabs" (interceptor calls sharing one storage) both 401 → exactly one refresh POST, both requests succeed, no redirect
- [x] 3.3 Without `navigator.locks`: refresh rejected but `cinedb_refresh` changed meanwhile → requests replayed with stored token, no redirect; refresh rejected and token unchanged → forced logout as before
- [x] 3.4 Logout during an in-flight refresh → after the response resolves, no `cinedb_access`/`cinedb_refresh` in storage
- [x] 3.5 Existing `userApi`/`AuthContext.logout` tests still pass

## 4. Backend: recommendation slot, revoke-all, cache, proxy

- [x] 4.1 `_refresh_cache_by_id`: catch `django.db.Error` around the user lookup, log, `_finish_refresh(user_id)` (D4); test with the lookup patched to raise → slot released, next trigger starts a refresh, queued follow-up not stranded
- [x] 4.2 `_revoke_all_refresh_tokens`: filter unexpired + not-blacklisted, `bulk_create(ignore_conflicts=True)` (D5); test that query count is constant with many expired tokens and existing revocation tests still pass
- [x] 4.3 Production `CACHES`: add `OPTIONS: {"MAX_ENTRIES": 50_000}` (D6); test (with DatabaseCache in a settings override) that >300 distinct throttle keys don't evict an over-limit client's counter
- [x] 4.4 `tmdb_proxy_views.py`: module constants for timeout/retry, computed `WORST_CASE_SECONDS`, new values per D7; `--timeout 30` in `docker-entrypoint.sh`; unit test asserting `WORST_CASE_SECONDS < 25`

## 5. Tooling

- [x] 5.1 `backend/requirements-test.txt`: `pytest>=8.4`
- [x] 5.2 `test_settings_fail_closed.py`: probe disables `dotenv.load_dotenv` before importing settings; fix the helper docstring; verify the tests pass with `DEBUG=True` present in `backend/.env`
- [x] 5.3 Add `.gitattributes` with `*.sh text eol=lf`; convert `backend/docker-entrypoint.sh` to LF in the working tree

## 6. Docs

- [x] 6.1 `docs/ARCHITECTURE.md`: bullets for cross-tab refresh lock + session-unchanged write guard, and `saveSessionCache` for unmount saves; update the revoke-all bullet (live tokens only, bulk)
- [x] 6.2 CLAUDE.md conventions: any unmount-time cache write must go through `saveSessionCache`; logout paths must call `clearSession()` before clearing auth state
- [x] 6.3 README / `.env.example`: note that `.env.docker` must list real hosts in `ALLOWED_HOSTS` (wildcard refused with `DEBUG` off)

## 7. Verification

- [x] 7.1 `npx tsc --noEmit`, frontend Jest (`src/api`, `src/context`, new page tests), backend `pytest` all pass
- [x] 7.2 Playwright: log out from `/recommendations` and from `/search` as A, log in as B in the same tab → no A data in `sessionStorage` or on screen
- [x] 7.3 Playwright: two pages in one browser context with 1-min access tokens, force simultaneous 401s → one refresh, neither page redirected
- [x] 7.4 Remind operator to fix `.env.docker` `ALLOWED_HOSTS` (manual, do not edit the file)
