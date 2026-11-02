## 1. Credit cleaning and cache keys

- [x] 1.1 `_fetch_person_credits`: raise `ValueError` when `cast`/`crew` isn't a list; keep a credit only if it's a dict with an `int` (not `bool`) `id`, `media_type` in movie/tv and a non-blank string `title` or `name`; check `genre_ids` only when it's a list; store `vote_average` as a finite float, else 0
- [x] 1.2 `fetch` also catches `TypeError`/`AttributeError` as a failed fetch (logged, not cached)
- [x] 1.3 Keys become `person:v3:<id>:new` / `person:v3:<id>:recent`; update CLAUDE.md's key names
- [x] 1.4 Tests: null score → 0 in "New from"; non-list `cast` → failed fetch, retried next poll, other people still shown; credit with no title, a list id or `genre_ids: 5` dropped, poll 200; a person's two keys sort next to each other

## 2. Shared pool and late results

- [x] 2.1 Module-level `FOLLOWED_POOL` (16 workers, `tmdb-followed` prefix); keep at most 5 of one call's fetches in flight, submitting the next as one completes; cancel queued work at the deadline
- [x] 2.2 `SESSION_POOL_SIZE` 32 → 48 with its comment; `test_startup_warmup` pins `FOLLOWED_POOL` at least the request threads and the session pool at least the sum of the pools
- [x] 2.3 Late results: a done callback puts a successful result the call no longer waits for into a lock-guarded `_late_results` (≤200, new ones dropped when full); each call pops and `set_many`s them on its own thread before reading the cache
- [x] 2.4 Tests: no per-call executor is created; a fetch finishing after the deadline is served by the next call without a TMDB request; a failed late fetch isn't stored; worker threads never touch the cache

## 3. Mark-seen

- [x] 3.1 Mark-seen uses the poll's `watched` set and records the first `MAX_ITEMS` window keys, then the previous `seen_items` not among them, cut to `MAX_SEEN_ITEMS`; a null legacy set starts empty
- [x] 3.2 Tests: seen key of a person with no cached summary survives a second mark-seen and stays read when the person is fetched again; a window item past `MAX_ITEMS` isn't recorded and is unread once it moves into the list; cap keeps the newest keys

## 4. Limits

- [x] 4.1 `LIMITS` gains `followed` (1,000, "You can follow at most {:,} people.") and `episode_progress` (20,000, "Episode progress is limited to {:,} shows.")
- [x] 4.2 Follow POST goes through `library_limits.get_or_create`; episode-progress POST updates an existing show without the lock and creates a new one through `get_or_create`; both bulk endpoints pass `limit=`
- [x] 4.3 Frontend: `importSummary.FULL` gains `followed` and `episode_progress`; the backup restore passes the collection for the Following and Episode progress sections; check the follow buttons and the Episode Guide show the server's 400 message
- [x] 4.4 Tests: follow and progress single add at the limit → 400 with the message, re-follow and progress update on a tracked show still saved; bulk restore crossing the limit reports `overLimit`; Jest for the two new phrases

## 5. Cleanup

- [x] 5.1 `_follow_data(fp)` used by the follow GET and POST; the episode-progress POST returns `_progress_data(prog)`
- [x] 5.2 `credit_item(c)` shared by `_window_items` and `followed_people_recommendations`; drop their movie/tv filters (done at trim); watched set via `values_list`
- [x] 5.3 ~~`FollowPersonInputSerializer.personId` required~~ kept as is: `test_input_validation` pins the `{"detail": "personId is required."}` shape, which a required field would change to a field error

## 6. Verify and docs

- [x] 6.1 Backend pytest (full), ruff, `makemigrations --check`; Jest, lint, typecheck; e2e only for specs touching follows, notifications or the backup restore
- [x] 6.2 Live TMDB checks (`RUN_LIVE_TMDB=1 pytest -m live_tmdb`): the person-credits checks now assert the cleaned shape (title required, show dates folded into `release_date`, crew compared after cleaning)
- [x] 6.3 CLAUDE.md (pool, late results, key names, limits) and `docs/ARCHITECTURE.md` (mark-seen merge rule, late-result flush); backlog item 56 marked 📝 with the change name
