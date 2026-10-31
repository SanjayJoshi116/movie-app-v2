## 1. Startup and healthcheck

- [x] 1.1 `backend/docker-entrypoint.sh`: keep `migrate` and `createcachetable` in front; move `flushexpiredtokens`, `prune_media_cache` and `compute_recommendations` (same order, `timeout`s and skip messages) into one backgrounded subshell started just before `exec gunicorn`; update the comments
- [x] 1.2 `docker-compose.yml`: backend healthcheck `start_period: 300s`, with a comment on why (first success ends it; covers a long migration)
- [x] 1.3 `test_startup_warmup.py`: drift test that the entrypoint's and `start.py`'s best-effort steps match (names, order, bounds); entrypoint test that the best-effort steps run after the required ones, inside the backgrounded block, and that `exec gunicorn` is last; adjust any existing entrypoint test that assumed the steps block; a compose test that the backend `start_period` is at least 300s

## 2. nginx

- [x] 2.1 `nginx.conf`: server-level `resolver 127.0.0.11 valid=10s ipv6=off;`; in `/api/` and `/media/`, `set $backend_upstream http://backend:8000;` + `proxy_pass $backend_upstream;` with a comment on why (and that the resolver is Docker's)
- [x] 2.2 `nginx.conf`: `map $request_uri $referrer_policy` (`/reset-password/`, `/tmdb-callback` → `no-referrer`, default `strict-origin-when-cross-origin`) feeding the server-level `Referrer-Policy` `add_header`; update the log-redaction comment
- [x] 2.3 `nginx.conf`: `map $http_x_forwarded_proto $forwarded_proto` (`https` → `https`, else `http`) used by both proxy locations, with the `SECURE_PROXY_SSL_HEADER` warning comment
- [x] 2.4 `test_nginx_conf.py`: resolver present and every `proxy_pass` uses a variable; referrer-policy map covers both token paths with `no-referrer` and defaults to `strict-origin-when-cross-origin`; `X-Forwarded-Proto` is set only from the normalizing map; keep the no-`add_header`-in-`location` test passing
- [x] 2.5 `.github/scripts/smoke-frontend.sh`: check `Referrer-Policy: no-referrer` on `/reset-password/x/y/` and `/tmdb-callback?request_token=x`, and keep `strict-origin-when-cross-origin` on the other paths (make `security_headers` not assert the policy for the token pages)

## 3. CI workflow

- [x] 3.1 `ci.yml` backend job: service image → compose's `postgres:15.19-alpine3.24@sha256:…`; one job-level `env:` replacing the three step copies
- [x] 3.2 `ci.yml`: `node-version` → the exact version in `Dockerfile.frontend` in every Node job; `python-version` → the exact version in `backend/Dockerfile` in every Python job
- [x] 3.3 `ci.yml`: `timeout-minutes` on `frontend` and `backend`, from the last green runs' durations (`gh run view`) plus margin, else 20
- [x] 3.4 `ci.yml` docker job: backend build `load: true` + tag; new step running `python manage.py check --deploy` in the image with `DEBUG=False` and placeholder production settings (generated Fernet key, random `SECRET_KEY`); env list taken from what `settings.py` requires with `DEBUG` off; drop `--add-host backend:127.0.0.1` from the frontend start and update its comment
- [x] 3.5 `test_compose_config.py`: every `image:` in `ci.yml` has a digest; every `node-version:`/`python-version:` in `ci.yml` equals the matching Dockerfile's version, failing with both versions named

## 4. Frontend image

- [x] 4.1 `Dockerfile.frontend`: `COPY package.json package-lock.json .npmrc ./` and plain `npm ci`; confirm `.dockerignore` doesn't exclude `.npmrc`; add a `test_compose_config.py` check that the image copies `.npmrc` and doesn't restate `--legacy-peer-deps`

## 5. Docs and verification

- [x] 5.1 `CLAUDE.md`: Docker stack (background best-effort steps, resolver, token-page referrer policy, normalized forwarded scheme, backend image check), pinning bullet (CI service image and runtimes), and the stack bullet's startup-order sentence
- [x] 5.2 `docs/ARCHITECTURE.md`: rationale bullets for background startup steps, request-time resolution and the token-page referrer policy
- [x] 5.3 Run backend pytest, `ruff check backend/`, `makemigrations --check --dry-run` (with `DEBUG=True`); no frontend code changes, so typecheck/lint/Jest only if something in `src`/`e2e` changes
- [x] 5.4 `docs/BUG_BACKLOG.md` item 54 and status table: link the change; note that the resolver, healthcheck and background-step behaviour are verified only statically until CI's docker job and a real deploy
