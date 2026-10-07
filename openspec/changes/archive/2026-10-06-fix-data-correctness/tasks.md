## 1. Title metadata

- [x] 1.1 `recommendations._ensure_cached`: on fetch failure return the existing row unchanged (stale or not) or `None` when there is none; never write empty data
- [x] 1.2 Add `backend/userdata/metadata_backfill.py`: `entry_needs_metadata`, `fetch_entry_metadata` (one `/{type}/{id}` call → genres + language + year, single `.update()`; 404 or no genres → sentinels/settled set `_settled`; other failure → `_failed_at` backoff 1h), `backfill_entries(entries)` (5 workers, skips backoff/settled; DB writes on the calling thread), `request_backfill(user_id)` (per-user single-flight thread, `finally` releases the slot)
- [x] 1.3 `stats_views.stats`: replace the inline 20-worker thread with `request_backfill(request.user.id)` when any entry needs metadata
- [x] 1.4 `_compute_personalized`: replace the `_fill_genre` loop with synchronous `backfill_entries(missing)`; refresh the entries' fields from what was written; delete `_fill_genre`
- [x] 1.5 `watched_views.watched_list` POST: add `original_language`/`release_year` from `validated_data` to the `get_or_create` defaults
- [x] 1.6 Tests (`test_metadata_backfill.py` + `test_watched.py`): failed refresh keeps a good cached row; failed first fetch stores nothing; <3 watched titles get genres via backfill and appear in stats `topGenres`; second `request_backfill` while running is a no-op; 404 sets sentinels and isn't refetched; transient failure is skipped until backoff passes; POST keeps supplied language/year

## 2. Frontend: send language/year on mark-watched

- [x] 2.1 `WatchedEntry` type: optional `originalLanguage`/`releaseYear`; `useWatched.addRaw` posts them
- [x] 2.2 `MarkWatchedModal`: return `originalLanguage` and `releaseYear` (parsed from `release_date`/`first_air_date`) in `onConfirm` details from the details request it already makes
- [x] 2.3 `npx tsc --noEmit`; confirm every `MarkWatchedModal` caller spreads `...details`

## 3. Notifications

- [x] 3.1 `_fetch_followed_people_credits`: `limit=None` default (all followed); per-person `django.core.cache` entry `tmdb:person_credits:<id>` (6h TTL) holding only the fields callers read; failures return `[]` uncached
- [x] 3.2 `followed_people_recommendations` passes `limit=10` explicitly
- [x] 3.3 Tests (`test_notifications.py`): 15 follows, only the oldest has a recent release → it's listed; a second poll makes no TMDB calls; a failed person is refetched next poll (clear cache in `setUp`)

## 4. Ratings

- [x] 4.1 Extract `_sync_rating_to_tmdb(user, entry)` from the POST path (same narrow catch + log)
- [x] 4.2 POST: `rated_at=timezone.now()` in `update_or_create` defaults
- [x] 4.3 PATCH: if score or review changed, set `rated_at=now`; if score changed, call `_sync_rating_to_tmdb`
- [x] 4.4 Tests (`test_ratings.py`): PATCH score syncs to TMDB; review-only PATCH doesn't; TMDB failure still 200; re-rate via POST and PATCH bumps `ratedAt`; bulk restore keeps supplied `ratedAt`

## 5. Recommendations, lists, proxy

- [x] 5.1 Section keys: `because-{media_type}-{media_id}`, `actor-{actor_id}`, `follow-{person_id}`
- [x] 5.2 `_compute_personalized`: merge a cluster into an existing section with the same label (dedupe `(id, type)`, cap 12)
- [x] 5.3 `UserListSerializer.items`: method field sorted by `(-added_at, -id)`
- [x] 5.4 `tmdb_proxy`: forward `request.GET.lists()` as a list of tuples, drop client `api_key`, append the server key
- [x] 5.5 Tests: duplicate-id movie/tv seeds and same-name actors give unique keys; duplicate cluster labels merge; list items ordered with a same-timestamp tiebreak; proxy forwards repeated params and drops client `api_key`

## 6. Verification and docs

- [x] 6.1 Backend suite: `G:/Anaconda/envs/django/python.exe -m pytest backend` (all green); `makemigrations --check` shows no changes
- [x] 6.2 Frontend: `npx tsc --noEmit` and Jest
- [x] 6.3 Python e2e suite (`e2e/python`) still green
- [x] 6.4 Live check under `npm run dev` with a throwaway `verify_*.py`: user with 2 watched titles gets Top Genres after a reload; marking a title watched via the modal stores language/year (check `/api/watched/`); notifications endpoint with several follows returns items and a repeat call is fast; re-rating moves the title to the top of `/api/ratings/`. Delete the script afterwards
- [x] 6.5 Update `docs/ARCHITECTURE.md` (metadata backfill single-flight + failure-never-overwrites, per-person credits cache); update CLAUDE.md if a new convention emerged (e.g. "never write a placeholder on upstream failure")
