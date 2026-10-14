## Why

Backlog item 34, first half (34a). The fifth audit's infra, CI and tests pass found these gaps between what CI claims to pin and check and what it actually does:

- **Unpinned tools.**
  - The `e2e-python` job runs `npx wait-on`, which isn't a project dependency, so every run downloads whatever the registry serves.
  - The Python e2e dependencies have no constraints file, so greenlet, pyee, pytest-base-url and requests float.
  - pip's `playwright` and npm's `@playwright/test` match only because a comment asks.
  - Actions are pinned by moving tags.
  - The workflow has no `permissions:` block, so `GITHUB_TOKEN` gets the repo-default scopes.
- **Checks that can't fail.**
  - A Lists e2e test asserts `<= 100` against a 60-character limit.
  - The TS e2e mocks only `satisfies` hand-written DTO types. Nothing compares those types with the API, so a serializer change leaves the DTOs and every TS mock agreeing with each other but wrong. The `e2e-fixtures` spec requires an automated check.
- **Failures leave no evidence.** `e2e-python` uploads nothing when it fails, while `e2e-ts` uploads traces.
- **Images.**
  - Base images float (`node:22-alpine`, `nginx:alpine`, `python:3.12-slim`, `postgres:15-alpine`).
  - The backend image ships its tests and dev-only files.
  - The frontend build context uploads the whole repo, `.git` included.
- **Small drift:**
  - `@types/node ^25` against a Node 22 runtime.
  - ARCHITECTURE.md names a removed `fetchTVReviews`.
  - The Python e2e conftest docstring describes the old 401 fallback.
  - Two `<Route>`s share one line in `App.tsx`.
  - nginx sends its version.
  - Some TS TMDB-shaped literals skip `satisfies`.

The Lists DELETE-mock finding in this item was already fixed by `honest-states-a11y`. The app-config half (34b: `FRONTEND_URL` fail-closed, `.env.example`, the admin route, the upload size limit, the interpreter path in `package.json`) is a separate change.

## What Changes

- **CI:**
  - `wait-on` becomes a pinned devDependency.
  - `e2e/python/constraints.txt` pins the whole Python e2e environment, and a check fails CI when the pip and npm Playwright versions differ.
  - Every action is pinned to a commit SHA (version in a comment).
  - The workflow gets top-level `permissions: contents: read`.
  - `e2e-python` records Playwright traces on failure and uploads them.
- **Tests:**
  - The list-name test asserts the 60-character cap.
  - `test_e2e_mock_shapes.py` also reads the TS DTO interfaces in `src/types/domain.ts` and fails when their fields differ from the serializers'.
  - The TMDB-shaped TS literals `satisfies` the `TMDB*` types.
- **Docker:**
  - Base images are pinned to exact versions and digests (frontend, backend, compose's Postgres).
  - `backend/.dockerignore` excludes tests and dev-only files.
  - The root `.dockerignore` excludes `.git`, `.claude`, `openspec`, `docs` and tool caches.
  - nginx sets `server_tokens off`.
- **Docs and nits:**
  - `@types/node` goes to `^22`.
  - Fix ARCHITECTURE.md's `fetchTVReviews` line, the conftest docstring and the `App.tsx` route line.

No app behavior change.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `ci-pipeline`: every tool and action CI runs is pinned, the workflow token is read-only, and failed Python e2e runs leave traces.
- `e2e-fixtures`: the field-name check covers the TS DTO types too.
- `container-deployment`: images build from pinned bases and carry only runtime files, and nginx doesn't advertise its version.

## Impact

- CI: `.github/workflows/ci.yml`. CI's own runs are the real verification for the workflow, image and nginx changes, since there is no Docker on the dev machine. `test_nginx_conf.py` and `test_compose_config.py` check them statically.
- Files: `package.json`/lockfile (`wait-on`, `@types/node`), `e2e/python/constraints.txt`, `e2e/python/test_lists.py`, `e2e/python/conftest.py` (docstring), a few `e2e/*.spec.ts` literals, `backend/userdata/tests/test_e2e_mock_shapes.py`, a new version-match test, `Dockerfile.frontend`, `backend/Dockerfile`, `docker-compose.yml`, both `.dockerignore`s, `nginx.conf`, `src/App.tsx`, `docs/ARCHITECTURE.md`.
- Maintenance: SHA- and digest-pinned dependencies need deliberate bumps. The comments carry the version, so a bump is a find-and-replace.
