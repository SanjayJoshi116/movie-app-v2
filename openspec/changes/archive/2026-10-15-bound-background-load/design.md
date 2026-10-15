## Context

See proposal.md for why. Today:

- `metadata_backfill.request_backfill(user_id)` adds the user to `_running` (single-flight) and starts a daemon thread running `_run_backfill`: load the user's entries, `backfill_entries` (5-worker TMDB pool, writes on the thread), `connection.close()`. Recommendations' `_refresh_thread` already waits on `_refresh_slots = threading.BoundedSemaphore(4)` before opening a connection. `backfill_entries` is also called synchronously inside a refresh (already within a refresh slot).
- `docker-entrypoint.sh`: `migrate` → `createcachetable` → `timeout 30 … compute_recommendations || echo …` → `exec gunicorn cinedb.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 30`. Five tests read `--timeout (\d+)` from that line to pin endpoint budgets; `test_startup_warmup` checks the warm-up line comes before `exec gunicorn`.
- `start.py` runs the same steps for dev through `warmup.run_warmup(cmd, timeout)` (stdlib-only module, so it can be tested without Django), then `runserver` (already threaded).
- `tmdb_client._DEADLINE_POOL = ThreadPoolExecutor(max_workers=8)` per process; the proxy's `requests.Session` uses `HTTPAdapter` with the default 10-connection pool.
- `CONN_MAX_AGE` is 60 s in production, so each request thread keeps its own connection for a minute.
- simplejwt ships `manage.py flushexpiredtokens` (deletes `OutstandingToken` rows past `expires_at`; their `BlacklistedToken` rows cascade).

## Goals / Non-Goals

**Goals:** a bounded number of concurrent backfills; slow TMDB waits that don't starve the API; a token table that shrinks at each start.

**Non-Goals:** an async server or a task queue; a periodic in-process scheduler for the token flush (a restart or deploy runs it); changing endpoint budgets.

## Decisions

**1. A per-process semaphore for backfills, taken before any DB work.**
`MAX_CONCURRENT_BACKFILLS = 2` and `_backfill_slots = threading.BoundedSemaphore(...)`. `_run_backfill` acquires it first, then loads entries; the `finally` that closes the connection and clears `_running` stays. Only the background path takes it: the synchronous call inside a recommendation refresh is already bounded by the refresh slots, and taking a second semaphore there could deadlock against a backfill waiting on the refresh's own resources. Waiting threads are bounded by the per-user single-flight (one per user with pending metadata). *Alternative:* a fixed worker pool with a queue (more code, same bound).

**2. gunicorn `gthread`: 3 workers × 8 threads.**
`exec gunicorn … --workers 3 --worker-class gthread --threads 8 --timeout 30`. 24 concurrent requests; memory stays at 3 processes (numpy/sklearn load once per process). Django and DRF are thread-safe; the app's module-level state is either lock-guarded (`_computing_users`, `_running`, inflight maps) or a benign cache (`_genre_name_cache`). Under `gthread`, `--timeout` guards a hung worker process rather than killing a slow request, so the endpoint budgets (pinned under 30 s by the existing tests, unchanged) are what bound each request; `--timeout` stays explicit and the pins stay meaningful as an upper bound. *Alternatives:* more sync workers (user chose threads: ~3× memory for 3× concurrency); `gevent` (monkey-patching, new dependency).

**3. TMDB pools sized for the threads.**
`_DEADLINE_POOL` grows to 16 (8 request threads plus calls abandoned at their deadline still finishing); the proxy session's `HTTPAdapter(pool_connections=4, pool_maxsize=16)`, so concurrent proxy calls reuse connections instead of opening and discarding extras (urllib3 logs "Connection pool is full" otherwise).

**4. Flush expired tokens at every start, best-effort.**
Docker: `timeout 60 python manage.py flushexpiredtokens || echo "[cinedb] flushexpiredtokens skipped …"` after `createcachetable`, before the warm-up. Dev: `start.py` runs it through the same bounded helper as the warm-up. `warmup.run_warmup` gains a `label` parameter for its messages (default unchanged), so one tested helper covers both. *Alternative:* flushing from a request (adds latency and a DB write to a hot path) or cron (no scheduler in the stack).

**5. Static tests.**
`test_startup_warmup.py` (or a sibling) asserts: the entrypoint runs `flushexpiredtokens` with a `timeout` and a fallback before `exec gunicorn`; the gunicorn line has `--worker-class gthread` and `--threads N` (N ≥ 4); `start.py` calls the flush through the bounded helper. Pool sizes pinned against the thread count. Behaviour test for the semaphore with fake TMDB calls.

## Risks / Trade-offs

- [More DB connections: up to 24 kept per 60 s plus background threads] → still far under 100; documented.
- [Thread-safety of `requests.Session` under concurrent GETs] → widely used this way; the adapter's urllib3 pool is thread-safe; pool size raised so threads don't contend.
- [Can't run gunicorn locally (Windows)] → entrypoint verified statically; the first Docker deploy is the real check (stated in the summary and CHANGELOG).
- [A container never restarted never flushes] → every deploy restarts it; documented.
- [Backfills now wait] → Stats already shows what's stored and picks up the rest later; the wait is per process, not per user.

## Migration Plan

Ships with the next image. No migration. Rollback: revert the entrypoint line.
