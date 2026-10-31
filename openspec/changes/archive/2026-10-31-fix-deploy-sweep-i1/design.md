## Context

The stack is three compose services: Postgres, the backend (gunicorn behind `docker-entrypoint.sh`) and the frontend (nginx serving the CRA build and proxying `/api/` and `/media/` to `backend:8000`). The frontend waits for `backend` to report healthy. Locally there is no Docker, so nginx and Dockerfile behaviour is checked statically (`test_nginx_conf.py`, `test_compose_config.py`, `test_startup_warmup.py`) and for real only in CI's `docker` job, which builds both images, starts the frontend image and runs `.github/scripts/smoke-frontend.sh` against it. Findings and their verification are in BUG_BACKLOG item 54.

## Goals / Non-Goals

**Goals:**
- A slow boot can't leave the stack down, and a backend-only redeploy can't strand the frontend on a dead address.
- No one-time token reaches any nginx log.
- Everything CI runs is pinned, the backend image is exercised in CI, and no CI job can run for six hours.

**Non-Goals:**
- One shared Python step runner for both startup paths. Considered (it removes the duplication outright), but it adds a Python wrapper process in front of gunicorn in the image for a three-line list; a drift test gives the same safety.
- Making `start.py` (dev) start `runserver` before the best-effort steps. Dev boots against a local database in seconds; keeping it sequential keeps the dev log readable.
- TLS in compose, or trusting `X-Forwarded-Proto` in Django (`SECURE_PROXY_SSL_HEADER`).
- Compose's `depends_on: restart: true`: it only helps when compose itself recreates the backend, not on a `docker restart`, and needs a newer compose.

## Decisions

**1. Best-effort steps run in the background in Docker.** The entrypoint keeps `migrate` and `createcachetable` in front (both required: the server needs the schema and the throttle cache table), then starts the three bounded best-effort steps in one background subshell, in today's order and with today's `timeout`s and skip messages, and `exec`s gunicorn. After the `exec`, gunicorn's master is the subshell's parent; it reaps any child on `SIGCHLD` (`waitpid(-1)`) and ignores ones that aren't workers, so no zombie is left. The steps touch expired token rows, stale cache rows nothing watched uses, and per-user recommendation rows that request-triggered refreshes already write concurrently (`save_recommendations` handles the race), so running them alongside requests needs no new locking. This fixes the healthcheck race at its source: the server is up as soon as migrations finish.

**2. Healthcheck `start_period: 300s`.** Failures inside the start period don't count, and the first success ends it, so a normal boot is still healthy within one 10 s interval. Five minutes covers a long data migration. `start_interval` would allow faster checks during the period but needs Docker Engine 25+; not used.

**3. Drift test for the two startup paths.** `test_startup_warmup.py` parses the best-effort command names and bounds from `docker-entrypoint.sh` (`timeout N python manage.py X`) and from `start.py` (`run_warmup([... "X"], timeout=N ...)`) and asserts the same ordered list. It also asserts that in the entrypoint every best-effort step sits after the required ones and inside the backgrounded block, and that `exec gunicorn` is the last line.

**4. nginx resolves `backend` at request time.** Server level: `resolver 127.0.0.11 valid=10s ipv6=off;` (Docker's embedded DNS on compose's user-defined network). Each proxy location: `set $backend_upstream http://backend:8000;` and `proxy_pass $backend_upstream;`. With a variable, nginx resolves through the resolver per TTL instead of once at load, and boots even when `backend` doesn't resolve. With no URI part, a variable `proxy_pass` forwards the client's request URI unchanged, which is what `/api/` already does; `/media/` used `proxy_pass http://backend:8000/media/`, which maps `/media/` to itself, so the no-URI form sends the same path. CI's smoke run drops `--add-host backend:127.0.0.1`, which only existed to let nginx boot, and so now also proves the frontend starts without a resolvable backend.

