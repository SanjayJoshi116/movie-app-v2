## 1. Backfill cap

- [x] 1.1 `metadata_backfill`: `MAX_CONCURRENT_BACKFILLS = 2`, a `BoundedSemaphore` taken first thing in `_run_backfill` (before loading entries), released in its `finally`
- [x] 1.2 pytest: with TMDB fetches held, starting backfills for more users than the cap runs at most the cap at once and the rest finish after; waiting backfills open no DB connection

## 2. Threaded server and pools

- [x] 2.1 `docker-entrypoint.sh`: `--worker-class gthread --threads 8` (keep `--workers 3 --timeout 30`)
- [x] 2.2 `tmdb_client._DEADLINE_POOL` to 16; proxy session `HTTPAdapter(pool_connections=4, pool_maxsize=16, max_retries=RETRY)`
- [x] 2.3 Static tests: gunicorn line has `gthread` and `--threads` ≥ 4; deadline pool and proxy pool ≥ the thread count

## 3. Token flush

- [x] 3.1 `warmup.run_warmup(cmd, timeout, label=…)`: messages name the step
- [x] 3.2 `docker-entrypoint.sh`: `timeout 60 python manage.py flushexpiredtokens || echo …` before the warm-up; `start.py`: the same through `run_warmup`
- [x] 3.3 Tests: entrypoint flush line bounded, with fallback, before gunicorn; `start.py` calls it; `flushexpiredtokens` removes expired and keeps unexpired tokens (and their blacklist rows)

## 4. Verify

- [x] 4.1 Backend pytest, `ruff check backend/`
- [x] 4.2 `npm run dev` starts (flush step runs, server up)

## 5. Docs

- [x] 5.1 CLAUDE.md (Docker stack: threaded workers and what `--timeout` means now; startup steps incl. the flush; backfill cap beside the refresh cap), ARCHITECTURE.md (`OutstandingToken` note), README (startup steps), CHANGELOG not touched here
- [x] 5.2 `docs/BUG_BACKLOG.md`: item 38 → 📝, linked
