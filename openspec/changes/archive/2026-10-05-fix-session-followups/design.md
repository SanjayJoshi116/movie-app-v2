## Context

This change follows up the uncommitted work from `harden-security-p0`, `fix-ops-reliability` and `fix-session-lifecycle` (all archived 2026-10-04/05). Findings from the 2026-10-05 diff review and audit, verified against the current tree:

- `RecommendationsPage.tsx:241-250` saves `cinedb_recommendations` in an unmount cleanup. `SearchPage.tsx:104-111` does the same for its per-query cache. `AuthContext.logout()` runs `clearSession()` (`sessionStorage.clear()`) and then `setUser(null)`. The rerender unmounts the route, and the cleanup writes user A's data back with a fresh timestamp. `readRecCache()` accepts it, sets `hasFetched`, and user B never fetches their own recommendations until the 5-minute TTL expires. The earlier Playwright check missed this because it logged out from `/movies`.
- `userApi.ts`'s interceptor coordinates refreshes only within one tab (`isRefreshing`/`failedQueue`). Two tabs that refresh with the same token R1 at the same time race: the server rotates and blacklists R1 for one tab and rejects the other. The losing tab's `forceLogout()` → `clearSession()` wipes the shared `localStorage`, including the R2 the winner just stored, so both tabs land on `/login`.
- If `logout()` runs while a refresh is in flight, the refresh response writes a live access token and R2 back after the teardown.
- `recommendations._refresh_cache_by_id` runs `User.objects.filter(pk=user_id).first()` outside `_refresh_cache`'s try/finally. A DB error there leaves `user_id` in `_computing_users` for the life of the process, so the views return `pending` forever.
- `_revoke_all_refresh_tokens` runs two queries per `OutstandingToken`, expired ones included. Nothing schedules `flushexpiredtokens`.
- Production `CACHES` is `DatabaseCache` with the default `MAX_ENTRIES=300`. Past that, `set()` culls a third of the keys, which resets throttle counters early.
- `tmdb_proxy_views.py`: `Retry(total=4, connect=4, read=4, backoff_factor=0.5)` with `timeout=20`, so the worst case is about 100s. gunicorn (`docker-entrypoint.sh`) runs sync workers with the default 30s timeout.
- `backend/pytest.ini` loads `-p pytest_dev_env`. That needs pytest ≥ 8.4 (older versions import `-p` plugins before applying `pythonpath`), but `requirements-test.txt` says `pytest>=7.4`.
- `test_settings_fail_closed.py` strips `DEBUG` from the subprocess env, but `settings.load_dotenv(BASE_DIR / ".env")` fills it back in from a developer's `backend/.env`.
- `backend/docker-entrypoint.sh` is CRLF in this Windows checkout (`core.autocrlf=true`, no `.gitattributes`). The Docker build copies the working tree, so the shebang breaks.

## Goals / Non-Goals

**Goals:**
- Logout leaves no account-scoped data, from any page.
- Concurrent refreshes across tabs never end a valid session.
- Every background refresh path releases its slot.
- Keep the uncommitted work's tooling (tests, Docker build) working on a fresh Windows checkout.

**Non-Goals:**
- **The password-change vs. in-flight-refresh race on another device.** A rotated token recorded after the revoke-all loop survives. Closing that window needs a per-user "tokens issued before T are invalid" check on refresh (a custom refresh serializer comparing `iat` with a stored timestamp). The window is milliseconds, and the token still dies at the user's next password change, so this is out of scope.
- **Moving the throttle cache to Redis.** That is new infrastructure, and a sized `DatabaseCache` is enough at this scale.
- **Redaction for loggers outside `userdata`.** No live path reaches them today. This is a latent gap, tracked separately.
- **Atomicity of migration 0018's file operations.** It needs a mid-migration DB failure to matter.
- **Editing the operator's untracked `.env.docker`.** That is a manual step and is only documented here.

## Decisions

### D1. Session-aware cache writes for unmount saves
Add `saveSessionCache(key, value)` to `src/api/userApi.ts`, next to `clearSession()`. It writes to `sessionStorage` only while a session exists (`localStorage.cinedb_access` is present). The unmount saves in `RecommendationsPage` and `SearchPage` call it instead of `sessionStorage.setItem`. Teardown order is already guaranteed: `logout()` runs `clearSession()` synchronously before `setUser(null)` triggers the unmount, and `forceLogout()` clears before redirecting. So when the cleanup runs, the guard sees no session and skips the write.

Change-triggered writers (`useLibraryFilters`, the `SS_SEARCH` effects) are left alone. They only run on user input, which can't happen between teardown and unmount.

**Rejected:** keying each cache by user id. It works, but it leaves the previous user's data sitting in storage (and readable) until the TTL expires, and every reader would need to change too.

### D2. Cross-tab refresh with the Web Locks API
Wrap the network part of a refresh in `navigator.locks.request("cinedb-token-refresh", ...)`. Inside the lock:
1. Re-read `cinedb_refresh`. If it differs from the token the tab saw when it handled the `401`, another tab has already rotated it. Skip the network call and continue with the stored `cinedb_access`.
2. Otherwise POST the refresh as today.

On rejection, if the stored refresh token has changed since the request was sent, adopt the stored tokens instead of calling `forceLogout()`.

