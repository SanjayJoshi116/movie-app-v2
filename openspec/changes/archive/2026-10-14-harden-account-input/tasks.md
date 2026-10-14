## 1. Login-failure counter (DB-backed, atomic)

- [x] 1.1 Add `LoginFailure` model (`key` CharField(64) primary key, `count` PositiveIntegerField, `window_start` DateTimeField with an index) and generate migration `0025` with the project's Conda interpreter and `DEBUG=True` (header must say Django 5.2)
- [x] 1.2 Rewrite `_login_failures` / `_record_login_failure` in `auth_views.py` over the single-statement `INSERT ... ON CONFLICT DO UPDATE` upsert and windowed `SELECT` from design Decision 1, deleting expired rows on record. Add `_clear_login_failures(key)`
- [x] 1.3 Add `_login_limited_response(key)` (429 detail plus `Retry-After` = real remaining seconds of the window) and use it in `login`
- [x] 1.4 Tests that don't depend on LocMem `incr`: 20 failures then 429 with correct password; window measured from the first failure (age `window_start` past 1 h via direct DB update → allowed; later failures don't move it); the limit still holds 10 minutes after the 20th failure; other usernames unaffected; existing and unknown usernames get the same response
- [x] 1.5 Parallel-burst test: 20 concurrent failures from threads (`django_db(transaction=True)`, each thread closes its connection) → count is 20 and the next attempt is 429

## 2. Password-gated actions and password reset

- [x] 2.1 `delete_account`: check the per-username limit before the password (429 via the shared helper); record a failure on a wrong password
- [x] 2.2 `UserProfileUpdateSerializer._require_current_password` sets `password_rejected` before raising "Incorrect password."; `profile` PATCH checks the limit only when the body has `current_password`, calls `is_valid()` without raising, records a failure when `password_rejected` is set, then raises the same `ValidationError` so the response body is unchanged
- [x] 2.3 `password_reset_confirm` clears the username's failures after `set_password`
- [x] 2.4 Add `PasswordResetConfirmThrottle` (scope `password_reset_confirm`, `10/hour` in `DEFAULT_THROTTLE_RATES`) and use it on confirm only; request keeps `password_reset`
- [x] 2.5 Tests: 20 wrong `current_password` PATCHes → next password PATCH, account delete and login all 429 even with the right password; a first-name-only PATCH still succeeds while limited; a wrong delete password counts; a reset clears the limit and the new password logs in; 2 reset requests + 3 rejected confirms → a 4th valid confirm is accepted

## 3. Email: timeout, notice after commit, case-consistent lock

- [x] 3.1 Add `EMAIL_TIMEOUT` (env-overridable, default 10) to `settings.py`
- [x] 3.2 Schedule `_notify_email_changed` via `transaction.on_commit` + `_in_background` with plain captured values (no ORM in the thread)
- [x] 3.3 Change the advisory lock in `_email_taken_under_lock` to `hashtext(upper(%s))`
- [x] 3.4 Tests: a mail backend that blocks (event-gated fake backend) doesn't delay the profile response, and other sessions are revoked plus fresh tokens returned for an email+password change; a raising backend still logs and succeeds (update existing test for the background send); the lock SQL uses `upper` and two `ß`/`SS` registrations that `iexact` treats as equal end with exactly one account (or assert the shared lock key if `iexact` doesn't fold them equal on the test DB's collation, and say so in the test)

## 4. Input bounds

- [x] 4.1 Add `min_value=0, max_value=10` to every `voteAverage` `FiniteFloatField` in `serializers.py` (watchlist, watched, list items, bulk); null/missing still allowed where it is today
- [x] 4.2 `stats_views.py`: keep only `0 < v <= 10` in the average TMDB score; grep other `vote_average` arithmetic (recommendations, genre stats) and guard any that a huge value could break
- [x] 4.3 Episode progress: remove `PATCH` from `episode_progress`'s `@api_view`, remove `default=1` from `EpisodeProgressInputSerializer`, and check the bulk path's serializer still accepts restore data
- [x] 4.4 `list_items_create` / `list_items_bulk`: catch `IntegrityError` around the write (the whole `bulk_import` call for bulk), return 404 if the list no longer exists for this user, else re-raise
- [x] 4.5 Tests: `voteAverage` 1e27 and -3 rejected with 400 naming the field (single add and bulk entry, nothing imported); a stored 1e27 row leaves `/api/stats/` 200 and out of the average; episode `POST {"episode": 5}` → 400 naming `season` with progress unchanged, `PATCH` → 405; a list deleted mid-add (simulate by deleting the list inside the write via a patched hook) → 404, never 500

## 5. Avatar hardening

- [x] 5.1 Add `AVATAR_MAX_PIXELS = 16_000_000`, checked from the header in the existing `Image.open`/`verify()` block, with its own "too large" 400 (decoder-limit case keeps "File is not a valid image.")
- [x] 5.2 `_reencode_avatar`: JPEG `draft()`, then `thumbnail((1024, 1024))` before `exif_transpose`; confirm EXIF orientation is still applied after the thumbnail
- [x] 5.3 POST and DELETE take `old_name` from a `select_for_update()` re-read of the profile inside the `atomic()` block; decode/re-encode stays outside the lock
- [x] 5.4 Tests: 9400×9400 single-colour PNG → 400 "too large", avatar unchanged; 4000×3000 JPEG → stored 1024×768; 400×400 PNG unchanged; a rotated-EXIF JPEG over 1024 px is stored upright and downscaled; two concurrent uploads (threads, `transaction=True`) leave exactly one avatar file in storage and it is the profile's

## 6. Followed-people recommendations throttle

- [x] 6.1 Add `FollowedRecsThrottle(UserRateThrottle)` (scope `followed_recs`, `30/min`) on `followed_people_recommendations`
- [x] 6.2 Tests: calls over the limit get 429 and make no TMDB request (patched client asserts not called); a second user is unaffected

## 7. Docs and verification

- [x] 7.1 `CLAUDE.md`: per-endpoint throttle bullet mentions `password_reset_confirm` and `followed_recs`; note that the per-username failure counter is the `LoginFailure` table shared by login, profile password checks and account delete
- [x] 7.2 `docs/ARCHITECTURE.md`: why the failure counter is a table with an upsert, not the cache (DatabaseCache `incr` semantics, culling, LocMem tests hiding it)
- [x] 7.3 `CHANGELOG.md` entry; `docs/BUG_BACKLOG.md` item 30 status → proposed/archived as appropriate, moving the backfill-budget bypass to item 28 and the same-day notification to item 29 as the proposal says
- [x] 7.4 Run backend checks: `pytest` (full backend suite), `ruff check backend/`, `makemigrations --check --dry-run` with `DEBUG=True`; no frontend or e2e change expected, so confirm `src/` is untouched rather than running the e2e suites
