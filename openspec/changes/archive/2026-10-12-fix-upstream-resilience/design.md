## Context

See proposal.md (Why) and `docs/BUG_BACKLOG.md` item 17. Current state that shapes the approach:

- **Load more.**
  - `usePaginatedFetch.loadMore` is a `useCallback` over `loadingMore`, `currentPage`, `hasMore` and `loading`. Its identity changes when `loadingMore` flips back in `finally`.
  - `useInfiniteScroll` depends on `onLoadMore`, so it disconnects and re-`observe()`s the sentinel. IntersectionObserver always reports the current intersection on `observe()`.
  - After a failure nothing was appended, so the sentinel is still in view and `loadMore` runs again at once. The only feedback is a deduped toast.
  - Six call sites: Home, Anime, People, and Search's Movies/TV/People tabs.
- **404s.** TMDB's 404 reaches callers as `requests.HTTPError` (`_get` calls `raise_for_status`). `metadata_backfill.fetch_entry_metadata` already treats it as settled. The recommendation sites (`_fetch_media_details`, `fetch_similar`, `fetch_actor_credits`) and `social_views._fetch_followed_people_credits.fetch` catch it with every other `RequestException`.
- **Stamp.**
  - `request_refresh` stamps `UserRecommendationCache.refreshing_since = now()`.
  - `_finish_refresh` clears every stamp `<= finished_at`, which includes one another process set mid-run.
  - The follow-up run (`_rerun_users`) reuses the slot without restamping.
- **Backfill.** `backfill_entries` returns nothing. Transient failures only put entries in the module-level backoff map.
- **Budgets.**
  - `_fetch_followed_people_credits` already supports `budget_seconds` (notifications passes 15), but `followed_people_recommendations` doesn't pass it.
  - `stats_views._get_cached_genre_names` calls `tmdb_client.get_genre_names` twice. That goes through `_get` with `timeout=10` (10 s connect and 10 s read), and the static fallback is then cached for 24 h.
  - gunicorn `--timeout 30` is set in `backend/docker-entrypoint.sh`. `test_notifications` already parses it.

## Goals / Non-Goals

**Goals:**
- No request loop on any load-more failure, with one consistent Retry affordance.
- One rule for TMDB 404 across backend TMDB consumers: a settled answer, never `mark_failed`.
- Every request path that waits on TMDB has a budget pinned by a test against `--timeout`.

**Non-Goals:**
- Backoff or automatic retry of load-more. Retry stays user-driven.
- Changing the For You polling cadence or `save_recommendations`' comparison rule.
- A TMDB-wide circuit breaker.
- Retrying 5xx inside these call sites. The proxy session already has its own retry; `tmdb_client` keeps none.

## Decisions

**1. The load-more error lives in `usePaginatedFetch`, not in the pages.**
- The hook gains `loadMoreError` (unknown or null), set in `loadMore`'s catch when the generation still matches. It's cleared at the start of each page-1 load and at the start of every `loadMore`.
- `loadMore` returns early while `loadMoreError` is set, unless called through a new `retryLoadMore()`. That clears the error and calls the inner load.
- Callers pass `enabled = hasMore && !loading && !loadingMore && !loadMoreError` to `useInfiniteScroll`.
- The early return in the hook is the real guard, so a page that forgets the `enabled` term still can't loop.
- The toast is dropped in favour of an inline `LoadMoreError` component (`src/components/LoadMoreError.tsx`): one line of secondary text plus a Retry `Button`, rendered where the load-more skeleton goes. `getApiError` supplies the text, per the convention.
- Alternatives considered:
  - Exponential backoff. It hides the failure and still spends quota while TMDB is down.
  - Fixing only `useInfiniteScroll`'s re-observe. A successful load still needs that re-observe to chain pages while the sentinel stays visible, so the guard has to be error-specific.

