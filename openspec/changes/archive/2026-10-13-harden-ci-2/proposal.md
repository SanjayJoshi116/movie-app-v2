## Why

Backlog item 21a (from the 2026-10-09 audit). CI is green on runs that should fail:
- Playwright retries each TS e2e test up to twice, so a flaky test passes, against `ci-pipeline` ("CI SHALL fail when any test … fails").
- `eslint` never looks at `e2e/*.ts`.
- Jest passes with no tests found.
- Nothing builds the Docker images, so a broken Dockerfile or `nginx.conf` first shows up at deploy time.

The production nginx also sends the 1.5 MB main bundle uncompressed, with no long-lived cache on assets whose names are already content-hashed.

## What Changes

- **No CI retries:**
  - TS Playwright runs with `retries: 0` everywhere. Traces switch from `on-first-retry` (which would never record now) to `retain-on-failure`.
  - The `webServer` start timeout goes from 120 s to 300 s, matching the Python job's `wait-on`. A cold CRA compile already took over 120 s locally.
- **Lint covers e2e:** `npm run lint` runs ESLint over `src` and `e2e`, still with `--max-warnings=0`.
- **Jest must find tests:** `--passWithNoTests` is dropped from the CI unit-test step.
- **Docker build job:**
  - A new CI job builds `backend/Dockerfile` and `Dockerfile.frontend`.
  - It then starts the frontend image and checks its real nginx: security headers, an `index.html` that is revalidated, a missing chunk that 404s, and gzip with long-lived caching on a hashed asset.
- **CI housekeeping:**
  - Playwright browsers are cached in both e2e jobs.
  - A `concurrency` group cancels superseded pull-request runs.
  - Ruff's `target-version` goes from `py311` to `py312`, matching CI, Docker and dev.
- **nginx:**
  - `gzip` for the app's own text assets (HTML, JS, CSS, JSON, SVG). It isn't applied to `/api/` or `/media/`.
  - `/static/` successes get `Cache-Control: public, max-age=31536000, immutable`, but 404s do not.
  - The entry page keeps `no-cache`, and every security header stays server-level.
- **Test hygiene:**
  - `e2e/responsive.spec.ts` replaces its fixed `waitForTimeout(200)` with a wait for the scroll to be handled.
  - `e2e/python/test_ratings.py` drops its non-waiting `count() == 0` fallback.
  - A TS e2e test loads a two-page watched history, through the real paginated mock shape, and sees every entry. The page-1-only gap in the backlog is now unit-tested (`fetchAllPages.test.ts`, added in `speed-up-pages`), but no test exercises it through the app.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `ci-pipeline`:
  - Lint covers the e2e specs.
  - An e2e test that fails is never retried into a pass.
  - Added: CI runs the frontend unit tests and fails when none are found.
  - Added: CI builds both production images and checks the frontend image's served headers.
- `container-deployment`: added that static assets are compressed and hashed assets are cached long-term, while the entry page is still revalidated.

## Impact

- **CI and tooling:** `.github/workflows/ci.yml`, `playwright.config.ts`, `package.json` (`lint` script), `pyproject.toml` (ruff target), plus whatever the wider lint and ruff targets newly flag.
- **Deploy:** `nginx.conf` and `backend/userdata/tests/test_nginx_conf.py`.
- **Tests:** `e2e/responsive.spec.ts`, `e2e/python/test_ratings.py`, a new pagination e2e test, and possibly `e2e/fixtures.ts`'s `paginated()` (an optional `next`).
- **Docs:**
  - `CLAUDE.md`: nginx caching, lint scope, CI retries.
  - `docs/ARCHITECTURE.md`: why gzip and caching stop at `/api/`.
  - `docs/BUG_BACKLOG.md`: item 21's split into 21a/21b/21c.
- **No app runtime or API changes.**
- **Out of scope:**
  - 21b `polish-colors-docs`: the hex sweep, docs drift, and the proxy-order wording.
  - 21c `spec-test-gaps`: the conformance test list.
  - The local Anaconda env drift from `constraints.txt` (info only).
