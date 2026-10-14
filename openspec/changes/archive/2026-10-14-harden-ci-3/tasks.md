## 1. Pinned CI tools

- [x] 1.1 `wait-on` exact-version devDependency (lockfile updated); CI uses `npx --no-install wait-on`
- [x] 1.2 `e2e/python/constraints.txt` from a clean venv; CI installs with `-c`; `@playwright/test` exact `1.60.0`
- [x] 1.3 `test_dependency_versions.py`: pip `playwright` pin equals `@playwright/test` version
- [x] 1.4 Every `uses:` pinned to a resolved commit SHA with a version comment; top-level `permissions: contents: read`

## 2. Python e2e traces

- [x] 2.1 `e2e-python`: `--tracing=retain-on-failure --output=e2e/python/test-results`, `if: failure()` upload (7 days)

## 3. Real checks

- [x] 3.1 `test_lists.py`: list-name input caps at exactly 60
- [x] 3.2 `test_e2e_mock_shapes.py`: parse `src/types/domain.ts` DTO interfaces (and `AuthUser`), compare with serializer fields both ways; verify it fails when a field is removed from a DTO (temporarily)
- [x] 3.3 TMDB-shaped TS literals in `watchlist.spec.ts`, `movies.spec.ts`, `write-feedback.spec.ts`, `accessibility.spec.ts` `satisfies` the `TMDB*` types

## 4. Images and nginx

- [x] 4.1 Resolve exact tags + digests from Docker Hub; pin `Dockerfile.frontend`, `backend/Dockerfile`, `docker-compose.yml`
- [x] 4.2 `backend/.dockerignore` excludes tests and dev-only files; root `.dockerignore` excludes `.git`, `.github`, `.claude`, `openspec`, `docs`, caches
- [x] 4.3 `nginx.conf`: `server_tokens off;`
- [x] 4.4 Static tests: every `FROM`/`image:` has a digest; backend `.dockerignore` list; `server_tokens off` present

## 5. Drift and nits

- [x] 5.1 `@types/node` → `^22`; fix any type errors
- [x] 5.2 ARCHITECTURE.md `fetchTVReviews` line; conftest `mock_base_django_routes` docstring; `App.tsx` route line split

## 6. Docs and verification

- [x] 6.1 CLAUDE.md: pins (SHA actions, digest images, e2e constraints, Playwright version check) and how to bump them; Python e2e traces
- [x] 6.2 CHANGELOG `[Unreleased]`; README (CI section, test list); `docs/BUG_BACKLOG.md` item 34 split into 34a (📝) and 34b (⏳)
- [x] 6.3 `npm run typecheck`, `npm run lint`, `ruff`, backend pytest (background), the touched e2e specs (`test_lists.py`, the four TS specs); note that Docker/nginx/workflow changes are verified for real only by CI
