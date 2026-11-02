## Context

Backlog item 56 (B4 module sweep): `social_views.py` holds follows, episode progress and the followed-people TMDB fetch (`_fetch_followed_people_credits`), and `notifications_views.py` holds the poll and mark-seen. Both read the `person_credits` cache alias (DatabaseCache in prod, `MAX_ENTRIES` 10,000, two rows per person). The security review found nothing. Of the ten findings, nine were confirmed by reading the code and one (a null `vote_average` crashing the Recommendations page) is plausible only.

## Goals / Non-Goals

**Goals:**
- Mark-seen never loses seen keys and never records items a poll doesn't return.
- Follows and episode progress are bounded per user, through the existing `library_limits` machinery.
- Followed-people fetches have bounded capacity per process, make progress when TMDB is slower than the budget, and can't 500 on a malformed answer.
- A person's two cache rows live and die together.

**Non-Goals:**
- Changing the poll's budget, `NOTIFICATIONS_MAX_FETCH`, the 30-day window or `MAX_ITEMS`.
- Having the client send the keys it displayed: the server already knows what a poll returns.
- Merging the two cache rows into one: polls would then load every person's new-work list, which `notifications-cache-hygiene` split out on purpose.

## Decisions

**Mark-seen: shown keys first, then the old set, capped.** Mark-seen builds the window exactly as the poll does (the same `_window_items`, the same `watched` exclusion, the first `MAX_ITEMS`) and stores `shown + [k for k in old if k not in shown]`, cut to `MAX_SEEN_ITEMS` (500). Old keys of people with no cached summary survive, and the newest seen keys always fit. Keys older than the window stay until pushed out by the cap. That is harmless: an item outside the window is never shown. A legacy checkpoint (`seen_items` null) starts from an empty old set. Alternative: keep old keys only for people without a cached summary. That needs a person per key, which the stored keys don't carry.

Using the poll's `watched` set in mark-seen (it uses `set()` today) keeps "the first `MAX_ITEMS`" the same 30 items the poll returned. A watched title is never shown, so it doesn't need to be recorded.

**Limits: `followed` 1,000 and `episode_progress` 20,000 in `LIMITS`.** 1,000 follows covers any real use (a notifications poll covers 40 uncached people per poll, so 1,000 cold follows take 25 polls). It also keeps one account to at most 2,000 of the cache's 10,000 rows. 20,000 matches the other per-title collections. A single follow goes through `library_limits.get_or_create`. The episode-progress POST is an upsert: an existing show updates without the lock, and a new one goes through `get_or_create` and then sets its fields. Both bulk endpoints pass `limit=`. The frontend's `importSummary.FULL` gains `followed` and `episode_progress` phrases, and the backup restore passes the collection for both sections.

**One module-level pool: `FOLLOWED_POOL = ThreadPoolExecutor(16, thread_name_prefix="tmdb-followed")`.** It is separate from the proxy's pool and the deadline pool, so a stall here can't delay rating sync or the proxy (the `endpoint-time-budgets` rule). The per-call cap stays at 5 in flight: the request submits at most 5 at a time and submits the next when one completes, so one poll can't take all 16 workers. At the deadline, queued work is cancelled and running work finishes on its own. `SESSION_POOL_SIZE` goes from 32 to 48 (proxy 16 + deadline 16 + followed 16), and `test_startup_warmup`'s pin covers the new pool. Alternative: `call_with_deadline` per person. That is one future per call on the shared deadline pool, which is exactly the shared capacity to keep away from.

**Late results: a lock-guarded dict, flushed on the request thread.** Each future gets a done callback that, if the request has already given up on it, puts `(person_id, credits)` into `_late_results` (a dict under a `threading.Lock`, at most 200 entries, dropping new ones when full). The callback runs on the worker thread, so it must not touch the cache, which is DB-backed in prod. The next `_fetch_followed_people_credits` call (on a request thread, in any user's request) pops everything there and `set_many`s it before reading the cache, so those people count as cached. A failure (`None`) is never put there. Alternative: write the cache from the worker. That breaks the "workers only do HTTP" rule and leaks a DB connection per worker thread.

**Clean on trim, bump to v3.** `_fetch_person_credits` keeps a credit only if it's a dict with an `int` (not `bool`) `id`, `media_type` in `movie`/`tv`, and a non-blank string `title` or `name`. `genre_ids` is checked only when it's a list. `vote_average` is stored as a float when it's a finite number, else 0. A top-level `cast`/`crew` that isn't a list raises `ValueError`, which is already a failed fetch. `fetch` also catches `TypeError`/`AttributeError` as a backstop. Because the stored data can be trusted after this, both read sides can index `c["id"]` and `c["vote_average"]`. Keys become `person:v3:<id>:new` / `person:v3:<id>:recent`: v2 rows can hold uncleaned data, and the shared prefix makes the cull's alphabetical order remove a person's two rows together (consecutive keys, except at the cull boundary, which is one person at most).

**One mapping.** `credit_item(c)` returns `{"id", "type", "title", "posterPath", "voteAverage"}`. Notifications add `releaseDate` and `personName`, and "New from" uses it as is. The movie/tv filter disappears from both readers (trim did it). The `(id, type)` dedupe stays per reader, because the scopes differ (per person vs across people).

## Risks / Trade-offs

- [Late results are per process] → A late fetch in one gunicorn worker helps only the next call in that worker. That's still progress, and 3 workers converge.
- [A pool shared by all requests] → A burst of polls queues behind 16 workers while TMDB is slow. The per-request budget still bounds every response, and queued work is cancelled at its deadline.
- [Keys over 500 drop the oldest] → Only someone with 500 seen notifications plus new ones loses the oldest. Those are long outside the 30-day window.
- [v3 keys cold-start the cache] → Every person is refetched once after deploy, spread over polls by `NOTIFICATIONS_MAX_FETCH`.
- [Existing accounts above a limit] → They keep their rows (the `library-limits` rule) and can't add more.
