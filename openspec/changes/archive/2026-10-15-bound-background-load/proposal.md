## Why

Backlog item 38 (sixth audit). Three ways the backend's capacity is unbounded or too small under load:

- **Background metadata backfills have no overall cap.** `metadata_backfill.request_backfill` is single-flight per user only. Each `/stats/` visit by a user with unfilled titles starts a thread with a 5-worker TMDB pool and its own database connection, so many users at once means unbounded threads and connections (Postgres allows 100 by default). Recommendation refreshes already cap at 4 per process; this path doesn't.
- **Three sync gunicorn workers each wait on TMDB.** The TMDB proxy (up to 20 s), notifications and followed-people recommendations (15 s budgets) hold a whole worker while they wait. During a TMDB slowdown, three such waits make the entire API unavailable, sign-in and library loads included. Item 22 accepted the public proxy; this outage case wasn't considered.
- **Session token records grow without bound.** Every sign-in and hourly refresh adds `OutstandingToken` / `BlacklistedToken` rows, and nothing runs simplejwt's `flushexpiredtokens`. Known and documented in `docs/ARCHITECTURE.md`, never scheduled.

## What Changes

- At most a fixed number of metadata backfills run at once per server process; the rest wait their turn without holding a database connection.
- The backend runs threaded workers (gunicorn `gthread`, 3 workers × 8 threads), so requests waiting on TMDB no longer block every other request. The shared TMDB connection pools grow to match.
- Expired session-token records are removed at every backend start (Docker and `npm run dev`), best-effort and time-bounded so it can never block startup.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `title-metadata`: metadata backfills are capped per process, not only single-flight per user.
- `service-health`: the API keeps answering other requests while some wait on a slow TMDB; expired session records are cleaned up at startup without blocking it.

## Impact

- `backend/docker-entrypoint.sh` (gunicorn worker class/threads, `flushexpiredtokens` step), `backend/start.py` (same flush step), `backend/userdata/metadata_backfill.py` (semaphore), `backend/userdata/tmdb_client.py` (deadline pool size), `backend/userdata/tmdb_proxy_views.py` (session pool size).
- Database connections: up to 3 × 8 request threads, each keeping its connection `CONN_MAX_AGE` (60 s), plus capped background threads; well under Postgres's default 100.
- Docker can't be run on the dev machine: the entrypoint is checked statically by tests and for real only by CI's image build. gunicorn doesn't run on Windows, so the threaded server is verified statically here and for real only in a Docker deploy.
- Tests: backfill cap, entrypoint/start.py flush step and worker settings (static), pool sizes. Docs: CLAUDE.md, ARCHITECTURE.md, README, BUG_BACKLOG.
