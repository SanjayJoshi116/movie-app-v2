## Why

Backlog item 29 (fifth audit) found three ways the followed-people feature misuses shared server state, plus one notification bug:

- Followed people's cached credits sit in the `default` cache next to the rate-limit counters. Past its 50,000-entry limit, every cache write culls a third of `default`, and the throttle keys sort first, so they are evicted before the bulky credits. One account can force this on purpose: bulk-follow arbitrary ids 500 at a time, then poll notifications.
- Each notifications poll loads every followed person's full cached credit list (20–50 kB each), however many people the user follows. Follows have no total limit, so 5,000 follows means 100–250 MB unpickled per poll in a sync worker.
- The log redaction misses `guest_session_id`, which the proxy itself treats as a credential.
- A release dated the day the user marks notifications seen never shows as unread, even when it first appears later that day.

The proxy cache was given its own alias for the first problem's twin (`speed-up-pages`). The follow cache never was.

## What Changes

- **Per-person credits move to their own cache alias** (`person_credits`: a `DatabaseCache` table in production, a separate LocMem store under `DEBUG`), bounded by entry count. Filling or culling it can't evict throttle counters, and it can't evict proxy entries either.
- **Notifications read a small per-person summary, not the full credit list.** When a person's credits are fetched, the system also stores the few credits dated around "now" (a window wide enough for the 30-day lookback, every time zone and the cache lifetime). A poll loads only those summaries, so its memory grows with recent releases, not with total credits. Followed-people recommendations keep reading the full lists for the 10 most recent follows.
- **`guest_session_id` is redacted** in log lines, as a query parameter and as a JSON field, like `session_id` and `request_token`.
- **A same-day release that appears after "mark seen" shows as unread.** Marking seen records which items dated that day the user had at that moment. A later item dated the same day is unread.

One migration: a field on the notification checkpoint for the same-day items. No API shape change, no frontend change, no nginx change. The new cache table is created by the existing `createcachetable` step at startup.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `notifications`: credit lookups are cached apart from other server state, a poll's work is bounded by recent releases rather than total credits, and a same-day release that appears after mark-seen is unread.
- `api-hardening`: log redaction covers `guest_session_id`.

## Impact

- Backend: `settings.py` (new cache alias), `social_views.py` (credits cache alias, summary key), `notifications_views.py` (reads summaries, same-day seen items), `models.py` + migration `0026` (`NotificationCheckpoint.seen_same_day`), `logging.py` (regexes), `backend/conftest.py` (clear the new alias between tests).
- Tests: `test_notifications.py`, `test_followed_people.py`, `test_logging.py`, `test_local_dates.py` updated or extended. A settings test pins the alias's separation from `default`.
- Docs: CLAUDE.md (cache alias rule extended to person credits), `docs/ARCHITECTURE.md`, `docs/BUG_BACKLOG.md` item 29.
- Deploy: one migration, plus a new cache table created at startup. Existing credit entries in `default` expire on their own within 6 h. Until then they are never read again.
