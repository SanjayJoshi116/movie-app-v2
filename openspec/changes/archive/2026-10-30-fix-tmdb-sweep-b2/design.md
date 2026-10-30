## Context

Item 51, checked against the code on 2026-10-30:

- `tmdb_proxy_views.py` owns `_session` (`HTTPAdapter(pool_maxsize=16, max_retries=Retry(total=2, connect=2, read=1, backoff_factor=0.5))`) and restates `CONNECT_TIMEOUT=3.05`/`READ_TIMEOUT=6`. `tmdb_client._get/_post/_delete` are three copies of bare `requests.<verb>` + `raise_for_status` + `json()`; `_get` is also called directly by recommendations, backfill and followed-people code, and tests patch `userdata.tmdb_client._get` and `userdata.tmdb_proxy_views._session.get`.
- `call_with_deadline` submits to one `_DEADLINE_POOL` (16). The proxy's worst case per call (3 attempts, 4 DNS addresses, 3.05 s connect, 6 s read, backoff) is well past its 20 s deadline, and the abandoned future keeps its slot.
- The proxy returns `Response(data, status=r.status_code)`: TMDB's `401` reaches `src/api/tmdb.ts`, which treats any `401` as its own expired JWT and retries without the token; no upstream header is copied.
- `get_genre_names` iterates `data.get("genres", [])` and catches `RequestException/ValueError/KeyError`: `null` raises `TypeError`, a list body `AttributeError`. `recommendations.py` wraps the call in `except TypeError` only to set an empty map.
- `_cache_key` hashes params in received order. `tmdb_path` is used as given after Django's decoding; the security review confirmed `?`/`..` are rewritten by urllib3 but found no exploit.
- `get_genre_ids` has no callers. `tmdb_budget.take()` always saves.

## Goals / Non-Goals

**Goals:** the five medium findings, the path allowlist, the dead code and the budget write.

**Non-Goals:** redaction patterns for dict repr / percent-encoding (nothing logs those forms); Stats' per-entry zone parsing (`ZoneInfo(key)` is cached by the standard library); dropping or capping unknown proxy params (throttle-bound; the cache is size-bounded and separate from `default`).

## Decisions

1. **Session in `tmdb_client`.** Move `_session` (same adapter, retry and pool size; `SESSION_POOL_SIZE` moves with it) and `TMDB_TIMEOUT` stays the one timeout. One `_request(method, path, params=None, json=None, timeout=TMDB_TIMEOUT)` adds the key, sends through `_session.request`, raises for status, parses JSON, and raises `ValueError` when the body isn't a JSON object. `_get/_post/_delete` stay as one-line wrappers, so existing callers and test patches keep working. The proxy imports `_session` and `TMDB_TIMEOUT` (its tests patch `tmdb_proxy_views._session.get`, the same object). urllib3's `Retry` never retries a POST/DELETE after the request was sent (read retries cover idempotent methods only); connect retries are safe because nothing reached TMDB.
2. **Proxy deadline pool.** `call_with_deadline(fn, deadline, *args, executor=None, **kwargs)`; the proxy passes its own `PROXY_POOL` (`ThreadPoolExecutor(16, thread_name_prefix="tmdb-proxy")`). `test_startup_warmup`'s pool-size pin covers both pools. Alternative, capping proxy retries so the worst case fits the deadline: the connect-per-address behaviour depends on DNS, which is why deadlines exist; rejected.
3. **Status translation.** After the fetch: `401`/`403` → log a warning (status only) and the existing 502 body; `429` → pass through with `Retry-After` copied when present. Neither is cached (only `200` is, unchanged).
4. **Malformed bodies.** `_request`'s non-object check covers every caller. In `get_genre_names`, iterate `data.get("genres") or []`, skip entries without `id`/`name`, and add `TypeError`/`AttributeError` to the caught set; an empty result after parsing also falls back to the static map. `discover` and `get_details_with_cast` use `or []`/`or {}` for their lists.
5. **Cache key.** `urlencode(sorted(params))` in `_cache_key` only; what goes upstream keeps the received order.
6. **Path allowlist.** `_TMDB_PATH = re.compile(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*")`, `fullmatch` before anything else; else `400 {"error": "Invalid TMDB path."}`. Every path the frontend builds (`src/api/tmdb.ts`) fits; `useValidId` already restricts ids to digits.
7. **Budget.** Save only when `granted > 0` or the day rolled over; create a first row with the grant applied.

## Risks / Trade-offs

- The shared session's pool (16) now also serves background fills; `pool_block` stays off, so a burst opens extra connections and discards them rather than blocking.
- A future TMDB path with a dot (none today) would need the allowlist widened; the live checks (`test_tmdb_live.py`) would catch it.
- Mapping `403` to `502` also covers TMDB's rare `403` for a resource; those are server-side errors from the user's point of view anyway.
