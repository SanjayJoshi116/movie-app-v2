## Context

See proposal.md for the why. The constraints that shape the approach:

- gunicorn runs 3 sync workers with `--timeout 30` (`backend/docker-entrypoint.sh`). A sync worker serves one request at a time; a request that runs past 30 s gets the worker killed, nginx answers 502, and nothing after the kill point runs. No `ATOMIC_REQUESTS`, so whatever committed before the kill stays.
- `requests` applies a scalar `timeout` to connect and to each read separately, and urllib3's `create_connection` tries every address `getaddrinfo` returns, each with the full connect timeout. `api.tmdb.org` resolves to four addresses. Any per-attempt model (`tmdb_proxy_views._worst_case_seconds`) is therefore only as good as an assumption about DNS.
- The backend's only wall-clock deadline today is `social_views`' (followed people / notifications): a `ThreadPoolExecutor` whose futures are waited on with a timeout. That's the proven pattern here.
- CLAUDE.md's worker-thread rule: pool workers do HTTP only. DB and `django.core.cache` stay on the calling thread. `auth_views._in_background` threads must not touch the DB or the cache either.
- Request-path TMDB callers today:
  - the proxy (`_session.get` with `Retry`)
  - `tmdb_request_token` and `tmdb_create_session` (one call each, plus a revoke on reconnect)
  - `tmdb_disconnect` (a revoke)
  - the rating views (post or delete a rating)
  - `delete_account` (a revoke)
  - Stats (two genre-list calls on a cold cache)

  Notifications and followed recommendations already have a deadline.

## Goals / Non-Goals

**Goals:**
- One helper gives any request-path TMDB call a hard elapsed-time limit, independent of DNS and retries, and each endpoint's worst case becomes a simple product of call count × deadline that a test can pin.
- Never leave a revoked or half-replaced TMDB session stored, whatever point a request dies at.

**Non-Goals:**
- Deadlines for background TMDB work (recommendation refreshes, metadata backfill, the startup warm-up). Background threads don't hold a request open, so gunicorn's timeout doesn't apply to them. Item 28 covers their load.
- Moving rating sync to the background. Ordering across processes can't be kept without a DB read in the background thread, which the worker-thread rule forbids (see Decision 4).
- Retrying a failed sync or revoke later. Both stay best-effort and logged, as today.

## Decisions

### 1. `call_with_deadline` in `tmdb_client`
```python
_DEADLINE_POOL = ThreadPoolExecutor(max_workers=8, thread_name_prefix="tmdb-deadline")

class TMDBDeadlineExceeded(requests.Timeout): ...

def call_with_deadline(fn, deadline, *args, **kwargs):
    future = _DEADLINE_POOL.submit(fn, *args, **kwargs)
    try:
        return future.result(timeout=deadline)
    except FutureTimeout:
        future.cancel()          # not started yet: never runs
        raise TMDBDeadlineExceeded(f"TMDB call exceeded {deadline}s")
```
`TMDBDeadlineExceeded` subclasses `requests.Timeout`, so every existing `except requests.RequestException` already treats it as a failed TMDB call. The worker thread doing HTTP may run on after the deadline, bounded by its own timeouts. It touches nothing but the network (the worker-thread rule), so abandoning it is safe. The pool is bounded, so a TMDB outage can't spawn threads without limit. When all 8 workers are stuck, new calls queue and fail at their own deadline, which is the right answer during an outage. Calls that never started are cancelled.

*Alternatives:*
- **Model the per-address connects in the budget:** it depends on DNS answers we don't control, and that's how the current model went wrong.
- **Resolve once and connect to a single address:** a custom adapter that fights urllib3 and loses its failover.
- **`signal.alarm`:** main-thread only, and unsafe under gunicorn's own signals.

### 2. Budgets per endpoint, each pinned
| Caller | Deadline | Calls in the request | Pin |
|---|---|---|---|
| Proxy (`_session.get`, retries inside) | `PROXY_DEADLINE_SECONDS = 20` | 1 | ≤ timeout − 5 (the existing proxy pin, now on the deadline) |
| Request token, create session | `TMDB_CALL_DEADLINE = 10` | 1 each (the revoke moves out, Decision 3) | ≤ timeout − 10 |
| Rating POST/PATCH/DELETE sync | `TMDB_CALL_DEADLINE` | 1 | ≤ timeout − 10 |
| Stats genre lookup | `GENRE_LOOKUP_DEADLINE = 8` | 2 (cold cache) | 2 × 8 ≤ timeout − 10 |

The pins read gunicorn's `--timeout` from `docker-entrypoint.sh`, as `test_tmdb_proxy` and `test_stats_genres` already do. The proxy's `_worst_case_seconds` model and its comment go; the deadline makes it unnecessary. `RETRY`/`CONNECT_TIMEOUT`/`READ_TIMEOUT` stay for the reset case they were tuned for.

### 3. Revokes run after the local change, in the background
A small `revoke_in_background(user_id, session_id)` in `tmdb_client` schedules `revoke_tmdb_session` on `transaction.on_commit` via a daemon thread (no DB access; it logs by exception type only, as today):
- **Reconnect** (`tmdb_create_session`): save the new `session_id` first, then schedule the old one's revoke. If the save raises, nothing is revoked and the old session stays stored (spec scenario).
- **Disconnect:** clear and save, then schedule the revoke.
- **Delete account:** read the session id, `user.delete()`, then schedule the revoke.

Order doesn't matter between revokes, so the background is safe here. None of these responses waits on TMDB.

### 4. Rating sync stays in the request, after the save, bounded
`_sync_rating_to_tmdb` (and the delete path) run after the local write: today DELETE calls TMDB *before* `entry.delete()`, and that order is reversed. Each sync goes through `call_with_deadline(..., TMDB_CALL_DEADLINE)`. A deadline overrun is logged like any sync failure and the response is still the success. Ordering holds because each rating response comes only after its sync, and the frontend sends one write per title at a time (`createInflight` slot per title, item 33). A background sync would answer faster, but two server processes could deliver a rate and a delete to TMDB in either order. Making that safe needs a DB read of the latest state in the background thread, which the worker-thread rule forbids.

### 5. Timeout tuples in `tmdb_client`
`_get`/`_post`/`_delete` default to `TMDB_TIMEOUT = (3.05, 6)` instead of `10`. Background callers keep these per-attempt limits without a deadline, and request-path callers get both. `get_genre_names` keeps its `timeout` parameter (Stats passes `GENRE_LOOKUP_TIMEOUT`).

## Risks / Trade-offs

- [An abandoned worker thread keeps a connection busy after its deadline] → It's bounded by its own timeouts (about 4 × 3.05 + 6 s at worst), it uses a pool of 8, and it touches no DB or cache.
- [During an outage the pool is full and calls fail at the deadline instead of sooner] → They return the same 502 or failed-sync path as before, within budget. Recovery is automatic as the stuck threads finish.
- [A slow TMDB makes rating saves take up to 10 s] → Only when TMDB is slow, and only for users with a connected TMDB account. It's within budget, and the frontend shows the save as pending, not failed.
- [A revoke scheduled on commit is lost if the process dies right after] → It was already best-effort. The local side is correct either way, and an unrevoked TMDB session only means the user's TMDB account still lists it.
- [Tests with real timing are slow or flaky] → The deadline tests use a fake `fn` that blocks on an `Event` and tiny deadlines (0.2 s), never real network timeouts.

## Migration Plan

Backend only, no data or API change. Deploy and rollback are just the backend image.
