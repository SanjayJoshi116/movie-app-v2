## 1. Credits cache alias

- [x] 1.1 `settings.py`: add `person_credits` alias (prod `DatabaseCache` `person_credits_cache`, `MAX_ENTRIES` 10,000; DEBUG LocMem `LOCATION` `person-credits`, `MAX_ENTRIES` 2,000), with a comment on why it is separate from `default` and `tmdb`
- [x] 1.2 `backend/conftest.py`: autouse fixture also clears `caches["person_credits"]`
- [x] 1.3 Test (settings or followed people): the alias is distinct from `default` and `tmdb` in both modes (different backend location), and filling it never removes a `default` key

## 2. Full list + recent summary

- [x] 2.1 `social_views.py`: credits read/written through `caches["person_credits"]`; keys `person_credits:<id>` (full) and `person_recent:<id>` (credits dated within UTC today −32 / +2 days); both written together with `PERSON_CREDITS_TTL`, on the calling thread; a 404 writes `[]` to both
- [x] 2.2 `_fetch_followed_people_credits(..., summary_only=False)`: with `summary_only`, `get_many` and return summaries; misses fetched as today (max_fetch, budget) and both keys written
- [x] 2.3 `notifications_views.py`: call with `summary_only=True`; behavior otherwise unchanged
- [x] 2.4 Tests: a poll reads only summary keys (full lists absent from the poll's read); a title dated tomorrow at fetch time appears the next day within TTL (frozen clock); old-dated credits are not in the summary; recommendations still get full lists; existing tests moved to the new alias/keys; failure still uncached, 404 cached as `[]` in both

## 3. Same-day seen items

- [x] 3.1 `NotificationCheckpoint.seen_same_day = JSONField(default=list)`; migration `0026` (generated with the project's Django env, `makemigrations --check` clean)
- [x] 3.2 `mark_notifications_seen`: compute keys of cached summary items dated the mark-seen day (request zone; watched titles may be included, they never show anyway); store ≤ 100 keys with `last_seen_at`
- [x] 3.3 Poll: `isUnread = release_date > last_seen_date or (release_date == last_seen_date and [id, type] not in seen_same_day)`
- [x] 3.4 Tests: same-day item present at mark-seen → read; same-day item that appears after → unread and counted; earlier-dated items read; `test_local_dates` same-day behavior in a non-UTC zone still correct; `test_e2e_mock_shapes` unaffected (no API shape change)

## 4. Log redaction

- [x] 4.1 `logging.py`: lookbehind form for `session_id`/`guest_session_id`/`request_token` in query params and JSON fields
- [x] 4.2 `test_logging.py`: `guest_session_id=` in a URL and `"guest_session_id": "…"` in JSON are redacted; `session_id` and `request_token` still are; an unrelated `xsession_id=` style token stays untouched (no over-match)

## 5. Docs and verification

- [x] 5.1 CLAUDE.md: the TMDB cache-alias rule extends to person credits (`person_credits` alias, never `default`), notifications read summaries, `guest_session_id` is a redacted credential
- [x] 5.2 `docs/ARCHITECTURE.md` rationale; CHANGELOG `[Unreleased]` with deploy note (migration 0026, new cache table at boot); README test list; `features.txt` if user-visible (same-day unread); `docs/BUG_BACKLOG.md` item 29 → 📝 now, ✅ on archive
- [x] 5.3 Run `ruff check backend/`, `makemigrations --check --dry-run` (DEBUG=True, project Django env), the full backend pytest; frontend untouched, so only the notifications e2e specs if any fixture changes
