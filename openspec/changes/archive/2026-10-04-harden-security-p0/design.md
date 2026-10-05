## Context

- `tmdb_views.tmdb_request_token` / `tmdb_create_session` return `{"error": str(e)}`. `tmdb_client._get/_post` call `raise_for_status()`, and `requests.HTTPError`'s message embeds the full URL, including `?api_key=<TMDB_API_KEY>`. The same text reaches logs through several `logger.exception(...)`/`logger.warning("...%s", e)` calls (`tmdb_proxy_views.py:40`, `recommendations.py:63,462`, `stats_views.py:101`).
- `models.avatar_upload_path` takes the extension from the client filename. `auth_views.avatar` checks only `file.content_type` (client-declared) plus `Image.open(file).verify()`, which accepts image/HTML polyglots. `cinedb/urls.py` serves `/media/` through `django.views.static.serve` in all modes, and its content type is guessed from the extension. So `user_1.html` is served as `text/html` on the app origin. (nosniff doesn't help: it blocks sniffing *away from* the declared type, and here the declared type is HTML.)
- `UserProfileUpdateSerializer` gates only `new_password` on `current_password`. `email` is a bare `EmailField` with no uniqueness check, while `RegisterSerializer.validate_email` does check uniqueness. `ProfileModal.handleSubmit` always sends the full form (including the unchanged email) and deletes `current_password` unless `new_password` is set.
- `settings.py`: `DEBUG` defaults `"True"`; `ALLOWED_HOSTS` appends `"*"` only in DEBUG, but nothing stops `ALLOWED_HOSTS=*` coming from env with DEBUG off. No `PASSWORD_RESET_TIMEOUT` (Django default 259200s = 3 days). No `NUM_PROXIES`. No `CACHES` (LocMem, per process), and gunicorn runs `--workers 3`.
- nginx forwards `X-Forwarded-For: $proxy_add_x_forwarded_for` (client-supplied value + real address appended last). With `NUM_PROXIES` unset, DRF's `get_ident` uses the *whole* XFF string as the throttle key, so every made-up header value is a fresh bucket.
- Local dev: `backend/.env` has no `DEBUG` key and relies on the default. CI sets `DEBUG: "True"` explicitly.

## Goals / Non-Goals

**Goals:**
- Each fix enforced server-side and covered by a test that reproduces the original exploit.
- `npm run dev` and CI keep working with no manual env edits.

**Non-Goals:**
- Moving JWTs to httpOnly cookies, adding a CSP, HSTS, or `SECURE_PROXY_SSL_HEADER`. Real hardening, but deploy-topology work beyond this change.
- Serving media from a separate cookieless origin/CDN.
- Switching TMDB auth from the v3 `api_key` query param to a v4 bearer header (would remove the URL leak at the source, but touches every TMDB call site and the proxy).
- Revoking existing sessions on credential change (that's `fix-session-lifecycle`).

## Decisions

### D1. Generic 502 + redacting log formatter
`tmdb_views` returns `{"error": "Couldn't reach TMDB. Try again."}` and logs through `logger.warning(...)`. For logs app-wide, add a `RedactingFormatter` (in `userdata/logging.py`), wired as the console handler's formatter in `settings.LOGGING`. It formats the record (message + exception traceback) and replaces the `TMDB_API_KEY` value (when non-empty) with `***`. Rejected: redacting at each call site. There are already 5+ sites, and a new `logger.exception` would silently reintroduce the leak. `redirect_to` is encoded with `urllib.parse.urlencode({"redirect_to": ...})`.

### D2. Avatar extension from `Image.format`, with re-encode rejected
Open with PIL, read `img.format`, map `{"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}`, reject anything else (and keep the existing size/`verify()` checks). Set `file.name = f"avatar.{ext}"` before assigning, so `avatar_upload_path` (unchanged signature) derives the safe extension. `avatar_upload_path` also stops trusting the incoming name: it whitelists the extension and falls back to raising if it's not one of the three, as defense in depth.

Rejected: re-encoding every upload through PIL. That strips polyglot payloads entirely, but loses animation/ICC data, changes file size/quality, and is unnecessary once the served type is guaranteed to be an image.

### D3. Legacy avatar cleanup as a data migration
A hand-written `RunPython` migration in `userdata/migrations/` goes through `Profile` rows that have an avatar. If the stored extension isn't jpg/png/webp, it decodes the file. If the file is JPEG/PNG/WebP it renames it to the correct extension and updates the field. Otherwise (or if the file is missing) it deletes the file and clears the field. Reverse is a no-op. A migration rather than a management command, because the existing boot flow (`start.py`/entrypoint → `migrate`) guarantees it runs exactly once everywhere. That respects CLAUDE.md's "generate migrations explicitly" rule, since this one is written by hand and committed.

### D4. Email change gated in the serializer
In `UserProfileUpdateSerializer`, add `validate_email` (case-insensitive uniqueness excluding self, same message as registration). Extend `validate` so that when `email` is present and `email.lower() != user.email.lower()`, `current_password` is required and checked, the same way the `new_password` branch does it (shared helper). The `profile` view, after `save()`, sends the old-address notification when the email changed, using the existing `send_mail` broad-except convention (same rationale as `password_reset_request`).

Frontend: `ProfileModal` keeps `current_password` in the payload when `values.email` differs (case-insensitively) from `user.email`, and shows "Required to change email or password" on that field. No new UI elements.

### D5. `PASSWORD_RESET_TIMEOUT = 3600`
One line in settings. The email text already says 1 hour. Use a named constant in `auth_views` to build the sentence, so the two can't drift apart again.

### D6. Throttle identity: `NUM_PROXIES` from env, default 0
`REST_FRAMEWORK["NUM_PROXIES"] = int(os.environ.get("TRUSTED_PROXY_COUNT", "0"))`. With 0, DRF ignores XFF and uses `REMOTE_ADDR` (correct for `npm run dev`, which has no proxy). `docker-compose.yml` sets `TRUSTED_PROXY_COUNT: "1"` on the backend, so DRF takes the rightmost XFF entry, the one nginx appended. Rejected: hardcoding `1`. In dev with no proxy, the rightmost entry would be client-supplied, which recreates the bypass.

### D7. Shared throttle cache: `DatabaseCache` in production
When `DEBUG` is off: `CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "cinedb_cache"}}`. In DEBUG it stays LocMem (single `runserver` process, so per-process is fine). `python manage.py createcachetable` (idempotent) is added to `docker-entrypoint.sh` and `start.py` right after `migrate`. Rejected: Redis, which needs a new compose service, a client dependency, and ops overhead for a cache whose only consumer is throttling. Revisit if the cache gains heavier users.

### D8. Fail-closed settings
- `DEBUG = os.environ.get("DEBUG", "False") == "True"`.
- When not DEBUG: raise `ImproperlyConfigured` if `ALLOWED_HOSTS` is empty or contains `"*"` (in addition to the existing SECRET_KEY check).
- `start.py` sets `os.environ.setdefault("DEBUG", "True")` at the top, before spawning `manage.py` subprocesses. Local dev keeps today's behavior without touching anyone's untracked `.env`, while bare `manage.py` invocations on a server default to safe.
- `.env.example` files document `DEBUG=True` for manual local `manage.py` use, plus `ALLOWED_HOSTS` / `TRUSTED_PROXY_COUNT` for Docker. The Docker example must include `localhost` (the compose healthcheck calls `localhost:8000`) plus the public hostname.

## Risks / Trade-offs

- [**BREAKING**: existing Docker deployments with `ALLOWED_HOSTS=*` won't start] → A clear `ImproperlyConfigured` message naming the variable and what to set. Called out in the proposal and README. The maintainer's own `.env.docker` (untracked) needs a manual edit, which is listed as a task.
- [Developers running `manage.py runserver` directly without `DEBUG=True` get a startup error] → Documented in `.env.example`. `npm run dev` is unaffected.
- [DatabaseCache adds a DB write per throttled request] → Negligible at current traffic. It's the same Postgres already on every request path.
- [Data migration touches files on disk; a missing `media/` volume makes it clear avatars] → It only clears rows whose stored extension is already unsafe, and only after a decode attempt. Safe-extension rows are never touched.
- [Redacting formatter only covers handlers it's attached to] → It's attached to the only configured handler. Add a test that `logger.exception` output from a mocked failing TMDB call doesn't contain the key.

## Migration Plan

1. Update deploy env first: set `ALLOWED_HOSTS` to the real hosts (+ `localhost`) and `TRUSTED_PROXY_COUNT=1`.
2. Deploy. The entrypoint runs `migrate` (avatar cleanup), then `createcachetable`, then gunicorn.
3. Rollback: revert the code. The cache table and renamed avatar files are harmless to the old code (renamed files keep valid image extensions).
