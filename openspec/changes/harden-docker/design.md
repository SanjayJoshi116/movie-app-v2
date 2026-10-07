## Context

See proposal.md for the gaps. The current setup, as checked on 2026-10-06:

- **Three services:** `db` (postgres), `backend` (python:3.11-slim, gunicorn, 3 workers, `--timeout 30`) and `frontend` (nginx:alpine serving the CRA build). nginx proxies `/api/` and `/media/` to `backend:8000`. Every other path falls back to `index.html`, so `/admin/` and `/static/` never reach Django.
- **TLS is not handled by the stack.** The README tells users to put "a domain/TLS terminator of your choice" in front, or to run plain HTTP on a LAN. `TRUSTED_PROXY_COUNT=1` assumes nginx is the only proxy.
- **Headers:** nginx already sets `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and the obsolete `X-XSS-Protection: 1; mode=block`. These are at server level, and no `location` has its own `add_header`, so every response inherits them.
- **Image contents:**
  - `backend/.dockerignore` excludes caches and `.env*`, but not `media/`. This checkout has `backend/media/avatars/`, which `COPY . .` puts into the image.
  - The `./backend/userdata/migrations` bind mount overrides the copy in the image.
- **External origins the frontend loads:**
  - `fonts.googleapis.com`: an `@import` in `App.css`, which pulls fonts from `fonts.gstatic.com`
  - `image.tmdb.org`: posters and logos
  - `www.youtube-nocookie.com`: trailer iframes
  - Avatars are same-origin (`/media/`). API calls are same-origin (`REACT_APP_API_BASE_URL=/api` in `Dockerfile.frontend`). Provider links are plain navigations, which CSP doesn't restrict.
- **Inline code:**
  - antd v5 injects `<style>` tags (cssinjs), and React components use `style={...}`, so `style-src` needs `'unsafe-inline'`.
  - CRA inlines its webpack runtime chunk into `index.html` by default (`INLINE_RUNTIME_CHUNK`), which needs either an inline script or a hash.
- **Constraints from CLAUDE.md:**
  - Keep the `docker-entrypoint.sh` boot order.
  - `makemigrations` never runs automatically.
  - Leave the gunicorn `--timeout 30` line alone (`test_tmdb_proxy` parses it).
  - The health check calls `localhost:8000`.
  - `.env.docker` holds secrets and is user-managed.
- **Docker isn't installed on this machine.**

## Goals / Non-Goals

**Goals:**
- Meet every requirement in `specs/container-deployment` with config-only changes and no new Python or npm dependencies.
- Existing deployments upgrade with one documented manual step.

**Non-Goals:**
- Running nginx unprivileged. nginx's master runs as root by design and its workers already drop to the `nginx` user. Switching to `nginx-unprivileged` changes the container port (80 → 8080) and the published ports, which is a larger change than this one.
- Serving Django admin in production. It isn't reachable today and stays that way.
- A CSP nonce/hash setup or `strict-dynamic`. That would need build-time templating of `index.html`, which isn't worth it for one runtime chunk that can simply be externalized.
- Terminating TLS in the bundled nginx.
- Anything in `.env.docker`.

## Decisions

### D1. Security headers live in nginx, not Django
nginx serves `index.html` and all static assets itself, and those are the documents the CSP protects. Django only ever returns JSON or media files. So the headers go in `nginx.conf` at server level, and every response inherits them, including proxied `/api/` and `/media/`.

*Alternatives:*
- `django-csp` would only cover Django's responses, not the SPA document, and it's a new dependency.
- Setting HSTS in both nginx and Django (`SECURE_HSTS_SECONDS`) would send the header twice.

### D2. CSP policy
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: https://image.tmdb.org;
connect-src 'self';
frame-src https://www.youtube-nocookie.com;
frame-ancestors 'self';
object-src 'none';
base-uri 'self';
form-action 'self'
```

- **Enforced, not report-only.** Report-only needs a reporting endpoint nobody would watch. Instead, verification walks every page under the policy (task 4) before it ships.
- **`style-src 'unsafe-inline'` is required** by antd's runtime styles and React `style` props. It's the usual trade-off. Script injection is still blocked, which is the part that matters.
- **No inline script:** `Dockerfile.frontend` sets `ENV INLINE_RUNTIME_CHUNK=false`. CRA then emits the runtime as a file, and `script-src 'self'` needs no `'unsafe-inline'` or hash.
- **TMDB OAuth** (`/tmdb-callback`) uses a top-level navigation to themoviedb.org, which CSP doesn't restrict. `form-action 'self'` doesn't affect it, because it isn't a form post.
- **Not covered by this policy:** the frontend has no service worker, so `worker-src` falls back to `default-src` and isn't needed.
- **Same policy for `/api/` and `/media/`:** JSON and images ignore the document directives, so sharing one policy is harmless.

### D3. HSTS keyed on `X-Forwarded-Proto` via an nginx `map`
At the top of `nginx.conf` (it's included inside nginx's `http` block, where `map` is allowed):
```
map $http_x_forwarded_proto $hsts_header {
    https   "max-age=31536000";
    default "";
}
```
Then at server level: `add_header Strict-Transport-Security $hsts_header always;`. nginx skips an `add_header` whose value is empty, so plain-HTTP requests get no header.

