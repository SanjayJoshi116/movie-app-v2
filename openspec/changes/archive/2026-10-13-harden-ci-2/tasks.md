## 1. Test hygiene (before retries go away)

- [x] 1.1 `e2e/responsive.spec.ts`: replace `waitForTimeout(200)` after the scroll with an in-page wait for the `scroll` event plus two animation frames (listener registered before `scrollBy`)
- [x] 1.2 `e2e/python/test_ratings.py`: drop the `if rate_btn.count() == 0` fallbacks in both detail-page tests; use one `get_by_role("button", name="Rate")`
- [x] 1.3 `e2e/fixtures.ts`: `paginated()` takes an optional `next`; add a "Watched page" test in `e2e/watchlist.spec.ts` serving two pages by `page` param, asserting all three titles render and both requests sent `page_size=500`

## 2. Playwright config and lint scope

- [x] 2.1 `playwright.config.ts`: `retries: 0`, `trace: "retain-on-failure"`, `webServer.timeout: 300_000`
- [x] 2.2 `package.json`: `lint` → `eslint src e2e --ext .ts,.tsx --max-warnings=0`; run it, and add an `eslintConfig.overrides` entry for `e2e/**/*.ts` turning off only the `jest/*`/`testing-library/*` rules that misfire on Playwright; fix any real findings in `e2e/`
- [x] 2.3 `pyproject.toml`: ruff `target-version = "py312"`; run `ruff check backend/` and fix findings (ignore a PEP 695 rewrite rule with a comment if it would touch many files)

## 3. nginx compression and caching

- [x] 3.1 `nginx.conf`: server-level `gzip on`, `gzip_vary on`, `gzip_min_length 1024`, `gzip_types` (JS, CSS, JSON, manifest, SVG); `gzip off` in `/api/` and `/media/`
- [x] 3.2 `nginx.conf`: `map $uri $static_cache_control` (`~^/static/` → `public, max-age=31536000, immutable`) and a server-level `add_header Cache-Control $static_cache_control;` without `always`; comment why
- [x] 3.3 `test_nginx_conf.py`: the static map covers only `/static/`; its `add_header` is server-level and not `always`; the entry header line still matches; `gzip off` in `/api/` and `/media/`; existing no-`add_header`-in-location check still green

## 4. CI workflow

- [x] 4.1 Workflow-level `concurrency` (group on PR number or ref; `cancel-in-progress` only for `pull_request`)
- [x] 4.2 Frontend job: drop `--passWithNoTests`
- [x] 4.3 Playwright browser cache in `e2e-ts` (key from `package-lock.json`) and `e2e-python` (key from `e2e/python/requirements.txt`); `install --with-deps chromium` on miss, `install-deps chromium` on hit
- [x] 4.4 `.github/scripts/smoke-frontend.sh`: curl checks for `/` and `/movies` (200, `no-cache`, CSP, `nosniff`), the main bundle scraped from `index.html` with `Accept-Encoding: gzip` (gzip, immutable, CSP), and a fake `/static/js/main.deadbeef.js` (404, no `immutable`); print `docker logs` on failure
- [x] 4.5 New `docker` job: buildx with `gha` cache, build `backend/Dockerfile` and `Dockerfile.frontend`, run the frontend image with `--add-host backend:127.0.0.1`, run the smoke script
- [x] 4.6 Run the smoke script locally against a locally built frontend image if Docker is available; otherwise say so and rely on the first CI run

## 5. Verify and document

- [x] 5.1 `npm run typecheck`, `npm run lint`, Jest (`CI=true`, without `--passWithNoTests`), `npx playwright test` (both projects), Python e2e, backend `pytest` (incl. `test_nginx_conf`), `ruff check backend/`
- [x] 5.2 Validate the workflow YAML (`actionlint` if available, else a YAML parse) and the smoke script (`bash -n`, `shellcheck` if available)
- [x] 5.3 `CLAUDE.md`: nginx bullet mentions the immutable `/static/` header (not `always`) and gzip off for `/api/`/`/media/`; Verification says lint covers `e2e/` and CI never retries e2e tests; `docs/ARCHITECTURE.md`: bullet on why compression/caching stop at `/api/` and the 404 exception; `docs/BUG_BACKLOG.md`: item 21a status (the 21a/21b/21c split was recorded at proposal time)
