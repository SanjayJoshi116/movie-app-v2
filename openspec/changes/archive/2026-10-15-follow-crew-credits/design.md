## Context

See proposal.md for why. Today (`social_views.py`, `notifications_views.py`):

- `_fetch_person_credits(pid)` fetches `/person/{id}/combined_credits` and keeps `cast` only, trimmed to `_CREDIT_FIELDS`. `_fetch_followed_people_credits` caches two entries per person in the `person_credits` alias for 6 h: `person_credits:<id>` (full trimmed list, read by followed-people sections) and `person_recent:<id>` (credits dated −32/+2 days, read by notification polls). Both are written together on every fetch.
- `followed_people_recommendations` drops `vote_average < 6`, sorts by score, keeps 12: "New from {name}".
- `new_release_notifications` marks an item unread when `release_date > last_seen_date`, or `== last_seen_date` and not in `NotificationCheckpoint.seen_same_day`. `mark_notifications_seen` fills `seen_same_day` from cached summaries (items dated today) and stamps `last_seen_at`.
- `recommendations.fetch_actor_credits` reads `combined_credits.cast` for "Because you like {actor}".
- `FollowedPeopleContext` `follow`/`unfollow` call `inflight.run("person-<id>", fn)` with no action.

Measured on live TMDB (2026-10-15): combined_credits crew entries carry `media_type`, dates and `genre_ids` like cast entries. Nolan: 48 cast / 79 crew, latest *The Odyssey* (Director, Writer, Producer…, 2026-07-15). Pitt: 100 crew (61 Executive Producer). Talk (10767) or News (10763) genre appearances: 12–40 per person.

## Goals / Non-Goals

**Goals:** every followed person's recent work reaches the bell and their section; unread tracks what the user actually saw; smaller cached rows.

**Non-Goals:** filtering crew by job (the user chose all jobs); showing the person's job in the notification text; per-episode TV credits (TMDB credits a series, dated by its first air date, unchanged).

## Decisions

**1. One credit list per person: cast + all crew, deduped, no talk/news.**
`_fetch_person_credits` combines `cast` and `crew`, drops entries whose `genre_ids` include 10767 (Talk) or 10763 (News), dedupes by `(id, media_type)` keeping the first, then trims to `_CREDIT_FIELDS`. The trimmed entries no longer need `genre_ids`. *Alternative:* key-job filtering (rejected by the user: all jobs count).

**2. The full list becomes a "new and upcoming" list; keys get a version.**
What sections read is now credits dated within `NEW_WORK_DAYS` (730) before today, or later; undated ones are dropped. Stored as `person_new:v2:<id>` beside `person_recent:v2:<id>`, written together as now. Version suffixes make entries cached before the change (cast only, all-time) unreachable instead of being served for up to 6 h. Readers also filter by date, so a summary cached yesterday is still correct today. *Alternative:* keep the all-time list (bigger rows, and nothing reads the old part any more).

**3. "New from {name}": newest first, no rating floor.**
From the person's new list: skip watched and duplicates, sort by date descending (upcoming first), keep 12. Label and section key unchanged.

**4. Unread = not in the seen set; `seen_items` replaces `seen_same_day`.**
Migration 0029 adds `NotificationCheckpoint.seen_items` (`JSONField`, null allowed, default null) and removes `seen_same_day`. In a poll, with `seen_items` set, an item is unread iff `[id, type]` isn't in it. With it null (a checkpoint from before), the old date rule applies without the same-day part. `mark_notifications_seen` computes the same window items the poll would show from the cached recent summaries (no TMDB call, watched titles included or not, it doesn't matter), newest first, and stores up to `MAX_SEEN_ITEMS` (500) keys plus `last_seen_at`. A checkpoint created by a first poll gets `seen_items=[]`, so a new user's first notifications show as unread.
*Alternatives:* the client sends the keys it displayed (only the top 30, and trusts the client); keeping the date rule (the user chose the seen set).

**5. Window-items helper shared by poll and mark-seen.**
`_window_items(results, today, watched)` builds the dated, typed, deduped item list for the 30-day window; the poll applies `MAX_ITEMS` and unread, mark-seen takes all keys. Keeps the two from drifting.

**6. "Because you like {actor}" skips talk/news.**
`fetch_actor_credits` drops entries with genre 10767 or 10763. It still uses cast only: the section is about an actor the user watches.

**7. Follow/unfollow action names.**
`inflight.current.run(key, fn, "follow")` / `"unfollow"`.

## Risks / Trade-offs

- [All crew jobs include "Thanks" and Executive Producer credits on obscure titles] → user's choice; sections stay capped at 12, notifications at 30; noted for follow-up if it proves noisy.
- [Mark-seen reads the cache; a summary that expired between the poll and the close isn't recorded] → those items show unread again on the next poll, at worst once per 6 h cache cycle.
- [Everything in a new user's window shows unread once] → intended (new follow scenario).
- [Dropping `seen_same_day` loses same-day state for users mid-day at deploy] → falls back to the date rule until their next mark-seen; at worst a same-day item stays read.
- [`seen_items` cap of 500] → the window is 30 days; past 500 the oldest are left out and may show unread, unlikely with notification volumes.

## Migration Plan

Migration 0029 runs at deploy (`migrate`). Rollback: reverse migration restores an empty `seen_same_day`; the old code then uses the date rule.
