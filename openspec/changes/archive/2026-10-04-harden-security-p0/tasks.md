## 1. Error disclosure

- [x] 1.1 Add `userdata/logging.py` `RedactingFormatter` (replaces the non-empty `settings.TMDB_API_KEY` in the formatted message + traceback with `***`), and wire it into `settings.LOGGING`'s console handler
- [x] 1.2 `tmdb_views.py`: replace both `{"error": str(e)}` responses with a generic message and add `logger.warning(...)` with the exception
- [x] 1.3 `tmdb_views.tmdb_request_token`: build the TMDB URL with `urlencode({"redirect_to": redirect_to})`
- [x] 1.4 Tests (`tests/test_tmdb_auth.py`, new): failing create-session response body has no `api_key`/key value/TMDB URL; captured log output has no key value; `redirect_to` containing `&foo=bar` stays one encoded parameter

## 2. Avatar uploads

- [x] 2.1 `auth_views.avatar`: decode with PIL, map `img.format` → `jpg|png|webp`, reject other formats with the existing "Unsupported image type…" message, and set `file.name = f"avatar.{ext}"` before saving
- [x] 2.2 `models.avatar_upload_path`: whitelist the extension (`jpg|png|webp`) and raise on anything else
- [x] 2.3 Hand-write a data migration that renames or clears existing avatars with non-image extensions (design D3); reverse = no-op
- [x] 2.4 Extend `tests/test_avatar.py`: PNG named `x.html` → stored `.png`; GIF declared `image/jpeg` → 400; served avatar URL content type starts with `image/`; migration handles a fake `.html` avatar (valid image → renamed, invalid → cleared)

## 3. Account security

- [x] 3.1 `UserProfileUpdateSerializer`: add case-insensitive `validate_email` (exclude self) and require + verify `current_password` when the email actually changes (shared helper with the `new_password` branch)
- [x] 3.2 `profile` view: after save, if the email changed, send the old-address notification (best-effort, broad except with the existing rationale comment)
- [x] 3.3 `settings.PASSWORD_RESET_TIMEOUT = 3600`; build the reset email's "expires in" sentence from that setting
- [x] 3.4 `ProfileModal.tsx`: keep `current_password` in the payload when the email differs case-insensitively from `user.email`; update the field's help text
- [x] 3.5 Tests: email change without/with wrong/with correct password; case-only resubmission needs no password; duplicate email (different case) rejected; notification sent to the old address (locmem mail outbox) and a mail failure doesn't fail the update; reset token older than 1h rejected (freeze/patch time)

## 4. Throttling

- [x] 4.1 `settings.REST_FRAMEWORK["NUM_PROXIES"]` from `TRUSTED_PROXY_COUNT` (default 0); set `TRUSTED_PROXY_COUNT: "1"` for the backend service in `docker-compose.yml`
- [x] 4.2 `CACHES`: `DatabaseCache` (`cinedb_cache`) when not DEBUG, LocMem otherwise
- [x] 4.3 Add `createcachetable` after `migrate` in `backend/docker-entrypoint.sh` and `backend/start.py`
- [x] 4.4 Tests: with `NUM_PROXIES=0`, rotating spoofed XFF values still hits 429 on login; with `NUM_PROXIES=1`, two different rightmost XFF addresses get separate allowances

## 5. Fail-closed configuration

- [x] 5.1 `settings.py`: `DEBUG` default `"False"`; when not DEBUG, raise `ImproperlyConfigured` on empty or wildcard `ALLOWED_HOSTS`
- [x] 5.2 `start.py`: `os.environ.setdefault("DEBUG", "True")` before any subprocess
- [x] 5.3 Update `.env.example` and `backend/.env.example`: document `DEBUG`, `ALLOWED_HOSTS` (must include `localhost` for the compose healthcheck), `TRUSTED_PROXY_COUNT`; remove the stale `DJANGO_API_URL`/Express references while there
- [x] 5.4 Test: importing settings with DEBUG off and `ALLOWED_HOSTS=*` raises (subprocess or `importlib.reload` with patched env)
- [x] 5.5 Tell the user to update their untracked `.env.docker` (`ALLOWED_HOSTS=localhost,<host>`, `TRUSTED_PROXY_COUNT=1`). Don't edit it without asking

## 6. Verification and docs

- [x] 6.1 Backend `pytest` + `ruff` pass; `npx tsc --noEmit` passes
- [x] 6.2 `npm run dev` still boots and is reachable from a LAN IP; `docker compose up` becomes healthy with the updated env, and the TMDB connect flow still works end to end
  - Note (2026-10-04): verified `npm run dev` boots, and backend health + frontend return 200 via the machine's LAN IP. TMDB connect checked over LAN with a throwaway account (since deleted): `status` ok, `request-token` returns an authenticate URL with `redirect_to` encoded as one param, bad `create-session` → generic 502, server log shows `api_key=***` (raw key 0 occurrences). NOT verified: `docker compose up` health (no Docker on dev machine) and the manual TMDB "Approve" click. Separately, intermittent TMDB 502s turned out to be network-level TLS resets to `api.themoviedb.org`, unrelated to this change; mitigated outside this change by defaulting to `api.tmdb.org` (`TMDB_API_HOST`) and raising proxy retries to 4.
- [x] 6.3 Update CLAUDE.md's `ALLOWED_HOSTS` bullet and add `docs/ARCHITECTURE.md` bullets (redacting formatter, avatar type-from-content, `TRUSTED_PROXY_COUNT`, DatabaseCache for throttles, fail-closed settings); README note about the breaking env change
