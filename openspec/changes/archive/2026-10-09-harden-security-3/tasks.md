## 1. TMDB connect binding and session hygiene

- [x] 1.1 `tmdb_views.tmdb_request_token`: on success, `cache.set(f"tmdb_req_token:{user.id}", token, 3600)`.
- [x] 1.2 `tmdb_views.tmdb_create_session`: read and delete the cached token, compare it with `hmac.compare_digest`, and return `400` with a "start the connection again from your profile" message on a mismatch or missing key, before any TMDB call.
- [x] 1.3 In the same view, after a successful exchange, revoke the previous non-empty, different `session_id` via `tmdb_client.revoke_tmdb_session` before saving the new one.
- [x] 1.4 `TMDBCallbackPage.tsx`: show `getApiError(err, <current fallback>)` on failure so the server's start-again message reaches the user.
- [x] 1.5 Tests in `test_tmdb_auth.py`: normal connect; a token issued to another user → 400 and the session is unchanged; replay → 400; expired (cache TTL elapsed/cleared) → 400; reconnect revokes the old session; a failed revoke doesn't block the reconnect.

## 2. Credential-safe logging

- [x] 2.1 `logging.RedactingFormatter`: also replace `session_id=…` / `request_token=…` query values and `"session_id": "…"` JSON values with `***`.
- [x] 2.2 `ratings_views._sync_rating_to_tmdb` and the delete-sync path: return silently on `TMDBProfile.DoesNotExist`, and log `RequestException`/`ValueError` at warning with the exception type only (no traceback).
- [x] 2.3 Tests in `test_logging.py` / `test_ratings.py`: an HTTPError message with `session_id=SECRET` is redacted; a proxy failure with a `session_id` param is redacted; a rating by a user with no TMDB link logs nothing at warning or above; a sync failure logs one warning without the session id.

## 3. Metadata backfill bounds and persisted settled state

- [x] 3.1 Add `WatchedEntry.metadata_settled = BooleanField(default=False)` and generate migration 0022 with the Django env interpreter. Add a `RunPython` step that sets it for `genre_ids=[]`, `original_language="??"`, `release_year=-1` rows (reverse: no-op).
- [x] 3.2 `metadata_backfill.py`:
  - `_store` writes `metadata_settled`.
  - `entry_needs_metadata` uses the field.
  - Delete `_settled`.
  - Update the module docstring.
- [x] 3.3 Add `MAX_PER_RUN = 100`. `backfill_entries` sorts its candidates newest first (`-watched_at`, `-id`) and fetches at most that many per call.
- [x] 3.4 Bound `_failed_at`: on insert above 10,000 keys, drop expired entries, then the oldest.
- [x] 3.5 Tests in `test_metadata_backfill.py`:
  - 500 unknown ids → ≤100 TMDB calls per run.
  - 250 titles fill across 3 runs.
  - A settled entry isn't fetched again after the in-process state is cleared, simulating a restart.
  - The migration data step marks sentinel rows.
  - `_failed_at` stays ≤ the bound.
- [x] 3.6 Run `makemigrations --check --dry-run` (clean after 0022) and `ruff check backend/`.

## 4. Input length limits

- [x] 4.1 `serializers.py`: `max_length=5000` on the review field of `RatingEntrySerializer` and `BulkRatingEntrySerializer`, and `max_length=200` on `UserListSerializer.description`.
- [x] 4.2 `watchlist/RatingModal.tsx`: `maxLength={5000} showCount` on the review `TextArea`.
- [x] 4.3 Tests in `test_input_validation.py`: a 5001-char review on POST and on bulk → 400 naming `review`, with nothing stored; a 201-char description on create/edit → 400; 5000/200 accepted; an existing over-long row still reads.

## 5. Login, reset email and production email config

