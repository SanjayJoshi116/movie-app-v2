## Why

The B4 module sweep (backlog item 56) found that marking notifications seen can bring already-seen titles back as unread, that follows and episode progress have no size limit, and that the followed-people TMDB fetch runs on a pool built per request whose threads outlive the deadline, 500s on a malformed TMDB answer and throws away results that arrive late. All ten findings were checked against the code: nine confirmed, one plausible.

## What Changes

- Mark-seen keeps the previously seen keys and adds the ones the user was shown (the first `MAX_ITEMS` of the window, as a poll returns them), instead of replacing the set with what happens to be cached. A person whose summary isn't cached at that moment no longer loses their seen titles, and titles past the shown 30 are no longer marked seen.
- Follows get a per-user limit of 1,000 and episode progress one of 20,000, through `library_limits` (single add: 400 naming the limit; bulk: fills up to the limit and reports `overLimit`).
- Followed-people credit fetches run on one module-level bounded pool (`FOLLOWED_POOL`) instead of a `ThreadPoolExecutor(5)` per request; `SESSION_POOL_SIZE` grows to cover it.
- A fetch that finishes after its request's deadline is kept (lock-guarded, bounded, in process memory) and written to the credit cache by the next fetch on a request thread, so a slow TMDB still makes progress.
- TMDB credits are cleaned when they're trimmed: a credit without an integer id, a movie/tv type or a title is dropped, `genre_ids` is read only as a list, and `vote_average` is always a number. A malformed answer is a failed fetch (not cached, retried), never a 500. Cache keys move to `v3`.
- A person's two cache entries become `person:v3:<id>:new` and `person:v3:<id>:recent`, so the cache's alphabetical cull removes both of a person's entries together instead of every "New from" list first.
- Cleanup: one `_follow_data`/`_progress_data` helper per response shape; one credit-to-item mapping shared by notifications and "New from"; `values_list` for the watched set; `personId` required by the serializer.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `notifications`: "Unread means not seen at the last mark-seen" now records the notifications the user was shown and keeps what was seen before; per-person credit caching keeps a person's entries together and survives malformed TMDB answers and late fetches.
- `library-limits`: follows (1,000) and episode progress (20,000 shows) join the per-user limits.
- `endpoint-time-budgets`: followed-people TMDB fetches run on bounded capacity of their own shared across requests.

## Impact

- Backend: `social_views.py`, `notifications_views.py`, `library_limits.py`, `serializers.py`, `tmdb_client.py` (`SESSION_POOL_SIZE`), tests (`test_notifications`, `test_followed_people`, `test_library_limits`, `test_startup_warmup` pool pin).
- Frontend: the backup restore and follow button already show a bulk `overLimit` and a 400's message; check the follow and episode-progress paths show the new limit messages.
- Cache: `person_*:v2` entries are never read again and expire within 6 h; no migration.
