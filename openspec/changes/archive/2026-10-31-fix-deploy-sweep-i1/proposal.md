## Why

The I1 module sweep (BUG_BACKLOG item 54: `/code-review high` and `/security-review` of `nginx.conf`, both Dockerfiles, `docker-compose.yml`, the CI workflow and `scripts`, 2026-10-31) found that a slow boot can leave the Docker stack down for good, that recreating only the backend 502s the API, and that CI doesn't pin or exercise everything it should. The security review found nothing exploitable, but three of its hardening notes overlap the code review and are cheap to close: one-time tokens can reach nginx's error log, the client's `X-Forwarded-Proto` is passed through unchecked, and CI's Postgres image floats.

## What Changes

- **Startup no longer outlasts the healthcheck.** The Docker entrypoint runs only the required steps (migrate, `createcachetable`) before gunicorn, and starts the three best-effort steps (`flushexpiredtokens`, `prune_media_cache`, `compute_recommendations`, same bounds) in the background. The backend healthcheck's `start_period` covers a long migration. A test keeps the entrypoint's and `start.py`'s best-effort step lists and bounds in step.
- **nginx re-resolves the backend.** `proxy_pass` goes through a variable with Docker's embedded resolver, so a recreated backend container is found without restarting the frontend.
- **One-time tokens stay out of nginx's error log.** Pages at `/reset-password/…` and `/tmdb-callback` are served with `Referrer-Policy: no-referrer`, so their API calls carry no token-bearing Referer for an upstream error line to record. Every other page keeps `strict-origin-when-cross-origin`.
- **`X-Forwarded-Proto` is normalized.** nginx forwards only `https` or `http`, never an arbitrary client value, and a comment records that Django must not trust it (`SECURE_PROXY_SSL_HEADER`) without a terminator that overwrites it.
- **CI pins what it still floated.** The backend job's Postgres service image is pinned by tag and digest (the compose one), Node and Python by exact version matching the Dockerfiles, and `test_compose_config.py` checks the workflow too.
- **CI starts the backend image.** The docker job runs `manage.py check --deploy` inside the built backend image with `DEBUG` off and dummy settings, so runtime imports of stripped files or production-only settings failures fail CI.
- **Every CI job has a time cap.** `frontend` and `backend` get `timeout-minutes`.
- **Cleanups:** one job-level `env:` for the backend job instead of three copies; the frontend image copies `.npmrc` and runs a plain `npm ci`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `container-deployment`: one-time tokens kept out of the error log too (no-referrer on the token pages); nginx re-resolves the backend; the forwarded scheme is normalized; the image installs with the repo's npm settings.
- `service-health`: best-effort startup steps no longer delay the server in Docker; the healthcheck allows for a long migration; both startup paths list the same steps.
- `ci-pipeline`: the service image and runtimes are pinned and checked; CI starts the backend image; every job has a time cap.

## Impact

- `nginx.conf`, `.github/scripts/smoke-frontend.sh`, `backend/userdata/tests/test_nginx_conf.py`
- `backend/docker-entrypoint.sh`, `docker-compose.yml`, `backend/userdata/tests/test_startup_warmup.py`
- `.github/workflows/ci.yml`, `backend/userdata/tests/test_compose_config.py`
- `Dockerfile.frontend`
- Docs: `CLAUDE.md` (Docker stack, pinning, startup notes), `docs/ARCHITECTURE.md`, `docs/BUG_BACKLOG.md` item 54
- No app code, API or migration changes. Docker and nginx behaviour can be checked locally only statically; CI's `docker` job is the real check.
