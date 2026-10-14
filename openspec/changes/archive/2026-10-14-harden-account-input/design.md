## Context

See proposal.md for the why. The constraints that shape the approach:

- The per-username login counter lives in the `default` cache (`auth_views.py` `_record_login_failure`: `cache.add` + `cache.incr`). In production that is `DatabaseCache`, whose inherited `BaseCache.incr` is a non-atomic `get` + `set` that resets the expiry to the 300 s default. Under `DEBUG` it is `LocMemCache`, whose `incr` keeps the expiry under a lock, so every existing test passes against semantics production doesn't have. `default` is also culled at `MAX_ENTRIES`, so counters can be evicted (backlog item 27's attack path).
- The project runs on PostgreSQL only (`insert_ignoring_conflicts`, the email advisory lock), so PostgreSQL-specific SQL is acceptable.
- `UserProfileUpdateSerializer._require_current_password` checks the password inside `is_valid()`. The view can't see whether a `400` came from a wrong password or from another field without help.
- Django creates foreign keys `DEFERRABLE INITIALLY DEFERRED`, so an insert into a list that was just deleted fails with `IntegrityError` at commit: at the end of `bulk_import()`'s `atomic()` block, or at the statement in autocommit (`get_or_create`).
- `_in_background` threads must not touch the DB or the cache (CLAUDE.md, worker-thread rule). `send_mail` touches neither.

## Goals / Non-Goals

**Goals:**
- One failure counter that is atomic, keeps a fixed window from the first failure, and behaves the same under `DEBUG` and in production, so the tests exercise the real code path.
- Every password check an authenticated session can drive (profile, delete account) goes through the same counter as login.
- Bound every input that today reaches arithmetic or decoding unchecked (`voteAverage`, avatar pixels).

**Non-Goals:**
- Changing the limit values themselves (20 failures / 1 hour stay in `settings.py`).
- A general rate-limit framework, or moving DRF's throttle counters off the cache (item 27 owns cache sizing).
- Cleaning up stored out-of-range `vote_average` rows with a data migration. Reads tolerate them instead (see Decisions).
- Frontend changes. The client already sends `POST` with both episode fields and TMDB scores within 0–10.

## Decisions

### 1. Login failures move to a small table with an atomic upsert
New model `LoginFailure(key CharField(64, primary_key) /* sha256 of the folded username */, count PositiveIntegerField, window_start DateTimeField(db_index=True))`, migration `0025`. The key stays the existing `_login_failure_key()` hash, so raw usernames are still never stored.

Recording a failure is one statement:

```sql
INSERT INTO userdata_loginfailure (key, count, window_start) VALUES (%s, 1, now())
ON CONFLICT (key) DO UPDATE SET
  count        = CASE WHEN loginfailure.window_start <= now() - %s THEN 1 ELSE loginfailure.count + 1 END,
  window_start = CASE WHEN loginfailure.window_start <= now() - %s THEN now() ELSE loginfailure.window_start END
```

PostgreSQL serializes concurrent upserts on the same key through the row lock, so a parallel burst counts every failure, and later failures never move `window_start`. Reading the count (`_login_failures(key)`) is a `SELECT count ... WHERE key = %s AND window_start > now() - window`, so an expired row reads as 0 with no cleanup needed for correctness. Recording also deletes rows whose window has passed (`DELETE ... WHERE window_start <= now() - window`, served by the index), which keeps the table at about the number of usernames under attack in the last hour. The DB clock (`now()`) is the one clock for both the write and the read, so worker clock skew doesn't matter. `Retry-After` becomes the window's real remaining seconds, not a fixed 3600.

The functions keep their names and signatures (`_login_failure_key`, `_login_failures`, `_record_login_failure`), plus a new `_clear_login_failures(key)`, so call sites barely change.

*Alternatives:* keeping the cache and storing `(count, first_ts)` with `set(..., remaining)` fixes the expiry but not the race (still get + set) and not culling. `F()` + `update_or_create` takes two statements and needs a retry on the create race. A `cache.incr` override on a custom `DatabaseCache` subclass would touch every cache user. The upsert is one round trip and race-free.

### 2. Password-gated actions share the counter
- `delete_account`: before checking the password, return the same `429` login does when `_login_failures(key(request.user.username)) >= LOGIN_FAILURE_LIMIT`. A wrong password calls `_record_login_failure`.
- `profile` PATCH: the limit is checked only when the request body contains `current_password` (a name-only edit stays unaffected, per spec). The serializer records the outcome instead of the view guessing it from the error dict: `_require_current_password` sets `self.password_rejected = True` before raising "Incorrect password.", and the view records a failure when `is_valid()` is false and the flag is set. The view calls `is_valid()` without `raise_exception` for that, then raises `ValidationError(serializer.errors)` itself, so the response body is unchanged.
- A shared helper `_login_limited_response(key)` builds the `429` (detail text + `Retry-After`) for login, delete and profile, so the three can't drift apart.
- The key is the account's current username. A rename in the same PATCH doesn't escape it, because the check runs before the save.

