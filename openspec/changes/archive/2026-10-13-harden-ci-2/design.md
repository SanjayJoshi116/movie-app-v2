## Context

See proposal.md for the gaps. Constraints that shape the fixes:

- **nginx:** every security header is a server-level `add_header`, and `test_nginx_conf.py` fails if any `location` declares one, because that would drop the inherited headers there. The entry page's `no-cache` already comes from a `map $uri` feeding one server-level `Cache-Control` header.
- **nginx startup:** `nginx.conf` proxies to `backend:8000` by name. nginx resolves `proxy_pass` hosts at startup, so the frontend image won't start on its own without that name resolving.
- **ESLint:** the `react-app/jest` config applies Jest and Testing Library rules to every `*.spec.*` file. Pointing ESLint at `e2e/` therefore lints Playwright code as if it were Jest. For example, `page.getByRole` trips `testing-library/prefer-screen-queries`.
- **Playwright browsers:** the npm `@playwright/test` and the pip `playwright` in `e2e/python/requirements.txt` are versioned separately, so they may need different browser builds.

## Goals / Non-Goals

**Goals:**
- Every CI check fails on what it claims to check. Nothing is retried into a pass.
- The deploy config is exercised in CI, through the real built image and the real nginx.
- Compression and caching help the app's own assets without changing API or media behaviour.

**Non-Goals:**
- Adding `eslint-plugin-playwright` (a new dependency). That can come later. The goal here is that `e2e/` is linted at all.
- Pushing images to a registry, or running the backend container in CI. A full stack needs Postgres and secrets, and the backend image is only built.
- Compressing API JSON.

## Decisions

**1. Retries off, traces on failure.**
- `retries: 0` in every environment, and `trace: "retain-on-failure"`. With no retries, `on-first-retry` would never record anything, and the CI artifact upload (already `if: failure()`) is where the trace is needed.
- `webServer.timeout` becomes 300 s, the same budget the Python job gives `wait-on`. A cold CRA compile took over 120 s locally on 2026-10-13.
- Alternative considered: keep 1 retry and fail on "flaky" via the reporter. Rejected: it's more config for the same result, and the `ci-pipeline` spec already says a failing test fails CI.

**2. Lint `e2e/` with a Playwright override instead of a new plugin.**
- The `lint` script becomes `eslint src e2e --ext .ts,.tsx --max-warnings=0`.
- An `overrides` entry in `package.json`'s `eslintConfig` for `e2e/**/*.ts` turns off the `jest/*` and `testing-library/*` rules that misfire on Playwright. The exact set is whatever the first run shows; only rules that fire wrongly get turned off.
- The TypeScript, import and core rules stay on.

**3. Docker job: build both images, smoke-test the frontend one.**
- New job `docker`. It runs `docker build` for `backend/Dockerfile` (context `backend`) and `Dockerfile.frontend` (context `.`), using buildx with the `gha` layer cache.
- It then starts the frontend image with `--add-host backend:127.0.0.1`, so nginx can resolve its upstream and boot.
- `.github/scripts/smoke-frontend.sh` checks it with `curl`:
  - `/` and a deep route (`/movies`): 200, `Cache-Control: no-cache`, CSP and `nosniff` present.
  - The main bundle (its name scraped from `index.html`), requested with `Accept-Encoding: gzip`: `Content-Encoding: gzip`, the immutable `Cache-Control`, and the CSP.
  - A made-up `/static/js/main.deadbeef.js`: 404, with no `immutable`.
- If a check fails, the script prints `docker logs`.
- The backend image is built only, because running it needs Postgres and secrets.
- Alternative considered: `docker compose build`. Rejected, because compose validates `env_file` entries (`.env.docker`, `.env.db`) that only exist on a deploy host.

**4. nginx compression: server-level `gzip`, off for proxied locations.**
- At server level: `gzip on`, `gzip_vary on`, `gzip_min_length 1024`, and `gzip_types` for JavaScript, CSS, JSON, the web manifest and SVG (HTML is always included).
- `gzip off` in `/api/` and `/media/`. Any future static `location` then inherits compression by default, while the proxied paths keep their current behaviour.
- API JSON is left out on purpose. It carries tokens next to request-influenced content, which is the BREACH pattern for TLS compression. Compressing it would be a deliberate Django-side decision, not a side effect of a static-asset fix.

