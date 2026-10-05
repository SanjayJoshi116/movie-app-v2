## Why

The three changes applied on 2026-10-04/05 (`harden-security-p0`, `fix-ops-reliability`, `fix-session-lifecycle`) are still uncommitted. A review of that diff, plus a fresh audit on 2026-10-05, found regressions and gaps in it. The most visible: logging out from the Recommendations or Search page still leaks the previous user's cached data to the next user in the tab. The cause is that those pages write their cache back to `sessionStorage` when they unmount, which happens *after* `clearSession()` has emptied it. Other findings: one DB error can permanently block a user's recommendation refreshes, two tabs refreshing at once log each other out, and the new test/settings setup breaks for developers who follow the documented `DEBUG=True` advice. These should be fixed before the work is committed, so the commit doesn't ship known regressions.

## What Changes

- **Logout teardown is final:** page-level caches that save on unmount (Recommendations, Search) no longer write anything once the session is gone. Logging out from any page leaves no account-scoped data behind.
- **Cross-tab token refresh:** concurrent refreshes in several tabs of the same browser are serialized. A tab that finds the refresh token already rotated by another tab adopts the new tokens instead of logging out.
- **Logout during refresh:** a token refresh that completes after the user logged out doesn't write tokens back into storage.
- **Recommendation slot release:** a background refresh that fails before computing (e.g. the DB is unreachable when loading the user) still releases the user's in-flight slot. That user's recommendations no longer stay "pending" until the server restarts.
- **Revoke-all cost:** revoking all of a user's refresh tokens touches only tokens that are unexpired and not already blacklisted, in a bounded number of queries. A password change or reset stays fast however many old tokens have piled up.
- **Shared throttle cache capacity:** the production cache holding rate-limit counters is sized for the expected number of active clients. Counters are no longer culled after 300 entries.
- **TMDB proxy latency bound:** the TMDB proxy's worst-case time (timeouts × retries + backoff) stays under the application server's worker timeout, so a slow TMDB gets a clean `502` from the view instead of a killed worker.
- **Dev/test tooling:**
  - require `pytest>=8.4`, the minimum where the `-p pytest_dev_env` early-load works
  - the fail-closed settings tests stay correct when a developer's `backend/.env` sets `DEBUG=True`
  - shell scripts are checked out with LF line endings (`.gitattributes`), so the Docker entrypoint runs from a Windows checkout
- **Manual (operator):** the local, untracked `.env.docker` must replace `ALLOWED_HOSTS=*` with real hostnames before `docker compose up` works again. This is a consequence of `harden-security-p0` and is documented only, not changed by this change.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `auth-session`:
  - teardown must also hold when the user logs out from a page that caches on unmount
  - new requirements for cross-tab refresh coordination and for logout racing an in-flight refresh
- `recommendation-refresh`: a refresh that fails at any point (including before computation starts) must not block future refreshes for that user.
- `api-hardening`:
  - the shared rate-limit state must keep its counters regardless of the number of active clients
  - new requirement that the TMDB proxy responds within a bounded time

## Impact

- **Frontend:**
  - `src/api/userApi.ts`: cross-tab refresh lock, post-logout write guard, and a session-aware cache-write helper
  - `src/pages/RecommendationsPage.tsx` and `src/pages/SearchPage.tsx`: unmount saves go through the guard
  - Jest tests in `src/api/__tests__/` and `src/context/__tests__/`
- **Backend:**
  - `backend/userdata/recommendations.py` (`_refresh_cache_by_id`)
  - `backend/userdata/auth_views.py` (`_revoke_all_refresh_tokens`)
  - `backend/cinedb/settings.py` (`CACHES` options)
  - `backend/userdata/tmdb_proxy_views.py` (retry/timeout budget)
  - `backend/userdata/tests/test_settings_fail_closed.py`
  - new/extended tests
- **Tooling:**
  - `backend/requirements-test.txt` (pytest floor)
  - new `.gitattributes`
  - `backend/docker-entrypoint.sh` renormalized to LF
- **Docs:** `docs/ARCHITECTURE.md` bullets for the cross-tab refresh and the unmount-save guard. README/`.env.example` note about `.env.docker` `ALLOWED_HOSTS`.
- **No API shape changes, no migrations.**
