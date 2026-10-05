## Why

The 2026-10-03 audit found several confirmed, exploitable backend weaknesses. Some leak the server's TMDB API key to any signed-in user. Others give a stored-XSS path through avatar uploads on the app's own origin, let a stolen access token become a full account takeover (change email → password reset), make every rate limit bypassable by spoofing one header, and leave production settings failing *open*. They're grouped here because each fix is small, backend-centric, and they share one theme: closing holes an attacker can reach today with a normal account or no account.

## What Changes

- **Error disclosure:** TMDB-auth endpoints stop echoing upstream exception text (which includes the request URL with `?api_key=`). Clients get a generic 502 message; server logs keep the detail with the key redacted. The TMDB `redirect_to` parameter is URL-encoded instead of interpolated raw.
- **Avatar uploads:** the stored file's extension (and so the `Content-Type` it's served with) comes from the decoded image format, never from the client's filename or declared content type. Uploads whose decoded format isn't JPEG/PNG/WebP are rejected. Existing avatars with non-image extensions are cleaned up.
- **Email change:** changing the account email requires the current password, and is rejected if another account already uses that email (case-insensitive). The previous address gets a notification of the change.
- **Password reset expiry:** reset links expire after 1 hour, matching what the email already tells users (currently Django's 3-day default).
- **Throttling integrity:** rate-limit client identity uses a configured number of trusted proxies, so a client-supplied `X-Forwarded-For` can't mint fresh throttle buckets. Throttle counters live in a cache shared by all server workers instead of per-process memory (which tripled every limit).
- **BREAKING (deploy config):** production settings fail closed. `DEBUG` defaults to off when unset, and a wildcard `ALLOWED_HOSTS` is refused when `DEBUG` is off. Deployments currently using `ALLOWED_HOSTS=*` must list their real hostnames.

## Capabilities

### New Capabilities
- `account-security`: Rules for changing account identifiers (email) and for password-reset link validity.
- `avatar-upload`: Accepting, storing, and serving user profile images safely.
- `api-hardening`: Cross-cutting backend protections: no secret or upstream-error disclosure in responses, trustworthy client identification for rate limits, rate-limit state shared across workers, and fail-closed production configuration.

### Modified Capabilities
<!-- none -->

## Impact

- Backend: `userdata/tmdb_views.py`, `userdata/tmdb_client.py` (log redaction), `userdata/auth_views.py` (`avatar`, `profile`), `userdata/models.py` (`avatar_upload_path`), `userdata/serializers.py` (`UserProfileUpdateSerializer`), `cinedb/settings.py` (`DEBUG`, `ALLOWED_HOSTS`, `PASSWORD_RESET_TIMEOUT`, `NUM_PROXIES`, `CACHES`), `start.py` + `docker-entrypoint.sh` (`createcachetable`; `start.py` sets `DEBUG=True` for local dev).
- Frontend: `src/components/ProfileModal.tsx` sends `current_password` when the email changes and explains why it's needed.
- Config/docs: `.env.example`, `backend/.env.example`, `docker-compose.yml` (trusted-proxy count), `README.md`/`docs/ARCHITECTURE.md`, and the CLAUDE.md `ALLOWED_HOSTS` note (whose "prod fail-closed" claim becomes true).
- Operational: anyone running Docker with `ALLOWED_HOSTS=*` must update their (untracked) `.env.docker`.
- Related: `fix-session-lifecycle` provides revocation of existing sessions on password reset, which completes the takeover mitigation started by the email-change re-auth here.
