## Why

When TMDB is slow, down, or no longer has a title or person, the app reacts badly in a few places (`docs/BUG_BACKLOG.md` item 17):

- A failed "next page" request on a browse grid retries in a tight loop.
- One deleted TMDB title or person freezes a user's recommendations for good.
- Two endpoints can outlive the server's request timeout.

Each has a confirmed code path. They hit hardest when TMDB is struggling, which is exactly when extra load does the most harm.

## What Changes

- **Load-more failures stop the auto-loading.** A failed next-page request on Movies, TV, Anime, People or Search shows an inline "Couldn't load more" message with a Retry button. Scrolling doesn't request again until the user retries. Today the IntersectionObserver re-fires as soon as the request settles, so the page re-requests continuously while each try holds a server worker.
- **"Not found" from TMDB is an answer, not an outage.** Recommendation compute (title details, similar titles, person credits) and the notifications poll currently treat TMDB's 404 like a network failure:
  - The refresh is marked failed, so `save_recommendations` can keep an old result forever. Every For You visit then starts another full recompute.
  - The title is refetched on every run.
  - A followed person who always 404s is refetched on every poll and can starve the people after them.

  A 404 now settles the lookup:
  - Title details store an empty genres/cast entry for the cache's freshness window, as the metadata backfill already does.
  - Similar titles and person credits contribute no items, without counting as a failure.
  - A person's credits are cached as "no credits".
- **Metadata backfill failures count as upstream failures.** If genre backfill inside a personalized compute hits a transient TMDB failure, or skips titles still in backoff, the compute is marked failed. A result clustered on genre-less titles then can't replace a good stored one for 12 h.
- **Overlapping refreshes keep their status.** A finishing refresh clears only the "refreshing" stamp it set itself, not a newer one another server process set while it ran. Today the next poll can wrongly report "ready" with the older result.
- **Two more endpoints get a time budget.**
  - Followed-people recommendations (up to 10 cold credit fetches, about 40 s worst case today) gets the same deadline mechanism notifications already have.
  - The Stats endpoint's cold genre-name lookup (two sequential TMDB calls, about 40 s worst case) gets a short per-call timeout. A failed lookup's static fallback is no longer cached for 24 hours.
  - Tests pin both budgets under gunicorn's `--timeout`.

Out of scope: the `session_id` log leak and the rating-sync traceback, both moved to item 22 and already fixed.

## Capabilities

### New Capabilities
- `endpoint-time-budgets`: every API endpoint that waits on TMDB during the request responds within a fixed budget under the server's request timeout. This change covers followed-people recommendations and stats; the TMDB proxy and notifications already have their own budget requirements.

### Modified Capabilities
- `load-states`: paginated grids add a requirement that a failed next-page load stops auto-loading and offers Retry.
- `recommendation-refresh`: "An upstream outage keeps the previous recommendations" now says a TMDB "not found" is not a failure, while a metadata-backfill failure is. "Refresh status is the same on every server process" gains a scenario for overlapping refreshes.
- `title-metadata`: "A failed TMDB fetch never replaces cached metadata" separates a failure from a "not found", which is stored as settled empty metadata.
- `notifications`: "Per-person credit lookups are cached without caching failures" says a person TMDB reports as not found is cached as having no credits.

## Impact

- **Frontend:** `src/hooks/usePaginatedFetch.ts` (load-more error state, retry), `src/hooks/useInfiniteScroll.ts` (callers pass the error into `enabled`), a small shared load-more error component, `HomePage.tsx`, `AnimePage.tsx`, `PeoplePage.tsx`, `SearchPage.tsx` (3 tabs).
- **Backend:**
  - `backend/userdata/tmdb_client.py`: a not-found helper and a per-call timeout for genre names
  - `recommendations.py`: 404 handling at 3 sites, backfill health, the own-stamp clear
  - `metadata_backfill.py`: `backfill_entries` reports whether it was complete
  - `social_views.py`: 404 handling for person credits, and a budget for followed-people recommendations
  - `stats_views.py`: genre lookup bounded, fallback cached briefly
- **Tests:** backend tests for each change, including budget-vs-`--timeout` pins; Jest for `usePaginatedFetch` load-more failure; e2e only where a browse mock needs the new Retry UI.
- **Docs:** CLAUDE.md "Upstream failures" bullet (404 = settled), `docs/ARCHITECTURE.md` rationale, `docs/BUG_BACKLOG.md` item 17 status.
- No API shape changes and no migrations.
