## Context

CI, test and image configuration only. Motivation is in proposal.md and requirements in `specs/`. Current state (re-checked 2026-10-14):

- `.github/workflows/ci.yml` runs five jobs:
  - Actions are referenced by tag (`actions/checkout@v4`, `setup-node@v4`, `setup-python@v5`, `cache@v4`, `upload-artifact@v4`, `docker/setup-buildx-action@v3`, `docker/build-push-action@v6`).
  - There is no `permissions:` block.
  - `e2e-python` installs `e2e/python/requirements.txt` without constraints, waits with `npx wait-on`, runs `pytest e2e/python`, and uploads nothing.
- `e2e/python/requirements.txt` pins `pytest-playwright==0.8.0` and `playwright==1.60.0`; `package.json` has `@playwright/test ^1.60.0` and `@types/node ^25.5.0`.
- `test_e2e_mock_shapes.py` reads the Python `MOCK_*` literals with `ast` and compares them with serializer output and a real `/api/stats/` response. `src/types/domain.ts` holds the TS DTO interfaces (`WatchlistEntryDTO`, `WatchedEntryDTO`, `RatingEntryDTO`, `UserListItemDTO`, `UserListDTO`), plus `AuthUser`.
- Images:
  - `Dockerfile.frontend` uses `node:22-alpine` → `nginx:alpine`. `backend/Dockerfile` uses `python:3.12-slim` (twice), with `COPY . .`. Compose's db uses `postgres:15-alpine`.
  - The backend entrypoint never uses `start.py` or the test files.
- No Docker on the dev machine: image and nginx changes are checked locally only by `test_nginx_conf.py` / `test_compose_config.py`, and for real by CI's `docker` job.

## Goals / Non-Goals

**Goals:** pin everything CI and the images run on, make the two vacuous checks real, keep failure evidence, and clean the listed drift.

**Non-Goals:**
- Dependabot / Renovate configuration to bump pins. Worth doing, but it's a repo-settings decision.
- The 34b app-config items.
- The light-theme contrast finding ("open, not grouped").

## Decisions

1. **`wait-on` as a devDependency.** Add `wait-on` at an exact version to `devDependencies`; the CI step becomes `npx --no-install wait-on …`. `--no-install` makes a missing install fail instead of silently downloading.
   - *Alternative:* a `curl` retry loop like the docker job's. Rejected: wait-on's IPv4/`ipv4first` handling is already documented in the workflow comment, and keeping the tool avoids reintroducing that hang.

2. **Python e2e constraints.** Generate `e2e/python/constraints.txt` with `pip freeze` from a fresh venv that installs `requirements.txt` (only the e2e deps). CI installs with `-c e2e/python/constraints.txt`.
   - A small pytest, `backend/userdata/tests/test_dependency_versions.py` (it already pins Django and ruff), reads `package.json`'s `@playwright/test` and the e2e `playwright==` pin and asserts the major.minor.patch match after stripping `^`/`~`.
   - `package.json` changes `@playwright/test` to an exact `1.60.0` so the lockfile and range can't drift apart either.

3. **Actions pinned by SHA.** Each `uses:` becomes `owner/repo@<40-hex sha> # vX.Y.Z`, resolved at apply time with `git ls-remote --tags` for the exact current release tag, peeling annotated tags. Top-level `permissions: contents: read`.
   - No job needs more: `upload-artifact` uses the runtime token, not `GITHUB_TOKEN` scopes, and nothing pushes or comments.

4. **Python e2e traces.**
   - Run `pytest e2e/python --tracing=retain-on-failure --output=e2e/python/test-results`.
   - Add an `actions/upload-artifact` step with `if: failure()`, the path above, and `retention-days: 7`, the same as `e2e-ts`.
   - `.gitignore` already covers `test-results/`.

5. **TS DTO check.** Extend `test_e2e_mock_shapes.py`:
   - Parse `src/types/domain.ts` with a regex: `export interface (\w+DTO) {` … `}`, field names from `^\s*(\w+)\??:` lines.
   - Map each DTO to its serializer and compare the field sets both ways.
   - Optional (`?`) fields count as present. Fields the client adds itself (e.g. `_itemId`) don't occur in DTOs, which are the wire types.
   - `AuthUser` is compared with the user serializer's fields too.
   - *Alternative:* generate the types from an OpenAPI schema. Rejected: a new toolchain for six types.

6. **Images pinned by version and digest.**
   - Use `node:22.<x>-alpine3.<y>@sha256:…`, `nginx:<x>-alpine@sha256:…`, `python:3.12.<x>-slim@sha256:…` and `postgres:15.<x>-alpine@sha256:…`.
   - The exact tags and multi-arch index digests are resolved at apply time from the Docker Hub registry API. The tag keeps the version readable; the digest makes it immutable.
   - The Node minor must satisfy `.nvmrc` / `engines` (22).
   - `test_compose_config.py` gains a check that every `FROM` and `image:` line has an `@sha256:` digest.

7. **Image contents.**
   - `backend/.dockerignore` adds `userdata/tests/`, `conftest.py`, `pytest.ini`, `pytest_dev_env.py`, `requirements-test.txt`, `start.py`, `.ruff_cache/`.
   - The root `.dockerignore` adds `.git`, `.github`, `.claude`, `openspec`, `docs`, `.eslintcache`, `.ruff_cache`, `.pytest_cache`, `coverage`.
   - `test_compose_config.py` asserts the backend list.
   - nginx: `server_tokens off;` at `http`/server level, asserted in `test_nginx_conf.py`.

8. **Small items.**
   - `@types/node` → `^22`, the same major as the runtime.
   - The ARCHITECTURE.md line now says reviews come with the one appended detail request.
   - The conftest docstring describes the 501 catch-all and the paginated `lists/`.
   - Split the `App.tsx` route line.
   - `satisfies` `TMDBMovieSummary` / `TMDBTVSummary` / `TMDBPersonSummary` (or the closest existing `TMDB*` type) on the named literals.

## Risks / Trade-offs

- **Pinned SHAs and digests go stale without a bot.** → The version comments make bumps easy. Recommend enabling Dependabot for actions and Docker separately.
- **Digest pins can't be tested locally (no Docker).** → CI's `docker` job builds and smoke-tests both images, and a wrong digest fails the build loudly. Say so when reporting.
- **`@types/node ^22` may surface type errors** if specs used newer APIs. → Fix them; that's the point.

## Migration Plan

None; CI and image config. Rollback: revert.
