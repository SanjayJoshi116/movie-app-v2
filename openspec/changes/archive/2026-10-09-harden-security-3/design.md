## Context

See proposal.md for motivation. The constraints that shape the approach:

- **The production cache is the shared `DatabaseCache`.** Throttles already depend on it working across all 3 gunicorn workers. Any per-user state that must hold across workers (issued TMDB tokens, login failure counts) goes there, not in module globals.
- **Workers only do HTTP** (CLAUDE.md). The new reset-mail thread may call `send_mail` but must not touch the DB or `django.core.cache`.
- **nginx config rules.** Every header lives at server level, and no `location` may declare `add_header` (`test_nginx_conf.py`). `log_format` and `map` are valid where `conf.d/default.conf` is included, because that is the `http` context.
- **The redacting log formatter is the single choke point.** Every handler, third-party ones included, formats through `RedactingFormatter` (item 9).
- **`metadata_backfill`'s `_settled` set is a per-process stand-in for a DB fact.** The `title-metadata` spec already says "SHALL NOT be fetched again", so the fact belongs in the DB.

## Goals / Non-Goals

**Goals:**
- Close the TMDB connect login-CSRF without changing what a real user sees.
- Keep every new limit on the server, with the frontend only mirroring it for UX.
- Make every bound testable through the existing pytest setup.

**Non-Goals:**
- No cap on how many items a library can hold (user decision). Only the work an import triggers is bounded.
- Registration keeps saying an email is taken (user decision). It is documented as accepted.
- No rate limit or auth on the public TMDB proxy beyond what exists. Its availability risk stays a documented design trade-off.
- No change to how TMDB ratings sync is scheduled. Moving it out of the request path is item 17.

## Decisions

### 1. Bind the TMDB request token in the cache, keyed by user
`tmdb_request_token` stores the issued token under `tmdb_req_token:<user_id>` with a 60-minute TTL, matching TMDB's own token lifetime. A new request overwrites the old one, so only the latest is valid. `tmdb_create_session` reads the key, deletes it, then compares with `hmac.compare_digest`. On a mismatch or a missing key it returns `400` with a "start again from your profile" message, before any TMDB call. The key is deleted even if TMDB then fails, so a token is single-use. A failed exchange means clicking Connect again, which is cheap.
- *Alternative:* a signed `state` parameter round-tripped through TMDB's `redirect_to`. Rejected because the token itself is already an unguessable per-flow value. Binding it server-side needs no URL changes and no secret handling.
- *Alternative:* a DB column on `TMDBProfile`. Rejected because it needs a migration for a value that lives for an hour. The cache already backs throttles in production.

### 2. Revoke the old session before storing a new one
After the exchange succeeds, if the stored `session_id` is non-empty and different from the new one, call `tmdb_client.revoke_tmdb_session` first (best-effort, logs the type only), then save. This reuses the disconnect path's helper and its logging contract.

### 3. Redact credential parameters in `RedactingFormatter`
Add a compiled regex `(session_id|request_token)=[^&\s'"]+` → `\1=***` next to the API-key replace. It runs on the fully formatted text, tracebacks included, so it covers `raise_for_status` messages, urllib3 retry warnings and proxy `logger.exception` alike. JSON bodies (`{"session_id": …}`) aren't logged anywhere today, and `revoke_tmdb_session` already logs the type only. Adding a JSON-shaped pattern is cheap, so add `"session_id":\s*"[^"]*"` as well.
- `_sync_rating_to_tmdb` and the delete path split their `except`:
  - `TMDBProfile.DoesNotExist` → return silently.
  - `requests.RequestException`/`ValueError` → `logger.warning("TMDB rating sync failed for user %s (%s)", pk, type(e).__name__)`.

  That matches `revoke_tmdb_session`'s style. Redaction stays as defense in depth.

### 4. Persist "settled" as `WatchedEntry.metadata_settled`
- **Field:** a new `BooleanField(default=False)`. `_store()` writes `metadata_settled=settled` in the same `update()`, and `entry_needs_metadata` checks the field instead of `_settled`, which is deleted.
- **Migration 0022:** adds the field and runs a `RunPython` data step that sets it for the rows the 404 path already wrote: `genre_ids == []`, `original_language == "??"` and `release_year == -1`.
- **Rows the migration leaves unset:** rows with empty genres but a real language and year, which is either "TMDB has no genres for this title" or an import that supplied language and year. They can't be told apart, so they stay unsettled and are fetched once more, then settle. That's a one-time cost, not a loop.
- *Alternative:* infer settled from the sentinel values with no new field. Rejected because a title with real language and year but no TMDB genres would refetch forever, which is the exact bug.

### 5. Cap each backfill run and bound `_failed_at`
- `MAX_PER_RUN = 100`. `backfill_entries` takes the first 100 entries that need metadata and aren't in backoff, newest first (`-watched_at, -id`), so recent watches fill first.
- `_compute_personalized`'s synchronous call gets the same cap, so a recommendations refresh can't fan out either.
- `_failed_at` is pruned on insert once it holds more than 10,000 keys. Entries older than `BACKOFF_SECONDS` are dropped first, then the oldest by timestamp. That makes worst-case memory per process about 1 MB.
- The "Library larger than one run" scenario relies on `/stats` calling `request_backfill` on each visit, which it already does.

### 6. Length limits at the serializer, not the model
Set `max_length=5000` on the review fields of `RatingEntrySerializer` and `BulkRatingEntrySerializer`, and `max_length=200` on `UserListSerializer.description`. The model `TextField`s and existing rows are unchanged, so no migration and no truncation, and existing over-long text still reads. In the frontend:
- `RatingModal`'s `TextArea` gets `maxLength={5000} showCount`.
- The list dialogs already cap descriptions at 200.
- *Alternative:* `CharField` on the model. Rejected because the migration would fail on any existing row over the limit, and the DoS comes from writes, which the serializer covers.

