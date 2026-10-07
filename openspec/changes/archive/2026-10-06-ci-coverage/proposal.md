## Why

CI checks less than it looks like it does, and some of what it does check runs against fake data shaped differently from the real API. Examples:
- The TypeScript Playwright suite (`e2e/*.spec.ts`) never runs in CI. It can't: `playwright.config.ts` starts the app through `npm start`, which runs `kill-port` and a hardcoded `G:/Anaconda` Python. Three of its tests fail locally against the current UI, and nothing noticed.
- No CI step fails on a TypeScript error, an eslint warning, or a model change without a migration. `npm run build` runs with `CI: false`, so lint warnings don't fail it either.
- e2e mocks return a bare `[]` for watchlist, watched, ratings and lists. The real API returns paginated `{count, next, results}`. `fetchAllPages()` happens to accept both, so the tests pass on a response shape production never sends.
- Lists, followed people, episode progress, the profile endpoint and the recommendation endpoints have only edge-case validation tests. Nothing covers their normal create, read, update and delete paths, or that one user can't touch another user's rows.

This is the CI part of item 7 in `docs/BUG_BACKLOG.md`. The rest of item 7 is split into sibling changes: `fix-dependency-drift`, `frontend-polish`, `a11y-routing` and `harden-docker`.

## What Changes

One rule: **if CI is green, the TypeScript compiles, lint is clean, migrations are in sync, and both e2e suites passed against mocks shaped like the real API.**

### CI pipeline
- **Frontend job:** add `tsc --noEmit` (app plus e2e specs) and `eslint --max-warnings=0` steps. Remove the dead `TMDB_API_KEY` from the build env (CRA only exposes `REACT_APP_*`, so the key never reached the bundle).
- **Backend job:** add `manage.py makemigrations --check --dry-run`.
- **New `e2e-ts` job:** runs the TypeScript Playwright suite (chromium and mobile-chrome projects) against the CRA dev server only, with every API call mocked. This mirrors the existing `e2e-python` job. `playwright.config.ts` starts the frontend with `react-scripts start` directly: no `kill-port`, no machine-specific paths.
- **Node 22 LTS** in every job (Node 18 is end of life).

### e2e fixtures
- Mocks for list endpoints return the real paginated shape, through one shared helper per suite.
- Every authenticated e2e test has a catch-all API route registered first. An API call the test didn't mock gets a clear "unmocked" error, and the test fails with the URL listed, instead of silently falling through to a missing backend or a login redirect.
- TS specs mock `notifications/mark-seen/`, and the notifications route gets the trailing `**`.

### Stale tests
- `e2e/auth.spec.ts`: Password fields are targeted exactly (`getByLabel("Password", { exact: true })`), and the short-password test expects the register page's current message.
- `e2e/movies.spec.ts`: the search test types into the search box that's visible at the current viewport (sidebar on desktop, the phone layout's search entry on mobile-chrome), not the hidden sidebar input.

### Missing tests
- **Backend:** CRUD and ownership tests for lists (and list items), followed people, episode progress, the profile endpoint, and the recommendation endpoints (pending → ready status and response shape).
- **Frontend:** unit tests for `FollowedPeopleProvider` (lazy fetch, shared state) and `useEpisodeProgress`.

### Dev-only double restore fetch
- `usePaginatedFetch`'s StrictMode replay guard only arms after the first load *finishes*. The dev-only replay runs before that, so every first load (and every Back-restore) fetched each page twice under `npm run dev`. The guard now arms when the load *starts*, and a replay picks the in-flight load back up instead of starting another. Production builds never replayed, so their behavior doesn't change.

## Capabilities

### New Capabilities
- `ci-pipeline`: what a green CI run guarantees, i.e. which checks run on every push and pull request and what makes each one fail.
- `e2e-fixtures`: how e2e tests stand in for the backend. Covers response shapes matching the real API, and unmocked calls failing loudly.

### Modified Capabilities
- `view-state-restore`: adds a requirement that loading or restoring a paginated page requests each page once.

## Impact

- **CI:** `.github/workflows/ci.yml` gets new steps plus a new job, so CI time grows by roughly the length of the TS e2e job.
- **Config:** `playwright.config.ts`. A new `e2e/tsconfig.json` is added so specs get typechecked.
- **e2e:**
  - new `e2e/fixtures.ts`
  - all four `e2e/*.spec.ts` specs
  - `e2e/python/conftest.py` (paginated helper and catch-all), plus any Python tests that the new catch-all shows are missing a mock
- **Frontend:**
  - `src/hooks/usePaginatedFetch.ts` (replay guard)
  - `src/pages/WatchedPage.tsx` (the one existing eslint warning)
  - new tests under `src/context/__tests__/` and `src/hooks/__tests__/`
- **Backend:** new test modules only, no app code.
- **Local dev:** `npm run dev`/`npm start` are unchanged. Running `npx playwright test` locally now starts only the frontend (or reuses a running one), which is all the mocked specs need.
