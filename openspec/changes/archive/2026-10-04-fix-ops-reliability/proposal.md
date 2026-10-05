## Why

The Docker deployment has three self-inflicted reliability problems found in the 2026-10-03 audit. The backend healthcheck goes through the default anonymous throttle (`300/day`) while compose polls it every 10s, so the container turns **unhealthy after ~50 minutes** and stays that way until the throttle window rolls over. The Docker entrypoint runs `compute_recommendations` with no timeout, so a hung TMDB call can stop gunicorn from ever starting (`start.py` already fixed this for local dev, the entrypoint didn't). And every deleted `WatchedEntry` row starts its own recommendation-recompute thread, so "clear watched history" on a 500-item library starts 500 concurrent TMDB-heavy threads.

## What Changes

- Exempt the health endpoint from all request throttling so orchestrator polling can never exhaust a rate limit.
- Bound the Docker entrypoint's best-effort recommendation warm-up with the same 30s cap `start.py` uses, so the server always starts.
- Coalesce background recommendation refreshes per user: at most one refresh runs at a time per user, and further triggers while one is running cause exactly one follow-up refresh instead of N threads.
- Defer the refresh trigger until the triggering DB transaction commits, so the refresh never reads pre-commit (or rolled-back) state.
- Skip refresh triggers caused by the user's own account deletion (cascade-deleting their watched rows).

## Capabilities

### New Capabilities
- `service-health`: Liveness endpoint behavior and service startup guarantees (health endpoint is never rate-limited; startup is never blocked by best-effort pre-warm work).
- `recommendation-refresh`: When and how often the per-user recommendation cache is recomputed in response to watch-history changes.

### Modified Capabilities
<!-- none -->

## Impact

- `backend/userdata/health_views.py`: throttle exemption.
- `backend/docker-entrypoint.sh`: bounded warm-up.
- `backend/userdata/signals.py`, `backend/userdata/recommendations.py` (`_start_refresh_if_needed`, `_refresh_cache`, `_computing_users`): shared coalescing path.
- `backend/userdata/tests/`: new tests for health throttling and refresh coalescing.
- No API shape changes, no migrations, no frontend changes.
