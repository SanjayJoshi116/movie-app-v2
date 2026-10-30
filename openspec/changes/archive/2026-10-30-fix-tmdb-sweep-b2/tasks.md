## 1. One TMDB client (decisions 1, 4)

- [x] 1.1 Move `_session` and `SESSION_POOL_SIZE` into `tmdb_client`; one `_request(method, path, params, json, timeout)` through it, raising `ValueError` on a non-object body; `_get/_post/_delete` as wrappers; remove `get_genre_ids`
- [x] 1.2 `get_genre_names`: `or []`, skip malformed entries, catch `TypeError/AttributeError`, static fallback when nothing usable; `discover`/`get_details_with_cast` tolerate `null` lists
- [x] 1.3 Tests: client calls go through the shared session (patched `_session.request`); a list body is a `ValueError`; `{"genres": null}`, a list body and entries without names give the static names; a refresh with a null genre list labels sections by name

## 2. Proxy (decisions 2, 3, 5, 6)

- [x] 2.1 Import the session and `TMDB_TIMEOUT` from the client; drop the proxy's own session and timeouts
- [x] 2.2 `call_with_deadline(..., executor=)`; the proxy runs on its own `PROXY_POOL`
- [x] 2.3 Path allowlist with `400` before any cache or upstream work
- [x] 2.4 Upstream `401`/`403` → `502`; `429` passed on with `Retry-After`
- [x] 2.5 Cache key from sorted params
- [x] 2.6 Tests: `%3F`, `..%2F`, `%25`, empty segment → 400 with no upstream call; nested paths forwarded; 401 → 502 uncached; 429 keeps `Retry-After`; reordered params hit; a full proxy pool doesn't delay a `call_with_deadline` on the default pool; `test_startup_warmup` pins both pools ≥ the thread count

## 3. Budget (decision 7)

- [x] 3.1 `take()`: create with the grant applied; save only when granted > 0 or the day changed
- [x] 3.2 Tests: an exhausted budget issues no UPDATE; existing budget tests pass

## 4. Docs and verify

- [x] 4.1 `CLAUDE.md`: the TMDB session lives in `tmdb_client` and every backend TMDB call uses it; the proxy has its own deadline pool; the proxy path allowlist; upstream 401/403 → 502. `docs/BUG_BACKLOG.md` item 51: verdicts and 📝 `fix-tmdb-sweep-b2`
- [x] 4.2 Backend `pytest`, `ruff check backend/`, `makemigrations --check --dry-run` (all with `DEBUG=True`); `RUN_LIVE_TMDB=1 pytest -m live_tmdb` (the change touches every TMDB request path)