- [x] 5.1 `settings.py`: add `LOGIN_FAILURE_LIMIT = 20` and `LOGIN_FAILURE_WINDOW_SECONDS = 3600`.
- [x] 5.2 `auth_views.login`: implement the per-username failure counter (cache key `login_fail:<sha256(lowercased, stripped username)>`), check it before `authenticate`, return `429` with `detail` + `Retry-After`, and increment on failure.
- [x] 5.3 `auth_views.password_reset_request`: send the mail from a daemon thread (no DB or cache in the thread), and keep the existing broad except and log line inside it.
- [x] 5.4 `settings.py`: with `DEBUG` off and no `EMAIL_BACKEND` env var, raise `ImproperlyConfigured` naming `EMAIL_BACKEND`. Keep the console default under `DEBUG`.
- [x] 5.5 Tests:
  - `test_throttle_identity.py`/`test_auth.py`: 20 failures from different IPs → the 21st, with the correct password, gets 429; other usernames are unaffected; the limit clears after the window (use a small test window).
  - A reset request returns without waiting for a slow mail backend (patch `send_mail` to sleep, and assert the response is fast and the mail is eventually sent).
  - `test_settings_fail_closed.py`: no `EMAIL_BACKEND` with debug off → error; explicit console → starts.

## 6. Avatar re-encoding

- [x] 6.1 `auth_views` avatar upload: after the existing checks, reopen, apply `ImageOps.exif_transpose`, and re-save in the decoded format with no EXIF (keep the ICC profile). Store that as `avatar.<ext>`.
- [x] 6.2 Tests in `test_avatar.py`: a JPEG with GPS EXIF → the stored file has no EXIF; an orientation-6 JPEG → the stored dimensions are swapped and there's no orientation tag; PNG and WebP still upload; the existing polyglot/format tests still pass.

## 7. nginx access-log redaction

- [x] 7.1 `nginx.conf`: add `map $request_uri $log_request_uri`, `map $http_referer $log_referer`, `log_format redacted …`, and a server-level `access_log /var/log/nginx/access.log redacted;`. Add no `add_header` in any location.
- [x] 7.2 `test_nginx_conf.py`: assert that the log format uses the mapped variables, that both maps redact `/reset-password/` and `/tmdb-callback`, and that `access_log` uses `redacted`.

## 8. Backup ZIP size guard

- [x] 8.1 `backup.ts`: export a helper that sums declared uncompressed sizes (typed access to `_data.uncompressedSize`, treating missing as 0) and a `checkBackupSize(file, zip)` that throws a too-large error at the limits (file > 50 MB, entry > 50 MB, total > 200 MB).
- [x] 8.2 `CSVImportAllModal.tsx`: check `file.size` before `loadAsync`, call the size check before `readBackupZip`, and show the too-large message.
- [x] 8.3 Jest test (`backup.test.ts`): a generated ZIP whose entry exceeds the limit is rejected before any `async()` read; a normal backup passes; the helper reads real sizes from the installed JSZip.

## 9. Docs and bookkeeping

- [x] 9.1 `docs/ARCHITECTURE.md`: record the TMDB token binding, the accepted registration email/username enumeration, the login-lockout trade-off, and the persisted `metadata_settled`.
- [x] 9.2 `backend/.env.example` and README env table: add `EMAIL_BACKEND` (required in production).
- [x] 9.3 CLAUDE.md: note in the relevant bullets that `RedactingFormatter` also strips `session_id`/`request_token`, that backfill "settled" lives in `WatchedEntry.metadata_settled`, and that nginx logs through the `redacted` format.
- [x] 9.4 `docs/BUG_BACKLOG.md`: mark item 22 📝 now, and on archive ✅ with the archive path. Note that 17's `session_id` and log-spam bullets moved here.

## 10. Verify

- [x] 10.1 Backend: `pytest` (full backend suite) with the Django env interpreter; `ruff check backend/`; `makemigrations --check --dry-run`.
- [x] 10.2 Frontend: `npm run typecheck`; `npm run lint`; Jest for `backup`, `RatingModal` and any touched tests.
- [x] 10.3 e2e only if needed: run `e2e/python/test_auth.py`/`e2e/auth.spec.ts` only if the login or TMDB callback UI flow changed beyond the error text. No other e2e.
