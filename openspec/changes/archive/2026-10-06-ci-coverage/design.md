## Context

See proposal.md for the gaps. The current state that shapes the approach:

- **`.github/workflows/ci.yml` has three jobs:**
  - `frontend`: Node 18, Jest, `npm run build` with `CI: false` and a `TMDB_API_KEY` secret.
  - `backend`: ruff, `migrate`, pytest against a Postgres service.
  - `e2e-python`: starts `npx react-scripts start` itself, waits with `wait-on` under `NODE_OPTIONS=--dns-result-order=ipv4first`, then runs `pytest e2e/python`.
- **`playwright.config.ts`'s `webServer` runs `npm start`.** Its `prestart` is `kill-port 3000 8000`, and `start` runs Django through `G:/Anaconda/envs/django/python.exe`. The TS specs mock every API call, so they only ever needed the CRA server.
- **`.env` sets `HOST=0.0.0.0`.** CRA listens on IPv4 only, so on Node ≥17, `localhost` resolving to `::1` first is the known `wait-on` hang. The existing job already works around it.
- **Lint and types today:** `npx eslint src --ext .ts,.tsx` reports exactly one warning (unused `Select` in `WatchedPage.tsx`). The root `tsconfig.json` includes only `src`, so `e2e/*.spec.ts` and `playwright.config.ts` are never typechecked.
- **The e2e mocks don't match the real API:**
  - `fetchAllPages()` accepts a bare array as a one-page response, so mocks returning `[]` pass.
  - Playwright matches routes last-registered-first. That's the mechanism a catch-all relies on: register it first and any specific route overrides it.
- **`usePaginatedFetch` arms its replay guard too late.** It records the consumed `fetchPage`/`retryToken` in the load's `finally`, i.e. after the async fetch settles. StrictMode's dev-only cleanup-and-replay runs synchronously right after the first effect, before that. The guard is still empty, and the first pass was cancelled by its cleanup, so a second full load starts. In production there is no replay.

## Goals / Non-Goals

**Goals:**
- Every check above runs on every push and pull request, and fails loudly.
- Mocks are shaped like the real API, and forgotten mocks are visible.

