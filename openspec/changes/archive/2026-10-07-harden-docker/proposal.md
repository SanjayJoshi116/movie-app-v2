## Why

The Docker Compose stack is documented as a complete production deployment, but it has five gaps:
- The backend image bakes in whatever is in the local `backend/media/` folder, including other people's uploaded avatars.
- The backend runs as root.
- The schema is created with `migrate --run-syncdb` against a migrations folder bind-mounted from the host checkout, not the one in the image.
- The site sends no Content-Security-Policy and no HSTS.
- `STATIC_ROOT` isn't set. Meanwhile the DRF browsable API is still on in production, and its pages reference static files that nothing serves.

None of these is an exploitable bug on its own, but together they make the "production" stack weaker than it claims to be. This is the Docker part of backlog item 7.

## What Changes

One rule: **the production containers run only what's in the image, as an unprivileged user, and every page the site serves carries a security policy that matches what the app actually loads.**

### Image contents
- `backend/.dockerignore` excludes `media/` (and local caches), so no uploaded file ends up in an image.
- The migrations bind mount is removed from `docker-compose.yml`. The backend uses the migrations baked into the image, like every other source file.

### Startup
- `docker-entrypoint.sh` runs `migrate --noinput` instead of `migrate --run-syncdb`. Every app has migrations, so syncdb can only create tables that bypass them. The rest of the boot sequence is unchanged: `createcachetable`, the time-boxed warm-up, then gunicorn with the same `--timeout 30`.

### Process user
- The backend image creates an unprivileged `app` user. `/app/media` is owned by it, and the container runs as `USER app`.
- Existing deployments need a one-time ownership fix on the `media_data` volume (a manual step, documented in the README), because it was created by the root container.

### Security headers (nginx, for every response)
- **Content-Security-Policy:** allows only what the app uses:
  - its own origin
  - TMDB images (`image.tmdb.org`)
  - Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
  - YouTube trailer embeds (`youtube-nocookie.com`)
  - inline styles (antd injects them at runtime)

  It also sets `frame-ancestors 'self'` and `object-src 'none'`. The React build stops inlining its runtime chunk, so no inline script is needed.
- **Strict-Transport-Security:** sent only when the request reached the outer TLS terminator over HTTPS (`X-Forwarded-Proto: https`). A plain-HTTP LAN deployment never gets it.
- The deprecated `X-XSS-Protection: 1; mode=block` is replaced by `0`, which is the current recommendation now that CSP covers this.

### Static files and API rendering
- `STATIC_ROOT` is set, so `collectstatic` works. Nothing collects or serves static files in production, because nothing needs them:
  - with `DEBUG` off, the API renders JSON only (the browsable HTML API is dev-only)
  - Django admin isn't routed through nginx

## Capabilities

### New Capabilities
- `container-deployment`: what the production containers contain, which user they run as, how the schema is brought up at boot, the security headers every response carries, and what the production API renders.

### Modified Capabilities
None. `service-health` and `api-hardening` are unchanged. The startup order and health check stay as they are.

## Impact

- **Files:**
  - `backend/Dockerfile`
  - `backend/.dockerignore`
  - `backend/docker-entrypoint.sh` (the gunicorn line is unchanged; `test_tmdb_proxy` reads it)
  - `docker-compose.yml`
  - `nginx.conf`
  - `Dockerfile.frontend` (`INLINE_RUNTIME_CHUNK=false`)
  - `backend/cinedb/settings.py` (`STATIC_ROOT`, production renderer)
  - `README.md` (Docker section: upgrade step for the media volume, HSTS behavior behind a TLS terminator)
- **No new dependencies.** whitenoise is not added, because there's nothing to serve.
- **Manual steps for the user:**
  - run the one-time `chown` on the `media_data` volume when upgrading an existing deployment
  - make sure an outer TLS terminator sets `X-Forwarded-Proto`
  - `.env.docker` needs no change
- **Verification needs Docker,** which isn't installed on this machine. The container checks in `tasks.md` are for the user to run. Backend settings tests and a CSP check against the dev build run locally.
