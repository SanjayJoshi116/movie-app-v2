## Why

Backlog item 41. Every test in the project (Jest, both Playwright suites, backend pytest) mocks TMDB, so the app's TMDB use is checked only against fake answers. The sixth audit found three bugs that pass the whole suite and show up only against live data (item 35: the Calendar shows only today's movies, the rating sort returns 1-vote titles, "newest" starts in 2099). Nothing would tell us either if TMDB renamed or dropped a field or an `append_to_response` part the app reads.

## What Changes

- A new **opt-in live TMDB check** in the existing backend pytest suite. It runs only when an explicit flag and a real TMDB API key are both set; otherwise every test in it is skipped. Plain `pytest`, CI on push and the Docker image never touch the network.
- It checks **shape only**, for every feature that reads TMDB: each field and appended part the app relies on still exists with the type the app expects. That covers the browse grids (Movies, TV, Anime), Search, Calendar, the hero banner, movie and TV detail pages, the episode guide, Mark as Watched, the person page, and the backend's own TMDB use (recommendations, notifications and follows, Stats genre names, metadata backfill).
- Backend paths are checked through the real backend functions; frontend paths go through the app's own TMDB proxy with the frontend's real parameters, and the check fails when those parameters drift from the frontend source.
- Docs say how to run it and that any new TMDB-reading feature adds a check here. Later fix items (35, 36) add their own query-sanity checks to the same file.
- No app behavior changes. No CI job is added (a scheduled job with a repo secret stays optional, later).

## Capabilities

### New Capabilities
- `tmdb-live-checks`: an opt-in check of the app's TMDB dependencies against the live API: when it runs, what it covers, how failures read, and how it stays in step with the code.

### Modified Capabilities
(none)

## Impact

- New: `backend/userdata/tests/test_tmdb_live.py` (tests are already excluded from the backend image).
- `backend/pytest.ini`: register a marker for the live tests.
- Docs: `README.md` (Testing), `CLAUDE.md` (Verification), `docs/BUG_BACKLOG.md` (item 41 status).
- Network: only when opted in, roughly 30 TMDB calls per run through the server key, well under TMDB's rate limits and the proxy's `120/min` throttle.
- No new dependencies, no migrations, no settings or env vars read by the app.