**5. Long-lived caching through a second map and an add_header without `always`.**
- A new `map $uri $static_cache_control`: `~^/static/` → `"public, max-age=31536000, immutable"`, and empty otherwise.
- A second server-level `add_header Cache-Control $static_cache_control;` without `always`. nginx then adds it only to 200/204/206/301/302/303/304/307/308 responses, so a missing chunk's 404 is never cached for a year.
- The existing `$entry_cache_control … always` line is unchanged. The two maps never both produce a value for one URI, and nginx skips an `add_header` whose value is empty, so each response carries at most one `Cache-Control`.
- **Why `/static/` is safe to cache as immutable:** CRA puts only content-hashed files there (`static/js`, `static/css`, `static/media`). Unhashed `public/` files (favicon, manifest, logos) are served from the root and get no long-lived header.
- `test_nginx_conf.py` gains static checks:
  - The static map covers `/static/` only.
  - Its `add_header` is server-level and not `always`.
  - `gzip off` appears in `/api/` and `/media/`.
  - No `location` declares an `add_header` (the existing check).

**6. CI housekeeping.**
- **Playwright cache:** `actions/cache` on `~/.cache/ms-playwright`.
  - The TS job's key comes from `package-lock.json`, and the Python job's from `e2e/python/requirements.txt`, since their browser builds can differ.
  - On a cache hit the job still runs `playwright install-deps chromium` for the system libraries. On a miss it runs `install --with-deps`.
- **Concurrency:** a workflow-level group keyed on the PR number (falling back to the ref), with `cancel-in-progress` only for `pull_request` events, so every commit on `main` keeps its own result.
- **Jest:** the CI step drops `--passWithNoTests`.
- **Ruff:** `target-version = "py312"`. Whatever the new target flags (pyupgrade rules) is fixed in the same change. If a rule would rewrite to PEP 695 generics across many files, that rule is ignored in `pyproject.toml` with a comment, not mass-rewritten.

**7. Test hygiene.**
- **`responsive.spec.ts`:** the page registers a one-shot `scroll` listener before `scrollBy`, then resolves after the scroll event and two animation frames. antd repositions on scroll inside a frame, so the assertion runs after any reposition has happened.
- Rejected: `expect.poll(offset).toEqual(before)`. It would pass on the very first read, before a scroll-handler glitch could show, which is exactly what the assertion exists to catch.
- **`test_ratings.py`:** a single `get_by_role("button", name="Rate")`. The fallback branch never ran usefully, because the button is always named "Rate" when there is no rating.
- **Pagination e2e:** one test in `e2e/watchlist.spec.ts`'s "Watched page" block.
  - The `**/api/watched/**` route answers by the `page` query parameter. Page 1 returns two entries with `next` set, and page 2 returns one entry with `next: null`, both in the `paginated` shape.
  - The test asserts all three titles render, and that both requests carried `page_size=500`.
  - `paginated()` in `e2e/fixtures.ts` gains an optional `next` argument. Every other caller is unchanged.

## Risks / Trade-offs

- **[Risk] Without retries, a genuinely flaky test now fails CI.** → That's the intent. The trace is uploaded for diagnosis, and the fix is to the test's wait, as done here for `responsive.spec.ts`.
- **[Risk] The Docker job adds minutes to CI.** → It runs in parallel with the other jobs, and the `gha` layer cache keeps rebuilds of unchanged layers cheap.
- **[Risk] An `immutable` cache would pin a bad asset if a hashed file name were ever reused with different content.** → CRA's hashes are content hashes, so a different file means a different name.
- **[Risk] Disabling Jest/Testing Library rules for `e2e/` could hide a real issue.** → Only rules that misfire on Playwright code are turned off, and each one is listed in the override.

## Migration Plan

- The nginx changes ship with the next frontend image build. Browsers holding pre-change assets have no long-lived cache entries, so nothing needs purging.
- The CI changes take effect on merge. If the Docker job turns out unreliable, it can be removed alone without affecting the other jobs.
- Rollback: revert. Assets already cached as immutable keep their hashed names, and a new build references new names, so a revert can't serve stale code.