**5. `Referrer-Policy: no-referrer` for the token pages, set by nginx.** A `map $request_uri $referrer_policy` (`~^/reset-password/` and `~^/tmdb-callback` → `no-referrer`, default `strict-origin-when-cross-origin`) feeds the existing server-level `add_header Referrer-Policy … always`, so no `location` gains an `add_header`. A document's policy governs the requests it makes, so the reset form's and callback's API calls carry no Referer, and an upstream error line has no referrer to print. Both pages are only ever entered by a full page load (an emailed link, TMDB's redirect), so the document is the one nginx served for that URL. The access-log referer redaction stays as a backstop. Alternatives: `error_log … crit` (hides the upstream errors operators need); a `<meta name="referrer">` set from React (runs after mount, races the callback page's own mount effect, and protects nothing in dev, where there's no nginx log).

**6. Forwarded scheme normalized.** `map $http_x_forwarded_proto $forwarded_proto { https https; default http; }` and `proxy_set_header X-Forwarded-Proto $forwarded_proto;` in both proxy locations. The outer TLS terminator's `https` still passes (and still drives the HSTS map, unchanged); anything else becomes `http`. It can't prove the value came from a terminator, so a comment beside it says Django must not set `SECURE_PROXY_SSL_HEADER` until the front proxy overwrites the header.

**7. CI pins.** The backend job's service image becomes compose's `postgres:15.19-alpine3.24@sha256:…`. `node-version` becomes the exact `node:` version in `Dockerfile.frontend` (`22.23.2`) in all three Node jobs, and `python-version` the exact `python:` version in `backend/Dockerfile` (`3.12.14`) in both Python jobs. `test_compose_config.py` gains: every `image:` in `ci.yml` has a digest; every `node-version:` equals the Dockerfile's Node version and every `python-version:` the backend Dockerfile's Python version. Regex over the file text, like the existing tests, so no YAML dependency.

**8. Backend image check in CI.** The backend build gets `load: true` and a tag, then a step runs `docker run --rm` on it with `DEBUG=False`, a random `SECRET_KEY`, `ALLOWED_HOSTS=ci.invalid`, `FRONTEND_URL=https://ci.invalid`, a dummy `EMAIL_BACKEND`, a generated Fernet key for `TMDB_SESSION_KEYS` (32 random bytes, urlsafe base64, made with the runner's Python, so no extra package) and a dummy `TMDB_API_KEY`, as the image's own `app` user on its read-only `/app`, running `python manage.py check --deploy`. `check` without `--database` doesn't connect to Postgres. Its default fail level is ERROR, so the `--deploy` warnings that are expected behind a TLS terminator (SSL redirect, secure cookies) print but don't fail; a settings `ImproperlyConfigured` or an import error in apps/URLconf does. The env list is whatever `settings.py` requires with `DEBUG` off at apply time.

**9. Job caps and env.** `frontend` and `backend` get `timeout-minutes` set from the last green runs' durations plus a margin (20 if the history isn't available). The backend job's three identical `env:` blocks become one job-level `env:`; `pip install` and `ruff` see it too, which is harmless.

**10. `.npmrc` in the image.** `COPY package.json package-lock.json .npmrc ./` and plain `npm ci`, so CI and the image read one npm configuration.

## Risks / Trade-offs

- [Best-effort output interleaves with gunicorn's log] → each step already prints a `[cinedb] … skipped` line naming itself; acceptable.
- [A failing step after `exec` can no longer be noticed by the entrypoint] → it never could stop startup anyway; skip messages still reach `docker logs`.
- [setup-python may not ship the exact `3.12.14` for ubuntu-24.04, or setup-node `22.23.2`] → the first CI run shows it; if missing, pick the newest patch both the action and Docker Hub have and bump the Dockerfile with it, keeping the test's equality.
- [Resolver address is Docker-specific] → the stack only runs under compose; a different orchestrator would need its own resolver line, noted in the comment.
- [None of the nginx or entrypoint behaviour can be run locally] → static tests here, CI's docker job for real; the healthcheck and resolver behaviour are confirmed only on a real deploy, and the report must say so.
