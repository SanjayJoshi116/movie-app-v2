## Why

Several backend endpoints return numbers or orderings that are quietly wrong, with no error anywhere. Examples:
- A user who follows 30 people only gets new-release notifications for the 10 most recently followed.
- A user with fewer than 3 watched titles always sees an empty "Top Genres" chart.
- One failed TMDB request can wipe a title's cached genres and cast for 7 days.
- Changing a rating doesn't reach a connected TMDB account.

This is item 6 of `docs/BUG_BACKLOG.md`. It's next in order now that `fix-browse-filters` (#4) is archived. Item 5 is still waiting on its UTC-vs-local design decision.

## What Changes

One rule across the backend: **stored and returned data matches the user's actual data and TMDB's. A failed upstream call never replaces good data, and it never gets cached as a real answer.**

### Notifications
- New-release notifications cover **every** followed person, not just the 10 most recent.
- Each person's TMDB credits are cached for a few hours, so polling stays cheap as the follow list grows. A failed fetch is never cached.

### Title metadata (genres, language, release year)
- **The TMDB cache never overwrites good data with a failure.** On a failed fetch, the existing cached row is kept and reused as-is (even if stale). If there is no row, nothing is stored and the next run tries again.
- **Watched titles get their genres, language and release year filled in regardless of how many titles the user has watched.** Today genres are only filled as a side effect of personalized recommendations, which skip users with fewer than 3 watched titles. Stats' "Top Genres" and "Rating by Genre" depend on them.
- **Backfill is bounded and runs once at a time per user.**
  - One background backfill per user at a time, with a small worker pool. Today each `/stats` request starts its own 20-worker pool.
  - A title TMDB doesn't know (404) is marked with the existing "unknown" values, so it isn't retried.
  - A title whose fetch failed for another reason waits before it's retried, instead of being retried on every `/stats` request.
- **Marking a title watched stores its original language and release year** when the client sends them. The endpoint accepted these fields but silently dropped them. The mark-as-watched dialog already fetches the title's details, so it now sends them too.

### Ratings
- Editing a rating (PATCH) syncs the new value to a connected TMDB account, as creating one already does.
- Re-rating a title (POST over an existing rating, or PATCH with a new score or review) updates `rated_at` to now. Today a re-rated title keeps its original date.

### Recommendations
- Section keys are unique within a response:
  - "Because you watched" keys include the media type.
  - Actor and followed-person sections are keyed by TMDB person id, not name.
  - Personalized clusters that come out with the same genre label are merged into one section.

### Lists and TMDB proxy
- List items come back in a fixed order (newest added first, ties broken by id), not whatever order the database happens to use.
- The TMDB proxy keeps repeated query parameters (`?a=1&a=2`) instead of collapsing them to the last value. It also always uses the server's API key: a client-supplied `api_key` is dropped.

## Capabilities

### New Capabilities
- `title-metadata`: how per-title TMDB metadata (genres, cast, language, release year) is fetched, cached, backfilled and kept on failure.
- `ratings`: rating writes and their effects (TMDB sync on create, edit and delete; `rated_at` semantics).
- `recommendation-sections`: the shape of recommendation responses, including that section keys are unique and labels aren't duplicated.
- `user-lists`: list item ordering in list responses.

### Modified Capabilities
- `notifications`: adds two requirements. Notifications cover all followed people, and per-person credits are cached without caching failures.
- `api-hardening`: adds a requirement that the TMDB proxy forwards repeated query parameters intact and never forwards a client-supplied `api_key`.

## Impact

- **Backend:**
  - `backend/userdata/notifications_views.py`
  - `social_views.py`: `_fetch_followed_people_credits` (limit and cache)
  - `recommendations.py`: `_ensure_cached`, `_fill_genre`, section keys
  - `stats_views.py`: backfill
  - `watched_views.py`
  - `ratings_views.py`
  - `lists_views.py`
  - `tmdb_proxy_views.py`
  - a new `metadata_backfill.py` module
- **Frontend:** `src/components/MarkWatchedModal.tsx` and `useWatched.addRaw` send `originalLanguage`/`releaseYear`, plus matching additions to the `WatchedEntry` type. The UI doesn't change.
- **Data:** no migration. "Unknown" stays as the existing sentinels (`original_language="??"`, `release_year=-1`). Retry backoff is kept in process memory, like recommendation-refresh coalescing.
- **Cache:** per-person credits use Django's configured cache (DB cache in production, LocMem under DEBUG).
- **Tests:** new or extended tests in `backend/userdata/tests/` (notifications, ratings, watched, proxy, plus new metadata and recommendation-key tests).
