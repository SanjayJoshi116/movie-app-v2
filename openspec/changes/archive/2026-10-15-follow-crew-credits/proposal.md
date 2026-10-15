## Why

Backlog item 36. Following people is half-built for anyone who isn't an actor:

- **Following a director, writer or composer never produces anything.** Notifications and the followed-people sections on For You read only a person's acting credits. The person page has a Crew tab and a Follow button for everyone, so following Christopher Nolan gives an empty bell, even with *The Odyssey* (directed and written by him) released this year.
- **"New from {name}" isn't new.** The section drops everything under 6.0 rating, which removes every new or upcoming release (they have few votes), then sorts by rating: it lists the person's best-rated titles, often decades old.
- **Unread is decided by release date.** A title TMDB adds late with a past date (common, data entry lags release), or one that reaches the cache after the user marked notifications seen, is never shown as unread. A same-day exception list (0.26.0) covers only titles dated the mark-seen day.
- **Talk-show and news appearances count as work.** "Self" credits on *The Late Show*, *Today* and award broadcasts feed the person-based sections (12–40 such credits per person, measured).
- **Nit:** follow and unfollow share an in-flight slot without action names, against the `run(key, fn, action)` convention.

## What Changes

- **Crew counts**: a person's credits are their acting credits plus every crew credit (all jobs), one entry per title and media type, for notifications, the followed-people sections and their cache. Talk and news appearances are left out there and in "Because you like {actor}".
- **"New from {name}" is new**: the person's titles released in the last two years or dated ahead, newest first, unwatched, with no rating minimum.
- **Unread = not seen yet**: marking seen remembers every notification the user had then; any later item not in that set is unread, whatever its date. A checkpoint from before this change keeps the date rule until its next mark-seen. Migration replaces the same-day list with the seen set. **BREAKING** (data): the `seen_same_day` column is dropped.
- Follow and unfollow pass action names to their in-flight slot.
- Live check: a crew-only person's recent work comes through the credits fetch.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `notifications`: credits behind the camera count; talk/news appearances don't; unread means "not seen at the last mark-seen" (replaces the same-day requirement).
- `recommendation-sections`: followed-people sections list new and upcoming work; talk/news appearances don't drive person-based sections; the both-media-types scenario no longer depends on rating.
- `tmdb-live-checks`: a crew-only followed person's recent work is checked against live data.

## Impact

- Backend: `social_views.py` (credit fetch, cache contents and keys, followed-people sections), `notifications_views.py` (unread rule, mark-seen), `models.py` + migration 0029 (`NotificationCheckpoint.seen_items`, drop `seen_same_day`), `recommendations.py` (actor credits filter). Cache keys get a version so entries cached before this change (cast only) aren't read.
- Frontend: `FollowedPeopleContext.tsx` (action names). No API shape change.
- Tests: notifications, followed-people and recommendations pytest; FollowedPeopleContext Jest; `test_tmdb_live.py`.
- Docs: CLAUDE.md (followed people / notifications bullet), `docs/BUG_BACKLOG.md`.
- The cached per-person list shrinks to recent and upcoming work, so prolific people cost less than today.
