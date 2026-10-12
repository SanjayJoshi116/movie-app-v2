## 1. Load-more failure stops the loop (frontend)

- [x] 1.1 `usePaginatedFetch`: add `loadMoreError` state; set it in `loadMore`'s catch when the generation matches, and stop showing the toast; clear it at the start of each page-1 load; make `loadMore` return early while it's set; add `retryLoadMore()` that clears it and loads the same next page. Return both from the hook. Fix the stale "the next scroll can try again" comment.
- [x] 1.2 Add `src/components/LoadMoreError.tsx`: one line of `colorTextSecondary` text from `getApiError(err, "Couldn't load more results.")` plus a Retry `Button` (`ReloadOutlined`). Theme tokens and `FONT_SIZE` only.
- [x] 1.3 Wire the six call sites (`HomePage`, `AnimePage`, `PeoplePage`, `SearchPage` Movies/TV/People tabs): add `!loadMoreError` to `useInfiniteScroll`'s `enabled`, and render `<LoadMoreError>` in place of the load-more skeleton when set. `SearchPage`'s `usePaginatedSearch` passes both new fields through.
- [x] 1.4 Jest (`usePaginatedFetch.test.tsx`): a failing next page sets `loadMoreError` and a second `loadMore()` sends no request; `retryLoadMore()` requests the same page and appends on success; a query change clears the error. Component test for `LoadMoreError`: text shown and Retry calls back.
- [x] 1.5 Jest or Playwright check that with the sentinel kept in view and the next page failing, exactly one request for that page is sent (no loop). Use the existing TS browse spec setup if a hook test can't observe it.

## 2. TMDB "not found" settles (backend)

- [x] 2.1 `tmdb_client.is_not_found(exc)`: true for an `HTTPError` with a 404 response. Switch `metadata_backfill.fetch_entry_metadata` to it.
- [x] 2.2 (Deviation: a 404 returns empty details `{"genre_ids": [], "top_cast": []}` instead of a sentinel, so the existing upsert path stores it unchanged.) `recommendations._fetch_media_details`: on 404 return a `NOT_FOUND` sentinel without `mark_failed`; `_store_media_cache` upserts empty `genre_ids`/`top_cast` for it. `_ensure_cached`/`_fill_media_cache` handle the sentinel the same way.
- [x] 2.3 `fetch_similar` and `fetch_actor_credits`: on 404 return no items without `mark_failed`; other errors unchanged.
- [x] 2.4 `social_views._fetch_followed_people_credits.fetch`: on 404 return `[]` (cached like a success) and log a WARNING without a traceback; other errors unchanged (not cached).
- [x] 2.5 Tests:
  - a 404 title stores an empty cache row and isn't fetched again within `CACHE_TTL_DAYS`, and the compute isn't marked failed
  - a 5xx title still stores nothing and marks failed
  - a 404 similar or actor fetch doesn't mark failed
  - with one 404 title and a smaller new result, `save_recommendations` stores it
  - a 404 followed person is cached as `[]`, and the next notifications poll doesn't fetch them
  - a 5xx person is still refetched

## 3. Backfill failures and the refresh stamp (backend)

- [x] 3.1 `metadata_backfill.backfill_entries` returns `False` if any fetch or store failed or any candidate was skipped for backoff, else `True` (the `MAX_PER_RUN` cap doesn't count). `_compute_personalized` calls `health.mark_failed()` on `False`.
- [x] 3.2 `recommendations`: `_own_stamp` dict under `_computing_lock`. `request_refresh` records the stamp it writes; the follow-up rerun restamps and records; `_finish_refresh` clears only `refreshing_since == own stamp` and pops it. Remove the `only_before` path if nothing else uses it.
- [x] 3.3 Tests:
  - a backfill transient failure, or an entry in backoff, marks the compute failed, and a smaller result isn't saved
  - the `MAX_PER_RUN` cap alone doesn't mark it failed
  - a refresh finishing after another process restamped leaves that stamp, so the endpoints still say `pending`
  - a lone refresh still clears its own stamp
  - the rerun path restamps

## 4. Time budgets (backend)

- [x] 4.1 `social_views.followed_people_recommendations` passes `budget_seconds=FOLLOWED_RECS_BUDGET_SECONDS` (15). Test: slow TMDB returns within budget with the people that arrived; budget ≤ gunicorn `--timeout` − 10 (parse `docker-entrypoint.sh` like `test_notifications`).
- [x] 4.2 `tmdb_client.get_genre_names(media_type, timeout=None, *, fallback=True)`: `_get` takes an optional timeout; with `fallback=False` a failure raises.
- [x] 4.3 `stats_views`: call it with `GENRE_LOOKUP_TIMEOUT = (3.05, 5)` and `fallback=False`; on failure use `STATIC_GENRE_NAMES` and keep it for `_GENRE_FALLBACK_TTL` (300 s) instead of 24 h.
- [x] 4.4 Tests:
  - stats with a timing-out TMDB responds with static genre names
  - a request after the fallback TTL retries TMDB, and one inside it doesn't
  - 2 × (connect + read) ≤ `--timeout` − 10

## 5. Docs

- [x] 5.1 CLAUDE.md:
  - "Upstream failures and worker threads": a TMDB 404 is a settled answer (`is_not_found`), never `mark_failed`, and its empty result may be cached
  - "Bare except": mention the 404 split
  - "List-page filter bars" or "Load and write feedback": failed load-more shows `LoadMoreError` and stops auto-loading
  - add the followed-people and stats budgets to the time-budget notes
- [x] 5.2 `docs/ARCHITECTURE.md`: rationale bullets for the load-more guard in the hook, 404 = settled, own-stamp clear, backfill completeness, and the stats short timeout over a parallel deadline.
- [x] 5.3 `docs/BUG_BACKLOG.md`: item 17 → 📝 with a link to this change (✅ on archive).

## 6. Verification

- [x] 6.1 `npm run typecheck`, `npm run lint`, Jest.
- [x] 6.2 Backend pytest (one process at a time), `ruff check backend/`, `DEBUG=True manage.py makemigrations --check --dry-run`.
- [x] 6.3 TS Playwright (`--workers=1`) and Python e2e for browse/search/people, file by file.
- [x] 6.4 Live check under `npm start` with a throwaway `verify_*.py` (deleted after):
  - block the next-page TMDB route on /movies with the sentinel in view: exactly one request, then the Retry message; unblock and Retry appends
  - same on Search
  - no console errors, light and dark
