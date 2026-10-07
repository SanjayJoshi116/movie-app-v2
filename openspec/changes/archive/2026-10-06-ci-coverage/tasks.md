## 1. Local scripts and config

- [x] 1.1 `package.json`: add `typecheck` (`tsc --noEmit && tsc --noEmit -p e2e/tsconfig.json`) and `lint` (`eslint src --ext .ts,.tsx --max-warnings=0`) scripts
- [x] 1.2 Add `e2e/tsconfig.json` (extends root; includes `e2e/**/*.ts` and `../playwright.config.ts`); run `npm run typecheck` and fix any spec type errors it surfaces
- [x] 1.3 Fix the one existing lint warning (unused `Select` in `src/pages/WatchedPage.tsx`); `npm run lint` passes
- [x] 1.4 `playwright.config.ts`: `webServer.command` → `npx react-scripts start`, `env: { BROWSER: "none" }`, `reuseExistingServer: !process.env.CI`; comment why it starts only the frontend

## 2. TS e2e fixtures and stale tests

- [x] 2.1 Add `e2e/fixtures.ts`: `test.extend` with auto `unmocked` catch-all (app API → 501 + recorded, `/api/tmdb/**` → empty page, teardown fails listing URLs), `paginated()`, `mockAuthedBase(page)` (library endpoints with trailing `**`, followed-people, notifications poll with `**`, mark-seen → 204)
- [x] 2.2 Switch `auth`, `movies`, `responsive`, `watchlist` specs to import `test`/`expect` from `./fixtures` and use `mockAuthedBase`; replace bare `[]` library mocks with `paginated(...)` (including per-test overrides like watchlist items)
- [x] 2.3 `auth.spec.ts`: `getByLabel("Password", { exact: true })` where Confirm Password is present; short-password test expects "At least 8 characters"
- [x] 2.4 `movies.spec.ts` search test: mobile-chrome opens the bottom-nav Search and fills that box; desktop fills the sidebar box
- [x] 2.5 Start the frontend (`npx react-scripts start` with `BROWSER=none`, or `npm run dev`), run `npx playwright test`; add any mock the catch-all reports; all tests pass on both projects

## 3. Python e2e fixtures

- [x] 3.1 `e2e/python/conftest.py`: `paginated()` helper; `mock_base_django_routes` returns it for library endpoints and also mocks `followed-people` and `notifications/mark-seen`
- [x] 3.2 `authed_page`: register the catch-all first (app API → 501 + recorded, TMDB → empty page), assert nothing recorded at teardown with the URLs in the message
- [x] 3.3 Update tests whose per-test library mocks return bare lists to `paginated(...)`
- [x] 3.4 Run `G:/Anaconda/envs/django/python.exe -m pytest e2e/python` with the frontend running; add each mock the catch-all reports; suite green

## 4. `usePaginatedFetch` replay guard

- [x] 4.1 Arm the guard at load start with an `inflightRef` (`fetchPage`, `retryToken`, `ctl`, `done`): revive an in-flight load on an identical replay (returning a cleanup that cancels it), skip a completed identical one, start fresh otherwise
- [x] 4.2 `usePaginatedFetch.test.tsx`: under `<React.StrictMode>` — fresh load calls page 1 once; 3-page restore calls pages 1–3 once each; unmount during a pending load sets no state afterwards; `fetchPage` identity change starts a new load; existing tests still pass
- [x] 4.3 Live check under `npm run dev` with a throwaway `verify_*.py`: open Movies, pick Top Rated, load 3 pages, open a movie, go Back — each `top_rated?page=N` requested once; fresh `/movies` visit requests page 1 once. Delete the script afterwards

## 5. Missing tests

- [x] 5.1 Backend `test_lists.py`: create/rename/delete list, add/duplicate-add/remove/clear items, another user's list → 404 on each route
- [x] 5.2 Backend `test_followed_people.py`: follow, idempotent re-follow (200), unfollow, unfollow missing (204), list
- [x] 5.3 Backend `test_episode_progress.py`: GET none → null, POST then PATCH round trip, DELETE
- [x] 5.4 Backend `test_profile.py`: GET own profile, PATCH names, username collision → 400
- [x] 5.5 Backend `test_recommendations_api.py`: for-you and personalized return `pending` + start a refresh on a cold cache, `ready` with sections from a warm cache (TMDB and the refresh thread mocked)
- [x] 5.6 Frontend `FollowedPeopleContext.test.tsx`: lazy first fetch, one fetch shared by two consumers, follow/unfollow visible to both
- [x] 5.7 Frontend `useEpisodeProgress.test.ts`: load, reset on `showId` change, stale response ignored

## 6. CI workflow

- [x] 6.1 `frontend` job: Node 22; add `npm run typecheck` and `npm run lint` steps; remove `TMDB_API_KEY` from the build env
- [x] 6.2 `backend` job: add `makemigrations --check --dry-run` with the migrate env block
- [x] 6.3 New `e2e-ts` job: Node 22, `npm ci`, `npx playwright install --with-deps chromium`, `npx playwright test` with `CI=true` and `NODE_OPTIONS=--dns-result-order=ipv4first`, `timeout-minutes: 15`, upload `playwright-report/` on failure
- [x] 6.4 `e2e-python` job: Node 22
- [x] 6.5 Validate the workflow file syntax (e.g. `npx --yes action-validator` or a YAML parse) since it can't run locally; note in the summary that the first real run happens on push

## 7. Verification and docs

- [x] 7.1 Full local run: `npm run typecheck`, `npm run lint`, Jest, backend pytest, `makemigrations --check --dry-run`, TS Playwright (both projects), Python e2e — all green
- [x] 7.2 Update CLAUDE.md's Verification section: new `typecheck`/`lint` scripts, `e2e/fixtures.ts` + catch-all convention (new tests import from `./fixtures`; paginated mocks), Playwright starting only the frontend; update the existing e2e-mock bullets that this supersedes
- [x] 7.3 Add a `docs/ARCHITECTURE.md` bullet for the replay-guard fix (D6) and the strict catch-all rationale (D3/D4)