**Non-Goals:**
- Pinning dependency versions, and the `django<5.0` vs installed-5.2 drift. Those belong to `fix-dependency-drift`.
- Running the e2e suites against a real Django + Postgres stack. Both suites are deliberately mock-only. A real-stack smoke job is a separate decision.
- Making unmocked TMDB proxy calls fail. They get an empty page (D4).
- Fixing double effects that have no guard at all (e.g. `HeroBanner`'s trending fetch under StrictMode). Those are ordinary dev-only double effects whose second result simply wins; nothing is clobbered. Only `usePaginatedFetch` has a guard that is supposed to prevent this, and it's broken.

## Decisions

### D1. CI layout
- **`frontend` job:**
  - Node 22.
  - New `npm run typecheck` → `tsc --noEmit && tsc --noEmit -p e2e/tsconfig.json`.
  - New `npm run lint` → `eslint src --ext .ts,.tsx --max-warnings=0`.
  - The build step keeps `CI: false`, because lint is now its own failing step and the build doesn't need to double up on it. It loses `TMDB_API_KEY`.
- **`backend` job:** `python backend/manage.py makemigrations --check --dry-run` with the same env block as `migrate`.
- **New `e2e-ts` job** (timeout 15 min, same backstop as `e2e-python`):
  - Node 22, `npm ci`, `npx playwright install --with-deps chromium` (both projects are Chromium; Pixel 5 is an emulated device).
  - `npx playwright test` with `NODE_OPTIONS=--dns-result-order=ipv4first`, the existing workaround, which keeps `localhost` and avoids an IP literal.
  - Upload the Playwright report as an artifact on failure.
- **`e2e-python`:** Node 22.

*Alternative:* fold the TS suite into the `e2e-python` job to share one dev server. Rejected: separate jobs run in parallel and report separately, and a CRA start is ~1 min.

### D2. Playwright starts only the frontend
`webServer.command` becomes `npx react-scripts start` with `env: { BROWSER: "none" }`. `reuseExistingServer: !process.env.CI`: locally it reuses an `npm run dev` that's already running; in CI it always starts fresh.

Add `e2e/tsconfig.json` (extends the root config, `include: ["./**/*.ts", "../playwright.config.ts"]`, `types: ["node"]`) so D1's typecheck covers the specs.

### D3. TS fixtures via `test.extend`
New `e2e/fixtures.ts` exports a `test` and `expect` built with `test.extend`:
- **`unmocked`, an auto fixture:**
  - Registers `**/api/**` before anything else. An app API request reaching it is recorded and answered with `501 {"detail": "unmocked: <url>"}`.
  - `/api/tmdb/**` requests reaching it get `{results: [], total_pages: 1, total_results: 0, page: 1}`.
  - At teardown it fails the test listing every recorded URL.
- **`paginated(items)`**: returns `{count, next: null, previous: null, results: items}`.
- **`mockAuthedBase(page)`**: the one copy of the authenticated-page base mocks:
  - library endpoints with trailing `**`, returning `paginated([])`
  - `followed-people/**`
  - the notifications poll `**/api/notifications/new-releases/**`
  - `**/api/notifications/mark-seen/**` → 204

All four specs import `test`/`expect` from `./fixtures` and use `mockAuthedBase` instead of their own copies. `auth.spec.ts` keeps its deliberate `**/api/**` → 401 for unauthenticated flows. It's registered after the catch-all, so it wins, and nothing reaches the catch-all in those tests.

### D4. Python fixtures mirror D3
`e2e/python/conftest.py`:
- adds `paginated(items)`
- `mock_base_django_routes` returns it for the library endpoints and also mocks `followed-people` and `mark-seen`
- `authed_page` registers the catch-all first (same split: app API → 501 + recorded, TMDB → empty page) and asserts the record is empty at teardown

Tests that the catch-all exposes get the missing mock added. The catch-all isn't loosened to make them pass.

### D5. Stale TS tests
- **`auth.spec.ts`:** use `getByLabel("Password", { exact: true })` wherever a page has both Password and Confirm Password, and the short-password test expects "At least 8 characters" (`RegisterPage` rule `min: 8`).
- **`movies.spec.ts` search test:** branch on the project, via `testInfo.project.name === "mobile-chrome"`:
  - mobile: click the bottom nav's `Search` button, then fill the `SearchBox` it opens
  - desktop: fill the sidebar box
  - The CSS-only breakpoint rule stays intact (the test picks, the app doesn't).

### D6. `usePaginatedFetch` replay guard arms at start
Keep a ref `inflightRef = { fetchPage, retryToken, ctl: { cancelled: boolean }, done: boolean }`. At the top of the mount effect:
1. **Same `fetchPage` + `retryToken`, not done** (the StrictMode replay during the first load): set `ctl.cancelled = false` to revive the first pass, and return a cleanup that cancels it again. That cleanup matters: a real unmount after the replay must still cancel.
2. **Same `fetchPage` + `retryToken`, done:** return (today's guard, unchanged in effect).
3. **Otherwise:** a real change. Create a new `ctl`, set `inflightRef` *before* starting `load()`, and have `load()` check `ctl.cancelled`. `done = true` is set in `finally`. The existing `generationRef` stale-`loadMore` protection is untouched.

Within one component instance, an effect re-run with an identical `fetchPage` and `retryToken` can only be StrictMode's replay, the same assumption the current guard (documented in CLAUDE.md) already makes. A remount is a new instance with fresh refs.

*Alternative:* drop the guard and accept double fetches in dev. Rejected: the guard exists because the replay clobbered restores (CLAUDE.md), and it's this guard's own timing bug.

### D7. Missing tests (what "covered" means)
- **Backend** (`backend/userdata/tests/`):
  - **lists** (`test_lists.py`): create, rename, delete, add item, duplicate add, remove item, clear; another user's list → 404 on every route.
  - **followed people** (`test_followed_people.py`): follow, follow again is idempotent (200), unfollow, unfollow a missing person is 204, list.
  - **episode progress** (`test_episode_progress.py`): GET none → `null`, POST/PATCH round trip, DELETE.
  - **profile** (`test_profile.py`): GET own profile, PATCH names, rename collision → 400.
  - **recommendations** (`test_recommendations_api.py`): for-you and personalized return `pending` and start a refresh on a cold cache, and `ready` with sections from a warm cache. TMDB and the refresh thread are mocked.
- **Frontend:**
  - `src/context/__tests__/FollowedPeopleContext.test.tsx`: no fetch until the first consumer, one fetch shared by two consumers, and follow/unfollow updates both.
  - `src/hooks/__tests__/useEpisodeProgress.test.ts`: loads, resets on `showId` change, ignores a stale response.
  - `usePaginatedFetch.test.tsx` gains StrictMode cases (D6).

## Risks / Trade-offs

- **[The strict catch-all fails existing tests that relied on unmocked calls]** → Intended. Each one is a real fixture gap. Tasks include running both suites and adding the missing mocks. Expect a handful, concentrated in detail-page and person tests.
- **[A longer CI run]** → The new jobs run in parallel with the existing ones, so wall time grows by roughly one CRA start plus the TS suite, not the sum.
- **[Mobile-project flakiness in CI]** → `retries: 2` under `CI` already exists in `playwright.config.ts`, and traces are captured on the first retry.
- **[D6 reasoning is subtle]** → It's covered by unit tests that render under `<React.StrictMode>`:
  - restore with 3 pages → 3 calls
  - fresh load → 1 call
  - unmount during a pending load → no state update after unmount
  - `fetchPage` identity change → new load

  The browse Back restore e2e test (`test_browser_back_restores_category`) also still passes.
- **[`reuseExistingServer` locally could pick up a stale server]** → Same as today. It's documented in the config comment.

## Migration Plan

CI-only and test-only, apart from D6 and the one lint fix. Merge as one PR. If the new `e2e-ts` job proves flaky, it can be marked `continue-on-error` temporarily without reverting the rest. Rolling back is a revert.

## Open Questions

- Should `e2e-ts` be a required status check on `main`? It's a repository setting, not code, so it's left to the repo owner after a few green runs.
