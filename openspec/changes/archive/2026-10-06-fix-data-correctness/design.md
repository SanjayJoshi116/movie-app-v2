## Context

See proposal.md for the bug list. The parts of the current code that shape the approach:

- **Followed-people credits:** `_fetch_followed_people_credits(user, limit=10)` (`social_views.py`) fetches every followed person's `combined_credits` from TMDB on each call, with 5 workers. Both notifications (polled every 3 min per open tab, throttled at 30/min) and followed-people recommendations call it. There's no caching.
- **Two separate metadata paths for watched titles:**
  - `TMDBMediaCache` (genres + top cast per title, 7-day freshness) is read and written by `_ensure_cached` in `recommendations.py`.
  - `WatchedEntry.genre_ids`, `original_language` and `release_year` are per-entry columns. `_compute_personalized` fills `genre_ids` (via `_fill_genre`), but only for users with ≥3 watched titles. `/stats` fills language and year with a fire-and-forget thread per request: 20 workers, no dedupe, and on failure nothing is saved, so the row is retried on every `/stats`.
- **Existing "unknown" sentinels:** `original_language="??"`, `release_year=-1`. Stats already ignores both.
- **Recommendation-refresh coalescing:** this already uses in-process per-user state (`_computing_users`). The same model is acceptable here: single process per container, and losing it on restart only means one extra attempt.
- **Cache:** Django's cache is DB-backed in production (`MAX_ENTRIES` 50k, shared with throttle counters) and LocMem under DEBUG/pytest.

## Goals / Non-Goals

**Goals:**
- One backfill path for per-entry watched metadata (genres, language, year), shared by stats and personalized recommendations.
- No migration.

**Non-Goals:**
- Changing notification semantics beyond coverage. The same-day `>` comparison is backlog #5 (`user-local-dates`).
- Persisting backoff state across restarts.
- Merging `TMDBMediaCache` and the per-entry columns into one store. They overlap (genres), but merging them is a refactor with a migration and no user-visible gain.
- Throttling or capping follows. Coverage of all followed people is bounded by the cache (D1) instead.

## Decisions

### D1. Cache trimmed per-person credits; never cache failures
`_fetch_followed_people_credits` gets `limit=None` as the default. Notifications pass nothing, so they cover everyone. Followed-people recommendations keep `limit=10`, because their UI is one section per person.

Each person's credits are read from and written to `django.core.cache` under `tmdb:person_credits:<person_id>`, with a 6h TTL. Only the fields the two callers read are stored: `id`, `media_type`, `title`, `name`, `poster_path`, `release_date`, `first_air_date`, `vote_average`. This keeps DB-cache rows small. A fetch failure returns `[]` for that call (as today) and writes nothing.

All cache reads and writes (`get_many`/`set_many`) happen on the request thread. Only the TMDB fetches run in the 5-worker pool. The production cache is DB-backed, so a cache call inside a worker would open a DB connection on that thread and never close it.

The cache key is per person, not per user, so users who follow the same person share the entry.

*Alternative:* a `PersonCreditsCache` model like `TMDBMediaCache`. Rejected: it needs a migration, and the existing cache with a TTL is exactly the right semantics.

### D2. `_ensure_cached` keeps the existing row on failure
On a fetch exception:
- if a cached row exists (even a stale one), return it unchanged, without touching `cached_at`
- otherwise, return `None` without writing anything

The caller already filters out falsy rows (`cache_by_key = {... for row in cache_rows if row}`), so a missing title just contributes nothing to that run, which is what an empty row did before, minus the 7-day poisoning.

### D3. One metadata backfill module, single-flight per user
Add `backend/userdata/metadata_backfill.py`:

- **`entry_needs_metadata(entry)`**: true when `genre_ids` is empty, `original_language is None`, or `release_year is None`. The `??`/`-1` sentinels count as filled.
- **`fetch_entry_metadata(entry)`**: one TMDB `/{type}/{id}` call. It returns `{genre_ids, original_language, release_year}` and writes them with a single `.update()`.
  - **404:** raises a dedicated `NotFound`. The caller stores `genre_ids=[]` plus the `??`/`-1` sentinels, and records the pk as permanently skipped (see below).
  - **Other failures:** the pk goes into `_failed_at[pk] = now` and is skipped until `BACKOFF` (1h) has passed.
- **`request_backfill(user_id)`**: the coalescing pattern from `recommendations.request_refresh`, using a module lock plus a `_running` set. If a backfill is already running for the user, it's a no-op. Otherwise it starts one daemon thread that:
  - loads that user's entries needing metadata, excluding ones in backoff
  - runs them through a `ThreadPoolExecutor(max_workers=5)`
  - always discards the user from `_running` in a `finally`