**2. A not-found helper in `tmdb_client`.**
- `is_not_found(exc)` returns true for an `HTTPError` whose response status is 404. `metadata_backfill` switches to it too, so all sites use one definition.
- At each site:
  - **`_fetch_media_details`** returns a module sentinel `NOT_FOUND`. `_store_media_cache` then upserts `genre_ids=[]`, `top_cast=[]`, so the title isn't requested again until `CACHE_TTL_DAYS`, like the backfill's `metadata_settled`.
    - This stays consistent with the "never write a placeholder on failure" rule: a 404 is TMDB's answer, not a failure.
    - It won't replace good data with empties on a transient error, because only a 404 gets here.
  - **`fetch_similar` / `fetch_actor_credits`** return an empty list without `mark_failed` on 404. Logging drops to INFO.
  - **Followed-people credit `fetch`** returns `[]` on 404, which is then cached for `PERSON_CREDITS_TTL` like any success. It logs a WARNING without a traceback.
- 401/429/5xx and network errors are unchanged: still failures.

**3. Each refresh clears only its own stamp.**
- `request_refresh` remembers the stamp it wrote in a module dict `_own_stamp[user_id]` (under `_computing_lock`).
- A follow-up run restamps with a new `now()` and replaces the entry, so a long chain of reruns can't age past the "killed mid-run" bound.
- `_finish_refresh` clears with `filter(refreshing_since=own_stamp)` (exact match) and pops the entry.
- If another process overwrote the stamp, the exact match misses and that process's stamp survives.
- Accepted residue: if the *other* process finishes first, its exact match also misses (our stamp wasn't its stamp). This process's stamp then remains until it finishes. Either way, no "ready" while a run is still going.
- Alternative considered: compare against the stamp's age. Clocks between workers are the same host's clock, but the race is about ordering, not age, so an exact match is simpler and correct.

**4. `backfill_entries` reports completeness.**
- It returns `False` when any fetched entry failed transiently or failed to store, or when any entry that needs metadata was skipped for backoff. Otherwise it returns `True`.
- Entries skipped only because of `MAX_PER_RUN` don't count. They aren't a failure, and the next run continues.
- `_compute_personalized` calls `health.mark_failed()` on `False`. `_run_backfill` ignores the value.

**5. Budgets.**
- `followed_people_recommendations` passes `budget_seconds=FOLLOWED_RECS_BUDGET_SECONDS` (15), reusing the deadline path notifications already has. A test pins it at no more than gunicorn `--timeout` − 10, like `test_notifications`.
- `tmdb_client.get_genre_names` takes an optional `timeout` and a keyword `fallback=True`. Stats passes `GENRE_LOOKUP_TIMEOUT = (3.05, 5)` and `fallback=False`, so both sequential calls are at most about 16 s, and a failure raises instead of quietly returning the static map.
  - Stats catches that failure, uses `STATIC_GENRE_NAMES`, and keeps them for `_GENRE_FALLBACK_TTL = 300` s instead of 24 h. Recommendations keeps the default behaviour.
  - A test pins 2 × (connect + read) at no more than `--timeout` − 10.
- Alternative considered: the two genre calls in parallel with a deadline. It's more machinery for a lookup cached for 24 h, and a shorter timeout already bounds it.

## Risks / Trade-offs

- **[A wrongly-404ing TMDB, e.g. a CDN glitch]** → would settle titles as empty for up to the cache window. That's the same exposure the metadata backfill has accepted since item 22. The entries refresh at TTL.
- **[An empty `TMDBMediaCache` row for a 404 title]** → that title contributes nothing to clustering or actor seeds, which is correct for a title TMDB no longer has.
- **[Users now see a Retry instead of an endless spinner/toast]** → intended. The e2e browse specs don't exercise load-more failure today, so no mock changes are expected. A new Jest test covers it.
- **[`_own_stamp` is per-process memory]** → a process restart loses it. The running refresh dies with the process anyway, and the stale-stamp bound covers it.

## Migration Plan

No schema or API change. Deploy as usual. Rollback is a revert. Settled empty `TMDBMediaCache` rows written for 404s simply age out.