### 7. Per-username login failure counter in the cache
Before `authenticate`, compute `key = "login_fail:" + sha256(username.strip().lower())`. Hashing keeps raw usernames out of the cache table.
- If `cache.get(key, 0) >= 20`, return `429` with the same body shape DRF throttles use (`{"detail": …}`) and a `Retry-After` header.
- On a failed `authenticate`, `cache.add(key, 0, 3600)` then `cache.incr(key)`. The window starts at the first failure; it isn't sliding.
- A success leaves the counter alone. It would expire anyway, and resetting it on success would let an attacker who knows one password keep guessing another username.
- `DatabaseCache.incr` isn't atomic, so concurrent failures can undercount by a few. That's acceptable for a 20-attempt limit.
- The limit and window go in settings (`LOGIN_FAILURE_LIMIT`, `LOGIN_FAILURE_WINDOW_SECONDS`) so tests can shrink them.
- The frontend already maps `429` to the "too many login attempts" message, so no change is needed there.
- *Trade-off:* someone who knows a username can lock it out of password login for up to an hour. Password reset still works, and `ARCHITECTURE.md` records this.

### 8. Reset email off the request thread
Wrap `send_mail` in a daemon `threading.Thread`. Everything it needs (subject, body, address) is computed before the thread starts, so it does no DB or cache work. The existing broad `except` and its log line move into the thread target. The view returns immediately on both branches.
- *Alternative:* pad the response time with a sleep. Rejected because it ties up a sync worker for every reset request.

### 9. Fail closed on an implicit email backend
In `settings.py`, keep the console default only when `DEBUG` is true. With `DEBUG` off and `EMAIL_BACKEND` absent from the environment, raise `ImproperlyConfigured` naming `EMAIL_BACKEND`, next to the existing `ALLOWED_HOSTS`/`SECRET_KEY` checks. An explicit console value is allowed. `.env.docker` already sets the variable, so the current deploy is unaffected. `backend/.env.example` and README get the variable.

### 10. Re-encode avatars with Pillow
After the existing `verify()` and format checks:
1. reopen the upload
2. apply `ImageOps.exif_transpose`
3. `save` into a `BytesIO` in the decoded format (JPEG `quality=90`; PNG; WebP `quality=90`), passing no `exif` and keeping the ICC profile if present so colors don't shift
4. replace `file` with that `ContentFile`, named from the decoded format as today

Animated WebP is saved as its first frame. Avatars are shown as still images anyway.

### 11. nginx: a redacting `log_format`
In `nginx.conf` (http context via conf.d):
- `map $request_uri $log_request_uri`:
  - `~^/reset-password/` → `/reset-password/[redacted]`
  - `~^/tmdb-callback` → `/tmdb-callback?[redacted]`
  - default → `$request_uri`
- An equivalent `map $http_referer $log_referer`, with regexes matching the same paths after any scheme and host.
- `log_format redacted` mirrors `combined`, except it uses `$request_method $log_request_uri $server_protocol` and `$log_referer`.
- `access_log /var/log/nginx/access.log redacted;` at server level. In the official image that file is symlinked to stdout, so `docker logs` keeps working.
- `test_nginx_conf.py` asserts the `log_format`, the `access_log` directive and both map rules, and still finds no `add_header` in any location.

### 12. Client ZIP size guard
In `CSVImportAllModal`, reject `file.size > 50 MB` before `JSZip.loadAsync`. After loading the central directory (which decompresses nothing), sum each entry's declared uncompressed size. JSZip exposes it as `entry._data.uncompressedSize`, which isn't in its type definitions, so read it through a small typed helper in `backup.ts`. Reject if any entry is over 50 MB or the total is over 200 MB, before `readBackupZip` calls `async("string")`. If the size is unavailable, which doesn't happen for loaded archives, treat the entry as allowed and rely on the file-size cap.

## Risks / Trade-offs

- [The login limit lets someone lock a known username out for an hour] → Password reset still works. The limit is 20/hour, far above normal typos, and it's documented. It's tunable in settings.
- [A TMDB connect in progress during the deploy fails once] → The user clicks Connect again. The message says so.
- [The cache-backed token, if the cache table is wiped mid-flow] → Same as above: start again.
- [Re-encoding can grow a small PNG or change JPEG bytes] → The visual result is equivalent. The 5 MB check runs on the upload, not the re-encoded file. Typical avatars stay well under it.
- [`_data.uncompressedSize` is a JSZip internal] → It sits behind one helper with a safe fallback and the hard file-size cap. A unit test pins it against the installed JSZip, so an upgrade that drops it fails loudly.
- [The data migration settles only sentinel rows] → Other genre-less rows refetch once. That's bounded by the new per-run cap.
- [The reset-mail thread dies with the worker] → Same as today: a killed worker loses the mail. The user can request again.

## Migration Plan

1. Deploy the backend with migration 0022. It's additive: a boolean defaulting to false plus a data step. `docker-entrypoint.sh` applies it.
2. Rollback: the field is unused by older code. Reverting the image leaves it in place harmlessly, and `migrate userdata 0021` drops it if needed.
3. Deploy nginx with the new config. If `nginx -t` fails, the container won't start, and the previous image keeps serving.
4. Confirm the production env sets `EMAIL_BACKEND` (`.env.docker` does) before deploying, or the backend refuses to start. That's intended.
