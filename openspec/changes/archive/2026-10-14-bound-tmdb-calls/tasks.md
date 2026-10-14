## 1. Deadline helper and timeout tuples

- [x] 1.1 `tmdb_client`: add `TMDBDeadlineExceeded(requests.Timeout)`, a bounded `_DEADLINE_POOL` (8 workers, `tmdb-deadline`), `call_with_deadline(fn, deadline, *args, **kwargs)` (cancels a not-yet-started call on timeout), `TMDB_CALL_DEADLINE = 10` and `TMDB_TIMEOUT = (3.05, 6)` as the default for `_get`/`_post`/`_delete`
- [x] 1.2 Tests: a call that finishes in time returns its value; a call blocked on an `Event` raises `TMDBDeadlineExceeded` after ~the deadline (tiny deadline) and is caught by `except requests.RequestException`; a queued call that never started is cancelled; `_get`/`_post`/`_delete` pass the tuple timeout

## 2. Proxy

- [x] 2.1 `tmdb_proxy_views`: run `_session.get` through `call_with_deadline(..., PROXY_DEADLINE_SECONDS=20)`, map `TMDBDeadlineExceeded` to the existing 502 path; drop `_worst_case_seconds`/`WORST_CASE_SECONDS` and update the comment
- [x] 2.2 Tests: the gunicorn pin now asserts `PROXY_DEADLINE_SECONDS ≤ timeout − 5`; a proxied call whose fetch hangs (patched `_session.get` blocking on an `Event`, deadline patched small) returns 502 within the deadline and isn't cached; a connect that hangs on four resolved addresses (patched `socket.getaddrinfo` returning four entries, `create_connection` patched to sleep each attempt) still returns 502 within the deadline

## 3. TMDB connect, disconnect, account deletion

- [x] 3.1 `tmdb_request_token` and `tmdb_create_session`: TMDB calls through `call_with_deadline(..., TMDB_CALL_DEADLINE)`
- [x] 3.2 Add `revoke_in_background(user_id, session_id)` (on_commit + daemon thread, no DB/cache) in `tmdb_client`
- [x] 3.3 Reconnect: save the new session first, then schedule the old session's revoke; a failed save revokes nothing
- [x] 3.4 Disconnect: clear and save, then schedule the revoke. `delete_account`: read the session id, `user.delete()`, then schedule the revoke
- [x] 3.5 Tests: create-session with TMDB hanging → 502 within budget, stored session unchanged; reconnect stores the new session and revokes the old one after commit (revoke not called inside the request's transaction); a `profile.save()` failure on reconnect revokes nothing and keeps the old session; disconnect and delete-account respond without waiting for a hanging revoke, and the account is gone / session cleared; budget pins for both connect endpoints (`TMDB_CALL_DEADLINE ≤ timeout − 10`)

## 4. Rating sync

- [x] 4.1 `ratings_views`: DELETE deletes locally first, then syncs; POST/PATCH sync after the save; every sync through `call_with_deadline(..., TMDB_CALL_DEADLINE)`, an overrun logged like any sync failure (type only)
- [x] 4.2 Tests: with TMDB hanging, POST/PATCH/DELETE succeed within the budget and the local change is saved; DELETE removes the row even if the sync fails; rate then delete sends post then delete to TMDB in that order; budget pin for the rating endpoints

## 5. Stats

- [x] 5.1 `stats_views`: each genre lookup through `call_with_deadline(..., GENRE_LOOKUP_DEADLINE=8)`; an overrun falls back to the built-in names like any failure
- [x] 5.2 Tests: update `test_stats_genres`' pin to `2 × GENRE_LOOKUP_DEADLINE ≤ timeout − 10`; a hanging lookup (patched, small deadline) still answers with built-in names within the budget

## 6. Docs and verification

- [x] 6.1 CLAUDE.md: the TMDB budget sentence names `call_with_deadline` as how request-path TMDB calls are bounded (and that budgets are calls × deadline, not a retry model); TMDB session revokes run after the local change via `revoke_in_background`
- [x] 6.2 `docs/ARCHITECTURE.md`: why a wall-clock deadline replaced the retry model (per-address connects); why rating sync stays in the request (cross-process order)
- [x] 6.3 CHANGELOG `[Unreleased]`; `docs/BUG_BACKLOG.md` item 27 → 📝 now, ✅ on archive, and close item 17's "urllib3 per-IP timeout" note
- [x] 6.4 Run the full backend pytest, `ruff check backend/`, `makemigrations --check --dry-run` (`DEBUG=True`); no frontend change, so no e2e