- **Forging the header is harmless:** a client on a plain-HTTP LAN could send `X-Forwarded-Proto: https`, but browsers ignore STS received over an insecure connection, so it does nothing. Behind a real TLS terminator, the terminator sets the header.
- **`max-age` is one year**, with no `includeSubDomains` and no `preload`. The deployment's domain is unknown, and those two flags affect sibling hosts.

*Alternative:* an env-templated nginx config, `HTTPS=true` passed to the frontend container. Rejected: compose can only feed it through shell or project-`.env` interpolation (the project-root `.env` is the React dev env), or by giving nginx `env_file: .env.docker`, which would expose every backend secret to the nginx container.

Also forward the scheme to Django (`proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;`). This is harmless now, and lets anything later read the real scheme. `SECURE_PROXY_SSL_HEADER` is not set, because nothing in Django builds absolute URLs from the request (avatar URLs are relative).

`X-XSS-Protection` becomes `"0"`, the OWASP/MDN recommendation. The old `1; mode=block` filter has been removed from browsers and could be abused where it still existed.

### D4. Non-root backend with a one-time volume fix
In `backend/Dockerfile` (final stage):
```
RUN useradd --system --uid 10001 --user-group --no-create-home app \
 && mkdir -p /app/media && chown app:app /app/media
USER app
```
`chmod +x docker-entrypoint.sh` stays before `USER`. `/app` stays root-owned and read-only to `app`. Only `media` is writable.

- **Bytecode:** Python can't write `__pycache__` under `/app`. `ENV PYTHONDONTWRITEBYTECODE=1` avoids noisy failures. This costs nothing, since gunicorn imports once per worker.
- **Fresh `media_data` volume:** Docker initializes a new named volume from the image directory, including its ownership, so it's `app`-owned.
- **Existing volume:** it was created by the root container and stays root-owned. The README upgrade note gives a one-time command: `docker compose run --rm --user root backend chown -R app:app /app/media`.

*Alternative:* start as root and drop to `app` with `setpriv` in the entrypoint after a `chown`. Rejected: PID 1 would still start as root on every boot to cover a one-time upgrade case. The manual step is the honest trade.

### D5. Migrations from the image, plain `migrate`
- Remove the `./backend/userdata/migrations:/app/userdata/migrations` volume. The image's `COPY . .` already contains them.
- `docker-entrypoint.sh`: `python manage.py migrate --noinput`.
- The mount let migrations generated inside a container survive on the host, but CLAUDE.md says migrations are generated explicitly in development and never at boot. It also stops a host checkout from silently changing the schema of a running image. With `USER app`, the mount would also be unwritable.
- `--run-syncdb` only creates tables for apps *without* migrations. Every app here has them, so all it can do is hide a missing migration.

*Alternative:* keep the mount read-only. Rejected: the image would still not be self-contained.

### D6. `STATIC_ROOT` set; production renders JSON only; no whitenoise
- `settings.py`: `STATIC_ROOT = BASE_DIR / "staticfiles"`, plus `staticfiles/` in `backend/.dockerignore` and `.gitignore`.
- When not `DEBUG`: `REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = ("rest_framework.renderers.JSONRenderer",)`. In DEBUG, DRF's default list (JSON + browsable) stays.
- `collectstatic` is not run in the image, because no production path serves `/static/`: nginx sends it to the SPA, and admin isn't routed.

*Alternative:* whitenoise plus `collectstatic` plus nginx routes for `/static/` and `/admin/`, to make admin usable in production. Rejected for now: it's a new dependency and exposes a new login surface for a feature nobody uses through Docker. That's left as a user decision.

### D7. `.dockerignore`
`backend/.dockerignore` adds:
- `media/`
- `staticfiles/`
- `.pytest_cache/`
- `**/__pycache__/` (the existing `__pycache__` entry only matches at the root)
- `pytest_dev_env.py` is kept: the image doesn't run tests, and keeping it is harmless.

The root `.dockerignore` already excludes `backend` from the frontend context and needs no change.

## Risks / Trade-offs

- **[CSP breaks something not found by the page walk]** (e.g. a provider logo host other than `image.tmdb.org`, or a future embed) → The page walk in tasks covers every route. If it breaks, the browser console names the blocked origin, and the fix is a one-line policy edit. To roll back, remove the header line.
- **[Existing deployments forget the media `chown`]** → Avatar uploads fail with a 500 (`PermissionError`), while existing avatars still serve. The README upgrade note sits next to `docker compose up --build`.
- **[A TLS terminator that doesn't set `X-Forwarded-Proto`]** → No HSTS, the same as today. This is documented.
- **[The host's migrations folder previously held migrations missing from git]** (generated in a container) → Removing the mount would drop them. Check `git status backend/userdata/migrations` before upgrading. The upgrade note says so. This is unlikely, since CLAUDE.md forbids boot-time `makemigrations`.
- **[`PYTHONDONTWRITEBYTECODE` adds a little startup cost]** → Negligible for 3 workers.

## Migration Plan

1. Merge. Users run `docker compose up --build -d`.
2. Existing deployments run the one-time `chown` above (README), then restart `backend`.
3. Rollback: revert the commit and rebuild. The root container can still write an `app`-owned volume.

## Open Questions

- Should Django admin be reachable in production (D6 alternative)? This can be decided later without changing this change's specs.
