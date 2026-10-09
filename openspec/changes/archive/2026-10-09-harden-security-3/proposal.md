## Why

The 2026-10-09 audits (backlog item 22, plus two log items from 17) found ways an attacker can misuse the app that earlier hardening missed. The worst is that anyone can bind a victim's account to the attacker's TMDB account with one link. After that, every rating the victim makes is sent to an account the attacker can read. Next worst: fake-id imports turn one request into hundreds of server-side TMDB calls and in-memory state that never shrinks, and credentials (TMDB session ids, password-reset tokens) end up in server logs.

## What Changes

- **TMDB connect is bound to the user who started it.** The server remembers the request token it issued to each user. Creating a session accepts only that token, only once, and only within its lifetime. A forged callback link gets a clear error. Reconnecting revokes the previous TMDB session before storing the new one.
- **TMDB credentials never reach logs.**
  - Log redaction now also hides `session_id` and `request_token` values.
  - Rating sync logs only the exception type.
  - A user with no TMDB link no longer produces an ERROR traceback on every rating. That case isn't an error, so nothing is logged.
- **Metadata backfill is bounded and its "settled" state persists.**
  - Each backfill run fetches at most a fixed number of titles.
  - The "TMDB says this title doesn't exist" result is stored on the watched entry, so restarts and other workers don't refetch it. This fixes the `title-metadata` spec violation.
  - The in-memory failure-backoff map is size-bounded.
- **Reviews and list descriptions have length limits:** 5000 and 200 characters, on single and bulk writes. The rating dialog shows the review limit.
- **Password-reset tokens stay out of access logs.** nginx logs a redacted path and referer for `/reset-password/…` and `/tmdb-callback?…`. With debug off, the backend refuses to start unless `EMAIL_BACKEND` is set explicitly, so a production deploy can't silently print reset links to stdout.
- **Reset email timing doesn't reveal registered emails.** The reset email is sent off the request thread, so known and unknown emails respond in about the same time. The registration "email already exists" message stays. It is accepted and documented, the same as for usernames.
- **Per-username login failure limit.** After 20 failed logins for one username within an hour, further attempts for that username get `429` from any IP until the window passes. The existing per-IP limit stays.
- **Avatars are re-encoded on upload,** which drops EXIF (GPS, camera serial) while keeping the right orientation.
- **The backup import refuses oversized ZIPs** (the file itself or any entry's uncompressed size) before decompressing them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-security`:
  - TMDB connect is bound to the requesting user and single-use.
  - Reconnecting revokes the previous session.
  - Per-username login failure limit.
  - Reset-request timing doesn't depend on whether the email is registered.
- `api-hardening`:
  - Log redaction covers TMDB session ids and request tokens.
  - Production fails closed without an explicit email backend.
- `title-metadata`:
  - Backfill runs are capped.
  - The not-found state persists across restarts and workers.
- `input-validation`: reviews and list descriptions have length limits.
- `avatar-upload`: stored avatars carry no embedded metadata.
- `container-deployment`: access logs don't record password-reset tokens or TMDB request tokens.
- `data-backup`: oversized backup files are rejected before decompression.

## Impact

- **Backend:**
  - `tmdb_views.py`, `tmdb_client.py`, `ratings_views.py`, `logging.py`
  - `metadata_backfill.py`, `models.py` (new `WatchedEntry.metadata_settled` field with migration 0022 and a data backfill for already-settled rows)
  - `serializers.py`, `auth_views.py` (login limit, reset mail, avatar re-encode), `settings.py` (email fail-closed, login-failure settings)
- **Frontend:**
  - `TMDBCallbackPage.tsx` (show the server's reason)
  - `watchlist/RatingModal.tsx` (review `maxLength`)
  - `utils/backup.ts` / `lists/CSVImportAllModal.tsx` (ZIP size caps)
- **Infra:** `nginx.conf` (`log_format` with redacted URI and referer).
- **Docs:** `docs/ARCHITECTURE.md` (accepted email/username enumeration, the login lockout trade-off), `backend/.env.example` / README (`EMAIL_BACKEND` now required in production), and `docs/BUG_BACKLOG.md` (items 22 and 17).
- **Deploy:** `.env.docker` already sets `EMAIL_BACKEND`, so the existing deploy keeps starting. Users with a TMDB connect still in progress across the deploy must click Connect again.
