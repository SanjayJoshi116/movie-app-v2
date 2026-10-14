## Context

Backend only. See proposal.md for the motivation and `specs/` for the requirements. Current code (re-checked 2026-10-14):

- `social_views._fetch_followed_people_credits` uses `django.core.cache.cache` (`default`). It does a `get_many` over every follow's `tmdb:person_credits:<id>` key, fetches up to `max_fetch` misses on a pool (HTTP only), and `cache.set`s each result on the calling thread. The cache holds the trimmed cast list (8 fields per credit, hundreds of credits for prolific people).
- Two callers:
  - notifications: all follows, `max_fetch=40`, 15 s budget.
  - followed-people recommendations: the 10 most recent follows, 15 s budget.
- In production `default` is `DatabaseCache` `cinedb_cache` (`MAX_ENTRIES` 50k) and `tmdb` is `tmdb_proxy_cache` (2k). Under DEBUG both are LocMem with separate `LOCATION`s.
- `createcachetable` (in `start.py` and `docker-entrypoint.sh`) creates a table for every `DatabaseCache` alias, so a new alias needs no deploy step.
- The login-failure counters left the cache in `harden-account-input`, so the cull now risks only throttle counters (and, later, anything else put in `default`).
- `notifications_views`: `isUnread = release_date > last_seen_date` (day-granular in the request's zone). `mark_notifications_seen` only stamps `last_seen_at`.
- `logging.py`: `_CREDENTIAL_PARAM = \b(session_id|request_token)=…` and `_CREDENTIAL_JSON = "(?:session_id|request_token)"\s*:`. Neither matches `guest_session_id`.

## Goals / Non-Goals

**Goals:**
- No follow or poll pattern can evict throttle counters or proxy entries.
- A poll's cache read is proportional to recent releases.
- `guest_session_id` never logged.
- Same-day releases that appear after mark-seen are unread.

**Non-Goals:**
- A total cap on follows, or a smaller bulk-follow chunk. With the credits isolated and summaries small, many follows cost TMDB fetches (already capped per poll and rate-limited per user) and summary rows, not shared state.
- Changing the recommendations' use of full credit lists (10 people, bounded already).
- Frontend or API shape changes.

## Decisions

1. **New alias `person_credits`, not `tmdb`.**
   - Production: `DatabaseCache`, table `person_credits_cache`, `MAX_ENTRIES` 10,000.
   - DEBUG: LocMem with `LOCATION` `person-credits` and `MAX_ENTRIES` 2,000.
   - Sharing `tmdb` (2k entries) would let a big follow list cull the proxy's detail pages, and the proxy's browsing would cull credits, turning cache hits into TMDB refetches. A separate alias keeps both bounded independently.
   - 10k entries covers full + summary for ~5,000 people. Full lists are typically 5–30 kB after trimming, so a full table stays in the low hundreds of MB worst case. That is acceptable for a DB table, and culling only drops credits, which are refetched.
   - Accessed through `caches["person_credits"]` via one module-level helper in `social_views`, so tests and both callers go through the same place.

2. **Two keys per person: full list and a recent summary.**
   - Key names:
     - `person_credits:<id>`: the full trimmed list, as today.
     - `person_recent:<id>`: only the credits with a parseable date inside `[today_utc − 32 days, today_utc + 2 days]` at the time of the fetch.
   - Both are written together with the same TTL (6 h), on the calling thread.
   - Window: the poll's cutoff is 30 days back in the device's zone. Device zones are at most a day from UTC, and a summary is at most 6 h old, so `−32 / +2` days covers every poll that can read it. A title dated tomorrow at fetch time is included (the "moves into the window" scenario).
   - Notifications `get_many` the summary keys only. A person whose summary is missing is a miss and is fetched (up to `max_fetch`) exactly as today. Recommendations keep reading full lists.
   - *Alternative:* cap notifications at the N most recent follows. Rejected: the spec requires every followed person to be covered.
   - *Alternative:* only a summary, no full list. Rejected: recommendations need the whole list.
   - The fetch helper takes a `summary_only` flag. When set, its `get_many` and its return value use summaries. Misses are fetched once and both keys written, so the two callers share fetches.
   - A 404 writes `[]` to both keys.

3. **Old keys in `default` are left to expire.** They are never read again (new alias, new key names) and expire within 6 h. No cleanup migration.

4. **Same-day seen items: `NotificationCheckpoint.seen_same_day`**, a `JSONField(default=list)` of `[id, type]` pairs.
   - `mark_notifications_seen` reads the summaries of the user's follows from the cache only (no TMDB call, cheap since they're small). It computes the keys of items dated the mark-seen day (in the request's zone) and stores them with `last_seen_at`.
   - In the poll: `isUnread = release_date > last_seen_date or (release_date == last_seen_date and key not in seen_same_day)`.
   - Items missing from the cache at mark-seen time weren't shown either, since a poll only shows cached or just-fetched people, so they count as unseen. That is correct: the user never had them.
   - *Alternative:* the client sends the keys it displayed. Rejected: it needs a frontend change and mocks, and an old cached bundle would send none, so today's items would pop back as unread.
   - *Alternative:* exact timestamps per item. TMDB gives no "added at", so it's impossible.
   - The cap is natural (≤ `MAX_ITEMS`-ish per day). Store at most 100 keys defensively.

5. **Redaction regexes**: `(?<![A-Za-z0-9])((?:guest_)?session_id|request_token)=[^&\s'"]+` and `"((?:guest_)?session_id|request_token)"\s*:` for JSON fields. The lookbehind replaces `\b`, which can't see the boundary inside `guest_session_id` because `_` is a word character. A test covers both shapes for all three names.

6. **Test isolation**: `backend/conftest.py`'s autouse fixture also clears `caches["person_credits"]`. Existing tests that read `cache.get("tmdb:person_credits:…")` switch to the helper.

## Risks / Trade-offs

- **Two cache writes per fetched person** → small cost, and the summary row is tiny. Both writes happen on the request thread, as the rule requires.
- **Mark-seen reads summaries for every follow** → one `get_many` over small rows, the same order of cost as a poll's read after this change, and 30/min throttled polls already pay it.
- **A summary computed with a UTC window** could miss a title only if a summary outlived its TTL, which the cache prevents.
- **The checkpoint migration adds a column with a default** → safe online on Postgres (no rewrite for a constant default since PG 11).

## Migration Plan

Migration `0026_notificationcheckpoint_seen_same_day`. The new cache table is created by `createcachetable` at boot (both `start.py` and the Docker entrypoint). Rollback: revert the commit. The extra column and table are inert.