*Found during live verification (7.3):* Chromium syncs `localStorage` between tabs asynchronously, with each renderer caching its own copy. So step 1's re-read inside the lock can still see the old token about 20ms after the other tab stored the new one and released the lock. The waiting tab then sends one extra refresh with the already-rotated token, which gets `401`. That makes the comparison on rejection a required second line of defense, not just a fallback. On a `401` rejection with storage still unchanged, the tab therefore waits up to 1.5s for a `storage` event carrying a new `cinedb_refresh` before logging out. That wait only delays the genuinely-revoked case, by at most 1.5s. Network errors keep today's behavior.

**Rejected:** an IndexedDB rotation marker written before releasing the lock. IndexedDB reads are consistent across tabs, so it would give exactly one request. But it means more code, and Jest would need `fake-indexeddb`, all to save one rejected request in a rare case. This is the fallback for environments without `navigator.locks` (jsdom, very old browsers), where the code runs unlocked and keeps only this check. The in-tab `isRefreshing`/`failedQueue` and the late-401 header comparison stay as they are: the lock only serializes across tabs.

**Rejected:** BroadcastChannel leader election, which needs more code and more failure modes for the same result. A `storage`-event handshake is racy without a lock.

### D3. Write tokens only if the session is unchanged
After a successful refresh response, store the new pair only if `localStorage.cinedb_refresh` still equals the token that was sent. If it is gone (logout happened) or different (a different login happened), discard the response, reject the queued and original requests, and don't redirect, because local state already reflects the user's action. This uses the same comparison as D2 and runs inside the lock.

### D4. Release the slot when user loading fails
In `_refresh_cache_by_id`, catch `django.db.Error` around the user lookup, log it, and call `_finish_refresh(user_id)`. If a follow-up was queued, `_finish_refresh` hands it on as usual; if that run also fails, it releases the same way, so the chain is bounded. `_refresh_cache` keeps its existing broad try/finally.

### D5. Revoke only live, non-blacklisted tokens, in bulk
```python
live = OutstandingToken.objects.filter(
    user=user, expires_at__gt=timezone.now(), blacklistedtoken__isnull=True
)
BlacklistedToken.objects.bulk_create(
    [BlacklistedToken(token=t) for t in live], ignore_conflicts=True
)
```
That is 2 queries whatever the token history. Expired tokens are already rejected by signature/expiry checks, so skipping them changes nothing. `ignore_conflicts` covers a concurrent logout blacklisting one of them.

### D6. Size the shared cache
Set `"OPTIONS": {"MAX_ENTRIES": 50_000}` on the production `DatabaseCache`. There are about 7 throttle scopes, each with one key per client, and `DatabaseCache._cull` drops expired rows before culling live ones. So 50k covers several thousand concurrently active clients with daily windows. The trade-off is that `DatabaseCache` runs a `COUNT(*)` on every `set()`, which is acceptable at this size (indexed small table).

### D7. Bound the proxy's worst-case time
Expose the timeout and retry settings as module constants, plus a computed `WORST_CASE_SECONDS` from the urllib3 `Retry` semantics (attempts × (connect + read timeout) + summed backoff). Pick values that keep connect retries for the transient-reset case that motivated the shared session, and cut read retries and the read timeout, e.g. `timeout=(3.05, 6)`, `Retry(total=2, connect=2, read=1, backoff_factor=0.5)`. Make gunicorn's timeout explicit (`--timeout 30` in `docker-entrypoint.sh`), and add a unit test asserting `WORST_CASE_SECONDS < 25`, which leaves headroom under 30. The exact numbers are an implementation detail; the test-enforced inequality is the decision.

### D8. Tooling fixes
- `requirements-test.txt`: `pytest>=8.4`.
- `test_settings_fail_closed.py`: the probe disables dotenv before importing settings (`import dotenv; dotenv.load_dotenv = lambda *a, **k: False; import cinedb.settings ...`). Each test then fully controls the environment, and no test-only hook is added to production settings. Update the helper's docstring, which currently claims `.env` can't interfere.
- New `.gitattributes`: `*.sh text eol=lf`. Convert `backend/docker-entrypoint.sh` in the working tree to LF.

## Risks / Trade-offs

- **Web Locks availability:** `navigator.locks` is in every evergreen browser, but not in jsdom. The unlocked fallback (the D2 comparison) still covers most interleavings. Jest tests mock `navigator.locks` to exercise the locked path and also run without it.
- **A lock held by a hung refresh:** if the refresh request never resolves, other tabs wait on the lock. The refresh POST gets an explicit axios `timeout` (10s) so the lock is always released.
- **Shorter proxy read timeout:** a TMDB endpoint that legitimately takes more than 6s would now 502 sooner. TMDB p99 latency is far below that, and the old behaviour (worker killed at 30s) was worse.
- **`saveSessionCache` relies on teardown running before unmount:** if a future logout path called `setUser(null)` before `clearSession()`, the guard would let the write through. Mitigation: a CLAUDE.md convention line and a Jest test that logs out while the recommendations page is mounted.

## Migration Plan

Frontend and backend changes are independent, and there are no API or DB changes. These fixes land in the same working tree as the three archived changes, before that work is committed. The operator must update `.env.docker` (`ALLOWED_HOSTS` = real hostnames) before the next `docker compose up`. That requirement already came from `harden-security-p0` and is documented here.