How the three metadata paths change:
- **Fetch vs write threads:** `fetch_entry_metadata` only talks to TMDB and returns `(fields, settled)` or `None`. `backfill_entries` writes the results on the calling thread, so pool workers never open (and leak) DB connections. They also don't need to see uncommitted test-transaction rows. `request_backfill`'s thread closes its own connection in `finally`.
- **Settled titles:** an entry whose fetch said 404 gets `genre_ids=[]`, and so does a title TMDB genuinely has no genres for. An empty list also means "missing". To stop either being refetched forever, both add the pk to a process-lifetime `_settled` set. Across restarts it is retried once, which is cheap. *Alternative:* a new `metadata_checked_at` column. Rejected for now (migration); revisit if TMDB-deleted titles turn out to be common.
- **`stats` view:** replaces its inline thread with `request_backfill(request.user.id)` when any entry needs metadata. The response is still built from what's stored now. Genres appear on a later request, which matches today's behavior for language/year.
- **`_compute_personalized`:** replaces its `_fill_genre` loop with a synchronous `backfill_entries(missing)`, the same worker function as `request_backfill`'s thread. Personalized needs genres before clustering, so it can't be fire-and-forget. `_fill_genre` is deleted.
- **Exceptions:** each worker catches `(requests.RequestException, ValueError, TypeError, DBError)`. The thread's outer loop stays narrow, per the CLAUDE.md bare-except convention, because the thread body is a single fetch+update per entry.

*Alternative:* trigger the backfill from the `post_save` signal on `WatchedEntry`. Rejected: bulk imports use `bulk_create` (no signal), and existing libraries need a pull-based fill anyway. The signal path can be added later without changing this module.

### D4. Watched POST stores supplied language and year; the client sends them
`watched_list` POST adds `original_language` and `release_year` from `validated_data` to the `get_or_create` defaults. The serializer already validates both.

On the frontend:
- `MarkWatchedModal` already fetches the movie/TV details for runtime. It now also returns `originalLanguage` (`original_language`) and `releaseYear` (parsed from `release_date`/`first_air_date`) in `onConfirm`'s details.
- `WatchedEntry`/`WatchedInput` gain the two optional fields.
- `useWatched.addRaw` posts them.

Every modal caller already spreads `...details`, so no call site changes. Callers that mark watched without the modal (episode progress in `TVShowDetails`) still rely on the backfill.

### D5. Ratings: sync on score change; bump `rated_at` on any rating change
- **POST:** `update_or_create` defaults include `rated_at: timezone.now()`, so creating and re-rating both stamp now. `bulk_ratings` is unchanged and keeps the supplied timestamp.
- **PATCH:** compare the old and new `user_rating`/`review`. If either changed, set `rated_at = now`. If `user_rating` changed, post it to TMDB through a helper `_sync_rating_to_tmdb(user, entry)` shared with POST, with the same narrow exception catch and log. Review-only edits don't call TMDB (TMDB has no review API).

### D6. Recommendation section keys
- `because-{media_type}-{media_id}`.
- **Actors:** `top_actors` already carries the TMDB person id (`cast_count` is keyed by `actor_id`), so use `actor-{actor_id}`.
- **Followed people:** `follow-{fp.person_id}`.
- **Clusters:** before appending, look up an existing section by label. If found, merge the items (dedupe by `(id, type)`, keep score order, cap at 12) instead of appending a second section. Cluster keys stay `cluster-{idx}` for the first occurrence.

The frontend uses `key` only as a React key and doesn't parse it, so changing the formats is safe. Check `RecommendationsPage` while implementing.

### D7. List items and proxy params
- **Lists:** `UserListSerializer.items` becomes a method field that sorts `obj.items.all()` by `(-added_at, -id)` in Python. That works on the prefetched cache in `lists_list` (no extra query) and on the PATCH response, which also serializes items. *Alternatives:*
  - `Prefetch(..., queryset=...order_by(...))` only covers the GET path.
  - `Meta.ordering` on `UserListItem` changes every query implicitly and needs a migration state entry.
- **Proxy:** build params as `[(k, v) for k, vs in request.GET.lists() if k != "api_key" for v in vs] + [("api_key", settings.TMDB_API_KEY)]`. `requests` accepts a list of tuples and keeps both the repeats and the order.

## Risks / Trade-offs

- **[Notifications for a user following many people still fans out on a cold cache]** → Each person is cached 6h and shared across users, and the endpoint is already throttled. The first poll after a cache expiry pays at most one fetch per followed person, with 5 workers. Acceptable at this app's scale. If it isn't, the next step is a background refresher, not a cap.
- **[In-memory backoff/unfillable sets are per process and lost on restart]** → The worst case is one extra fetch per bad title per restart or worker. Gunicorn workers each keep their own set, so with N workers a failing title is retried at most N times per hour.
- **[`_ensure_cached` returning `None` makes a title invisible to For You genre and cast counting]** → It already was in effect (an empty row contributes nothing). Now it self-heals on the next run instead of after 7 days.
- **[Merged personalized clusters can yield fewer sections]** → Intended. Duplicate labels were two near-identical rows.
- **[Changing section key formats]** → Keys aren't persisted server-side. The For You sessionStorage cache stores whole sections and is replaced on its next fetch.

## Migration Plan

There's no schema migration. Deploy normally. Existing poisoned `TMDBMediaCache` rows (empty genres/cast from past failures) are refreshed naturally once their 7-day window passes. They are not purged. Rolling back is a code revert.
