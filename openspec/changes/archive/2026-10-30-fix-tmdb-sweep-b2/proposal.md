## Why

The module review sweep's second pass, over TMDB access (BUG_BACKLOG item 51, `/code-review high` and `/security-review` on 2026-10-30), found ten issues. Checked against the code, five hold at medium and three low ones are cheap to fold in. The common thread: the proxy and the backend's own TMDB client grew apart (one has a pooled, retrying session and the other doesn't), the shared deadline pool lets a stalled proxy starve rating sync and TMDB connect, and some upstream answers (a bad key, a rate limit, a malformed body) come out as the wrong thing.

## What Changes

- **One TMDB HTTP session for the whole backend.** The proxy's pooled `requests.Session` with transient-reset retries moves into `tmdb_client`, and every backend call (`_get`/`_post`/`_delete`, now one `_request`) uses it. Recommendations fills, backfills, followed-people credits, rating sync and connect stop paying a TLS handshake per call and stop failing on single resets. The proxy reuses the client's timeouts instead of restating them.
- **The proxy runs on its own deadline pool.** A stalled TMDB can leave abandoned proxy calls running past their deadline; with their own pool they can only delay other proxy calls, never rating sync, TMDB connect or Stats.
- **Upstream auth and rate-limit answers are translated.** A TMDB `401`/`403` (the server's key) becomes a `502`, so the frontend no longer takes it for an expired sign-in and retries every call without a token. A TMDB `429` keeps its `Retry-After`.
- **A malformed TMDB body is a failed call, not a crash.** A non-object JSON body raises `ValueError` in the client (every caller already handles it), and a `null` genre or result list reads as empty. `get_genre_names` falls back to the static names for these too, so recommendations never show raw genre ids.
- **The proxy cache key ignores parameter order**, so the same request with parameters in another order is a cache hit.
- **The proxy accepts only plain TMDB paths** (letters, digits, `_`, `-`, separated by single `/`). A decoded `?`, `#`, `%`, `.` or `..` segment is refused with `400`, so the cache and credential checks see exactly what goes upstream. Hardening: the security review found no exploit.
- **Cleanups:** `get_genre_ids` (unused) removed; `tmdb_budget.take()` writes only when the grant or the day changed.

Not changed (checked): redaction of dict-repr and percent-encoded credentials (no code logs those forms; the dev server's request log is dev only); per-entry time-zone parsing in Stats (`ZoneInfo` caches its instances).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tmdb-proxy-cache`: identical requests hit the cache whatever their parameter order; the proxy refuses paths that aren't plain TMDB paths; upstream key and rate-limit answers are translated.
- `endpoint-time-budgets`: a stalled TMDB proxy can't take the time budget of other TMDB-bound endpoints.
- `recommendation-sections`: a malformed genre-list answer still yields genre names, never ids.

## Impact

- Backend only: `backend/userdata/tmdb_client.py`, `tmdb_proxy_views.py`, `tmdb_budget.py`; tests in `test_tmdb_proxy.py`, `test_tmdb_deadline.py`, `test_startup_warmup.py`, `test_data_correctness.py`, `test_rec_refresh_bounds.py` and the tests that patch `tmdb_client._get`.
- No API shape, migration, setting or dependency change. The proxy's `400` for a malformed path and `502` for an upstream `401`/`403` are new status codes for requests the frontend never makes, apart from the bad-key case.