*Alternative:* a separate `UserRateThrottle` scope on these two views (the backlog's first suggestion). Rejected as the only control: it limits per user id, not per username, so login guessing and session guessing would get two separate budgets. One shared counter makes 20/hour the total across every path.

### 3. Reset clears the counter; confirm gets its own throttle scope
`password_reset_confirm` calls `_clear_login_failures(_login_failure_key(user.username))` after `set_password`. New `PasswordResetConfirmThrottle(AnonRateThrottle)` with scope `password_reset_confirm`, rate `10/hour` in `DEFAULT_THROTTLE_RATES`. `password_reset_request` keeps `PasswordResetThrottle` (`5/hour`). 10/hour leaves room for a user retyping a rejected password several times without making the confirm endpoint a token-guessing oracle (the token itself is unguessable anyway).

### 4. `voteAverage` is bounded at the serializer; Stats filters at read
Every `voteAverage` field (`serializers.py` lines 159, 170, 226, 272) gets `min_value=0, max_value=10` on the existing `FiniteFloatField`. Already stored rows are tolerated on read instead of migrated: `stats_views.py` keeps only `0 < v <= 10` for `avg_tmdb_rating` (it already drops `<= 0`). A data migration was rejected because no real client ever stored such a value (only crafted imports did) and a read-side guard also protects against any future path that skips the serializer. The implementation pass greps every other read of `vote_average` that does arithmetic (recommendations scoring, genre stats) and applies the same filter where a huge value could raise.

### 5. Avatar: header pixel cap, then a bounded decode
`AVATAR_MAX_PIXELS = 16_000_000` is checked from the header in the existing `Image.open` + `verify()` block, next to the `MAX_IMAGE_PIXELS` check, with its own `400` message ("Image is too large. Use one under 16 megapixels."). The decoder-limit case keeps "File is not a valid image." (spec scenario). In `_reencode_avatar`, `img.draft()` is applied for JPEG (decode at reduced scale when possible), then `img.thumbnail((1024, 1024))` before `exif_transpose`, so the transpose copy is of the small image. `thumbnail` keeps the aspect ratio and never upscales, which gives the spec's 4000×3000 → 1024×768 and leaves 400×400 alone. EXIF orientation is still read from the original's metadata (`exif_transpose` uses `img.getexif()`, which `thumbnail` preserves).

16 MP covers every current phone camera's default output and keeps the worst-case RGBA decode around 64 MB.

### 6. Concurrent avatar replace: row lock around read-old + save
The POST path re-reads the profile with `Profile.objects.select_for_update().get(pk=profile.pk)` inside the `atomic()` block, and takes `old_name` from that locked row. The second upload then waits, sees the first's new file as its `old_name`, and schedules it for deletion on commit. The CPU-heavy decode and re-encode stay outside the lock. DELETE gets the same lock. The existing cleanup of an uncommitted new file on error stays.

### 7. Mail: timeout everywhere, email-change notice after commit
`EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))` in `settings.py`. Django's SMTP backend applies it to connect and to every socket operation, so the reset-mail threads also end. In `profile`, `_notify_email_changed` is scheduled with `transaction.on_commit(lambda: _in_background(send))` from inside the `atomic()` block that saves the user, with the username, pk and old address captured as plain values, so the thread never touches the ORM. Token revocation and reissue then run before any mail I/O.

### 8. Episode progress: `POST` only, both fields required
Drop `"PATCH"` from `@api_view` (DRF returns `405`) and remove `default=1` from both `EpisodeProgressInputSerializer` fields, so they are required. `episode_progress_bulk` uses its own entry serializer and is unaffected. Check before changing: if the bulk path reuses `EpisodeProgressInputSerializer`, give it the required fields too, since restore data always has both.

### 9. List deleted mid-add → `404`
`list_items_create` and `list_items_bulk` catch `IntegrityError` around the write. If `UserList.objects.filter(pk=list_pk, user=request.user).exists()` is now false, they return `404`; otherwise they re-raise (a real integrity bug must still surface). Because FKs are deferred, the catch for the bulk path wraps the whole `bulk_import(...)` call, whose `atomic()` commit is where the error appears. A `select_for_update()` on the list was the alternative. It works for the single add but would need threading into `bulk_import()`'s transaction, and it makes a list delete wait on large imports.

### 10. Email advisory lock folds with `upper`
`_email_taken_under_lock` changes `hashtext(lower(%s))` to `hashtext(upper(%s))`, matching Django's `email__iexact` (`UPPER(...) = UPPER(...)` on PostgreSQL). Two addresses the check treats as equal now always take the same lock.

### 11. Followed-people recommendations throttle
`FollowedRecsThrottle(UserRateThrottle)`, scope `followed_recs`, `30/min`, on `followed_people_recommendations`. The frontend calls it once per Recommendations/Following page load, so 30/min is far above real use. DRF throttles run before the view body, so a throttled call makes no TMDB request.

## Risks / Trade-offs

- [The login path now writes to the DB on every failure] → One indexed upsert plus an indexed delete. The per-IP `LoginThrottle` (10/min) still caps how often one client can reach it.
- [Locking out an account by guessing its username now also blocks profile password changes and account deletion for an hour] → Intended (the spec's "stolen session" scenario), and a password reset clears it. Name/email-free edits keep working.
- [`now()` inside one transaction is the transaction start time] → The login path runs in autocommit, so each statement gets its own `now()`. Tests that fake time do it by updating `window_start` directly, not by mocking Python's clock.
- [The new tests need a real PostgreSQL and real concurrency] → The parallel-burst test uses `pytest.mark.django_db(transaction=True)` and threads, each with its own connection, closed in the test's teardown.
- [Downscaling changes the stored resolution of existing large uploads only on their next upload] → Existing files are left as they are. None can be over the 5 MB / decoder cap anyway.
- [Existing out-of-range `vote_average` rows stay in the table] → Read paths filter them (Decision 4), and they can be removed by the user re-importing.

## Migration Plan

1. Migration `0025_loginfailure` adds the table. It is additive, and it runs through the normal `start.py` / `docker-entrypoint.sh` flow. Generate it with the project's Conda interpreter (so the header says Django 5.2), with `DEBUG=True`.
2. Counters already in the cache are abandoned on deploy, so any username currently limited is unlocked once. That's acceptable: the cache-backed limit was already lapsing after 5 minutes.
3. Rollback: revert the code. The extra table is harmless and can be dropped by migrating back to `0024`.
