## Why

Backlog item 28, first half (28a). The fifth audit's backend pass found recommendation refreshes that can spend TMDB calls on the server's shared key without bound:

- **Every poll during a TMDB failure starts another full recompute.** A refused save leaves the row stale. The For You page polls both endpoints every 3 s for a minute, and each poll of a stale row triggers a new refresh of hundreds of TMDB calls. Other server processes start their own, and the page still ends in "taking longer than usual".
- **The media-cache fill has no per-run cap.** Every watched title missing from the cache, or cached more than 7 days ago, is fetched in one refresh. 50,000 imported ids means about 50,000 TMDB calls (and 429s for every user's browsing) plus a 50,000-term `WHERE`. A real 3,000-title library refetches everything in one burst each week.
- **The metadata backfill's per-run cap can be bypassed.** Clear the watched list, import 500 fake ids, and each `/stats/` call fetches 100 more. That is far more than one account should spend per day.
- **The startup warm-up recomputes fresh users, in arbitrary order, and stops at 30 s.** Every restart spends TMDB calls on the same leading users, and later users are never warmed.
- **(plausible)** Nothing limits refresh threads per process. Each holds a DB connection for minutes plus 10 HTTP workers, so a burst of stale users could exhaust Postgres connections.
- **(plausible)** If starting a refresh thread raises, the user reads "pending" for the life of the process.

The second half (28b: KMeans input, genre fallback across types, rechecking genre-less titles, rated-but-unwatched titles, `family_of`, save ordering) is a separate change.

## What Changes

- **Failure backoff.** When a refresh's result is refused because TMDB failed, that user's polls don't start another refresh for 10 minutes. A stale stored result is served as ready meanwhile; with no stored result the status stays pending. A data change (a watch, a rating) still triggers a refresh at once.
- **Capped cache fill.** One refresh fetches at most 200 titles' details: missing ones first, then the oldest cached. Titles not fetched this run use their existing (stale) row, and the cap doesn't count as a failure. Existing rows are read in chunks per media type, not with one huge OR'd query.
- **Per-user daily TMDB title budget.** Background title fetches for one user (metadata backfill and cache fill together) are limited to 1,000 per day, counted atomically in the database. An exhausted budget leaves titles for the next day, and it isn't a failure.
- **Warm-up order.** The startup warm-up skips users whose recommendations are still fresh, and warms the rest oldest first (no row first).
- **At most 4 refreshes compute at once per process.** Other refresh threads wait their turn before touching the database or TMDB.
- **A thread that fails to start releases the user's slot and status stamp.**

One migration: a `TmdbTitleBudget` table (user, day, used). No API shape change, no frontend change.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `recommendation-refresh`: refused refreshes back off instead of retrying on every poll; per-run fill cap; process-wide concurrency limit; a thread that fails to start leaves no stuck "pending".
- `title-metadata`: background title fetches share a per-user daily budget.
- `service-health`: the warm-up skips fresh users and goes oldest first.

## Impact

- Backend: `recommendations.py`, `metadata_backfill.py`, `management/commands/compute_recommendations.py`, `models.py` + migration `0027`, new `tmdb_budget.py`.
- Tests: `test_recommendation_refresh.py`, `test_metadata_backfill.py`, `test_startup_warmup.py` / a warm-up command test, a new budget test.
- Docs: CLAUDE.md (refresh triggers rule, budget for any background title fetch), `docs/ARCHITECTURE.md`, `features.txt` ("can't flood TMDB" becomes true), `docs/BUG_BACKLOG.md` (item 28 split into 28a/28b).
