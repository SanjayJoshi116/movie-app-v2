## 1. Person credits

- [x] 1.1 `_fetch_person_credits`: cast + crew combined, Talk (10767) / News (10763) entries dropped, deduped by `(id, media_type)`, trimmed
- [x] 1.2 Cache: `person_new:v2:<id>` (dated within `NEW_WORK_DAYS` = 730 before today or later, undated dropped) and `person_recent:v2:<id>`, written together; readers filter by date too; update the settings cache comment
- [x] 1.3 pytest: crew-only person yields credits; one entry per title for several jobs; talk/news dropped; old-key entries aren't read; recent and new lists stored together

## 2. "New from {name}"

- [x] 2.1 `followed_people_recommendations`: new list, skip watched and repeats, newest first (upcoming first), 12, no rating floor
- [x] 2.2 pytest: upcoming leads; old classic left out; no recent work → no section; movie and TV with the same id both kept

## 3. Unread rule

- [x] 3.1 Model `NotificationCheckpoint.seen_items` (JSON, null default), remove `seen_same_day`; migration 0029 with the project's Django (`makemigrations --check` clean after)
- [x] 3.2 Shared `_window_items` helper; poll: unread = not in `seen_items`, legacy date rule when null; new checkpoints start with `[]`
- [x] 3.3 `mark_notifications_seen`: store all window keys from the cached summaries, newest first, capped at `MAX_SEEN_ITEMS` (500)
- [x] 3.4 pytest: late-added past-dated item unread; seen item stays read; same-day release later in the day unread; new follow unread; legacy (null) checkpoint uses the date rule; replace the same-day tests

## 4. Other

- [x] 4.1 `recommendations.fetch_actor_credits`: skip Talk/News entries; pytest
- [x] 4.2 `FollowedPeopleContext`: `run(key, fn, "follow" | "unfollow")`; Jest: unfollow during a pending follow runs after it with its own outcome
- [x] 4.3 `test_tmdb_live.py`: crew-only person (525) through `_fetch_person_credits` has crew credits, a recent or upcoming title, no talk/news

## 5. Verify

- [x] 5.1 Backend pytest, `ruff check backend/`, `makemigrations --check --dry-run`
- [x] 5.2 `RUN_LIVE_TMDB=1 pytest -m live_tmdb`
- [x] 5.3 Typecheck, lint, Jest; e2e `notifications.spec.ts` and the Python recommendation tests
- [x] 5.4 Run the app: follow Christopher Nolan, see *The Odyssey* in "New from" and (once in the window) the bell behaviour; unfollow

## 6. Docs

- [x] 6.1 CLAUDE.md followed-people / notifications bullet (cast + all crew, no talk/news, versioned keys, `seen_items` rule)
- [x] 6.2 `docs/BUG_BACKLOG.md`: item 36 → 📝 proposed, linked
