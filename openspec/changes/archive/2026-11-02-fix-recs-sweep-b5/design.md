## Context

See proposal.md for the findings. The relevant current state:

- `_compute_for_you` builds six kinds of section in order. Each passes its candidates through `filter_new`, which adds every scanned item to a shared `seen` set, then cuts the result to 12. The personalized cluster loop adds every discover candidate to its `seen` before scoring, then keeps the top 12.
- `metadata_backfill.backfill_entries` returns False when any needing title is in the in-process backoff (`_failed_at`, 1 hour), and `_compute_personalized` turns that into `health.mark_failed()`. `save_recommendations` keeps the stored row when health failed and the new result has fewer non-empty sections.
- `_recommendations_response` answers `"pending"` for "no row" whatever the reason. The page polls 20 times (about a minute), then shows "taking longer than usual".
- Stats caches genre names per process (`stats_views._get_cached_genre_names`, deadline-bounded, 24 h, 5-minute fallback TTL). Recommendations call `tmdb_client.get_genre_names` four times per compute, uncached.

## Goals / Non-Goals

**Goals:**
- Fix the ten verified findings of backlog item 60 (except the deferred double fetch), with a regression test for each.

**Non-Goals:**
- Merging `_fill_media_cache` and the metadata backfill into one TMDB call per title, or unifying the two genre stores. This is a bigger restructuring of both stores, and it gets its own backlog entry.
- Changing the outage rule in `save_recommendations` itself.
- Cleaning legacy pre-1900 rows in the database.

## Decisions

**1. Reserve titles at the cut, not at the scan.** `filter_new(items, limit=12)` walks the candidates, skips watched, rated and already-shown titles, and keeps a local set for duplicates within the section. It stops at `limit` and adds only the kept titles to `seen`. Every call site drops its own `[:12]`. The cluster loop does the same: it dedupes candidates within the cluster locally, and adds only the 12 it keeps to `seen`.
- Alternative: drop the shared `seen` and only dedupe within each section. Rejected, because the same title would then fill several rows.

**2. One shape guard for TMDB result lists.** A helper `tmdb_client.result_list(data, key)` returns `data[key]` when it is a list, keeping only dict entries with an integer `id`; otherwise it returns `[]`.
- It is used by `discover` (replacing `or []`), and by For You's trending, similar/recommendations, gems and actor credits.
- The backfill's genres use the same rule: `data.get("genres") or []`, with dict entries only and an integer `id`.
- `original_language` is kept only when it is a string.
- Alternative: widen each section's `except` to `TypeError`/`AttributeError`. Rejected, because it would empty a section that has usable entries and hide real bugs.

**3. Backoff skips don't fail the compute.** `backfill_entries` returns False only when a fetch or store failed in this run. Titles skipped while in backoff stay out of the clusters, which already use only titles that have genres.
- A title that keeps failing still marks failed whenever its backoff expires and it is fetched again. That is a real failure seen in that run, and the 1-hour backoff limits it to one refresh per hour.
- Alternative: count a backoff skip as failed only when it is a large share of the history. Rejected as a heuristic with no clear threshold.

**4. `"unavailable"` status.**
- `_recommendations_response` with no row answers `"unavailable"` when the backoff is set, or when `_start_refresh_if_needed` didn't leave the user in `_computing_users` (the thread couldn't start). Otherwise it answers `"pending"`.
- A stored row keeps the existing `"ready"`/`"pending"` answers.
- On the page, `pollRecommendation` treats `"unavailable"` as `fail(group)`. The existing paths then show the warning Alert (other groups have items) or `LoadError` with Retry (nothing shown).
- An HTTP error code was rejected: the request itself succeeded, and a 5xx would land in error monitoring.
- `"failed"` was rejected as a name: the page's own "failed" means a request error.

**5. `request_backfill` thread start.** It wraps `Thread.start()` in `except RuntimeError`, logs it, and discards the user from `_running`. This mirrors `_spawn_refresh`.

**6. Blank seed title.** The label uses `title.strip() or f"Untitled (#{media_id})"`, matching `src/utils/mediaLabel.ts`. The rule lives in a small backend helper, `media_label(title, media_id)`, in `recommendations.py`.

**7. Monthly range floor.**
- `monthly_counts` skips local dates before year 1900. The floor reuses the year of `serializers.EARLIEST_TIMESTAMP`, so the bound has one source.
- Other counts are untouched.
- The alternative was capping the range at N months. Rejected, because it would cut real long histories.

**8. Genre registry lock.**
- `family_of` keeps its lock-free fast path (`FAMILY_OF.get`) for known ids, and registers an unknown id under a module `threading.Lock`.
- An unknown id is not added to `FAMILY_OF`. The fast path would then return early when the same id later shows up on the other media type, and that type would never be registered. Unknown ids are rare, so taking the lock on each sighting costs nothing that matters.
- `with_genres` reads the registry with no lock: the lists only ever grow, and the GIL makes `append` atomic.

**9. Shared cached genre names.**
- `_get_cached_genre_names` and its TTL state move to `tmdb_client.cached_genre_names()`, still deadline-bounded with the same TTLs, under a lock so concurrent misses don't double-fetch.
- `stats_views` calls it.
- `_compute_for_you` and `_compute_personalized` call it once each, which drops the dead `except TypeError`. The constants Stats' tests pin (`GENRE_LOOKUP_TIMEOUT`, `GENRE_LOOKUP_DEADLINE`) move with it, and `stats_views` re-exports them or the tests follow.

**10. Logs.** `recommendations.py:166` and `metadata_backfill.py:93` log `type(e).__name__` instead of `e`.

## Risks / Trade-offs

- [More titles per response, so the For You payload grows slightly] → Each section is still capped at 12, and only sections that used to be dropped come back.
- [Older clients don't know `"unavailable"`] → The page treats any status other than `"pending"` as final. An old bundle would show the existing empty state, not hang, and deployed clients update with `index.html` `no-cache`.
- [Moving the genre cache changes test patch targets] → Update the tests that patch `stats_views._get_cached_genre_names` or its module globals in the same task. `conftest` clears the cache between tests if it is module state.
- [A title that keeps failing still marks a refresh failed once per hour] → Accepted (see decision 3). It reflects a real failure.

## Migration Plan

None. No schema change, and the response status is additive. Rollback is reverting the commit.
