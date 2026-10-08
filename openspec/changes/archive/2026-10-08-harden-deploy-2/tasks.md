Same rule as `honest-tests`: a task that adds or changes a test is done only when that test has been shown to fail against a temporary break of the behavior it covers, then the break was reverted. Infra checks that can't run locally (Docker, nginx) are recorded as waived, with the reason.

## 1. Dependencies (I1, I8)

- [x] 1.1 Bump `axios` → ^1.20 and `react-router-dom` → ^6.30.4, then `npm install`
- [x] 1.2 Uninstall `json2csv`, `file-saver`, `@types/file-saver` and `@testing-library/user-event`. Move `concurrently` and `@testing-library/*` to `devDependencies`. Check that `Dockerfile.frontend`'s install still has what the build needs
- [x] 1.3 `npm ls axios react-router-dom @remix-run/router` shows the new versions. Run `npm audit --omit=dev` and record the before/after counts in the task note
  - Versions: axios 1.20.0, react-router-dom/react-router 6.30.6, @remix-run/router 1.23.4 (was 1.7.2 / 6.24.1 / 1.17.1). npm resolved `concurrently` to ^9.2.5 while moving it.
  - `npm audit --omit=dev`, 2026-10-08: before 77 (5 critical, 45 high, 16 moderate, 11 low), after 72 (3 critical, 41 high, 17 moderate, 11 low). Most of the rest is CRA's `react-scripts` tree, which sits in `dependencies` but never ships in the bundle.
  - Still open, accepted: react-router GHSA-wrjc-x8rr-h8h6 (backslash open redirect in `<Link>`/`useNavigate`) and GHSA-337j-9hxr-rhxg (SSR hydration) are fixed only in v7.18, a major upgrade this change rules out. The SSR one doesn't apply to a client-only SPA. The redirect one needs an attacker-controlled navigation target, and the app navigates only to its own route strings. The critical `form-data` 3.0.x is under `react-scripts`'s jest (dev-only); axios uses form-data 4.0.6.
- [x] 1.4 Run `npm run typecheck`, `npm run lint`, Jest and `npm run build`. Check the browser console on one live page for new React Router warnings. Both e2e suites run once, in 7.3, over the bumped deps plus every later change. Running them here too would cover the same code twice
  - typecheck and lint clean, Jest 27 suites / 199 tests, `npm run build` (with `INLINE_RUNTIME_CHUNK=false`) compiles with no inline `<script>`. A first build showed 2 bogus `no-unused-vars` warnings in `NotificationBell.tsx` from a stale `node_modules/.cache` ESLint cache, gone after clearing it.
  - Console on `/login`, `/register`, `/movie/550` (dev server): two new React Router 6.28+ future-flag warnings (`v7_startTransition`, `v7_relativeSplatPath`), dev-only, no errors. Not opted in: `v7_startTransition` changes render timing (risk to the `usePaginatedFetch` StrictMode restore guard), which is out of scope for a same-major bump. Left as a follow-up decision.

## 2. Redeploy blank page (I2)

- [x] 2.1 `nginx.conf`:
  - a `map $uri $entry_cache_control`
  - a server-level `add_header Cache-Control $entry_cache_control always;`
  - `location /static/ { try_files $uri =404; }`
  - no location-level `add_header`
- [x] 2.2 Static check (pytest or node test):
  - `nginx.conf` has no `add_header` inside any `location` block
  - `/static/` uses `=404`
  - Done as `backend/userdata/tests/test_nginx_conf.py` (also checks the entry-page map and that the security headers stay server-level). Fail-checked: an `add_header` in `/static/`, `/static/` falling back to `index.html`, a removed `Cache-Control` line, and a wrong map value each fail it.
- [x] 2.3 Where Docker is available: `nginx -t` in the frontend image, then curl `/` (`Cache-Control: no-cache` + CSP), `/static/js/missing.js` (404) and `/static/<real chunk>` (200 + CSP). Otherwise record as waived
  - **Waived 2026-10-08:** neither Docker nor nginx is installed on this machine (same as `harden-docker` section 6). The config is checked statically by `test_nginx_conf.py`. `nginx -t` and the three curls are unverified until the first Docker deploy.

## 3. CI and Node (I3, notes)

- [x] 3.1 Pin `ruff` in `backend/requirements-test.txt` and regenerate `constraints.txt` with the command in its header. The CI backend job installs ruff from there, and the bare `pip install ruff` is removed
  - Pinned `ruff==0.15.16` (the version installed locally). ruff has no Python dependencies, so regenerating `constraints.txt` comes down to adding that one line in alphabetical order, which is what a fresh-venv `pip freeze` would produce. CI now lints after the pinned install.
- [x] 3.2 CI frontend build: `INLINE_RUNTIME_CHUNK: "false"`
- [x] 3.3 Add `.nvmrc` (`22`) and `engines.node: ">=22 <23"`
  - The local machine runs Node 24.20, so npm prints an `EBADENGINE` warning. That's expected: no `engine-strict`, by design.
- [x] 3.4 Extend `test_dependency_versions.py` (or a sibling) so it fails if the installed ruff differs from the pin. Fail-check it by editing the pin
  - Added `RuffVersionTests` (installed ruff == the requirements-test pin == the constraints pin). Fail-checked by editing the pin in each file.

## 4. Compose and image (I5, I6, I7)

- [x] 4.1 Compose services:
  - db: `env_file: .env.db` (keeping the `POSTGRES_DB`/`POSTGRES_USER` literals)
  - backend: `env_file: [.env.docker, .env.db]`
- [x] 4.1b `settings.py`: `DB_PASSWORD` falls back to `POSTGRES_PASSWORD`. Add a pytest that sets only `POSTGRES_PASSWORD` and asserts `DATABASES["default"]["PASSWORD"]`. Fail-check it by removing the fallback
  - Added `DatabasePasswordSettingsTests` (fresh interpreter, dotenv off): POSTGRES_PASSWORD alone is used, DB_PASSWORD wins when both are set, neither gives "". Fail-checked by removing the fallback.
- [x] 4.2 backend: `TRUSTED_PROXY_COUNT: "${TRUSTED_PROXY_COUNT:-1}"`
- [x] 4.3 Ignore files:
  - `backend/.dockerignore` and the root `.dockerignore`: `.env.*`, `!.env.example`, `!.env.db.example` and `*.env.bak`
  - `.gitignore`: `!.env.db.example`
  - add `.env.db.example` (`POSTGRES_PASSWORD=`)
- [x] 4.4 README, `.env.example` and the `.env.docker` template:
  - create `.env.db` from `.env.db.example`
  - an upgrade note: move `POSTGRES_PASSWORD` there and remove both password keys from `.env.docker`
  - plain `docker compose up`
  - The operator step was **not** applied to this machine's own `.env.docker`, which holds real secrets and is never edited by Claude. Until it's done, `docker compose up` here fails with a missing `.env.db` error.
- [x] 4.5 Verify with plain `docker compose config` (using example-filled env files):
  - db env is only `POSTGRES_*`
  - backend gets the password from `.env.db`
  - without `.env.db`, compose errors and names the file
  - `TRUSTED_PROXY_COUNT` defaults to 1, and an override is honored
  - record as waived if Docker isn't available

  - **Waived 2026-10-08:** Docker isn't installed on this machine. Checked statically instead: the YAML parses, the db gets `env_file: .env.db` plus only the `POSTGRES_DB`/`POSTGRES_USER` literals, and the backend gets `[.env.docker, .env.db]` and `TRUSTED_PROXY_COUNT: "${TRUSTED_PROXY_COUNT:-1}"`. Interpolation, the missing-file error and the override are unverified until the first Docker deploy.
## 5. TMDB proxy per user (F6)

- [x] 5.1 `useValidId()` (positive int ≤ INT32_MAX) in `MovieDetailPage`, `TVDetailPage` and `PersonPage`. An invalid id shows the not-found page and makes no fetch
  - `src/hooks/useValidId.ts` (`parseTmdbId` + `useValidId`). The pages render `NotFoundPage` after their hooks, and the fetch effect's existing `if (!id) return` skips the load.
- [x] 5.2 TS e2e: `/movie/abc`, `/person/-3` and `/movie/..%2F..%2Fwatchlist` show not-found, and no request goes to `/api/watchlist/` or `/api/tmdb/**` for that id
  - `e2e/route-ids.spec.ts`: `/movie/abc`, `/person/-3`, `/tv/0`, `/movie/2147483648`, `/movie/..%2F..%2Fwatchlist`, signed in, both projects. Fail-checked with validation removed: it fails on the not-found assertion, and with that assertion also dropped, on the request check alone. The traversal really produced `GET /api/watchlist?append_to_response=…` (the bug, reproduced).
- [x] 5.3 `src/api/tmdb.ts`:
  - request interceptor attaches the Bearer token when present
  - response interceptor retries a 401 once without the header
  - never logs out, never refreshes
  - Typed via a `declare module "axios"` augmentation (`_noAuthRetry`). The request interceptor skips the token on the retry, otherwise it would re-add the header.
- [x] 5.4 Jest (`api/__tests__/tmdb.test.ts`):
  - token attached when stored
  - a 401 retries once without the token and resolves
  - a second 401 rejects
  - storage and location are untouched (no logout)
  - `src/api/__tests__/tmdb.test.ts` (5 tests). Fail-checked: no token attached, no 401 retry, the retry keeping the token, and a `localStorage.clear()` on 401 each fail it.
- [x] 5.5 Backend pytest: two authenticated users behind the same IP each get their own `tmdb_proxy` throttle bucket (patch the rate low). Signed-out requests share the IP bucket

  - `TmdbProxyThrottleIdentityTests` in `test_tmdb_proxy.py` (real JWTs, `rate` patched to 2/min, one synthetic shared address). Fail-checked: an IP-only cache key fails the per-user test, and exempting signed-out requests fails the shared-IP test. The backend already keyed per user; the client sending the token is what makes it apply.
## 6. CSV (S3) and links (S5)

- [x] 6.1 `export.ts` `escape()`: prefix `'` on `/^[=+\-@\t\r']/`. `csvParse.parseCSV`: strip one `'` from cells matching `/^'[=+\-@\t\r']/`
- [x] 6.2 Jest:
  - export/parse round trip for `=SUM(1)`, `-x`, `@a`, `'Salem's Lot`, `''x` and a tab-leading value
  - an old-format backup cell `'Salem's Lot` imports unchanged
  - the existing `backup.test.ts` stays green
  - `src/utils/__tests__/csvNeutralize.test.ts` (each exported cell, a raw `parseCSV` round trip including CR/tab-leading values and a numeric `-1`, an old-format `'Salem's Lot` / `'Til Death`, a backup zip round trip). `backup.test.ts` and `csvParse.test.ts` stay green. Fail-checked: no export prefix, no import strip, stripping any leading `'`, and not doubling an existing `'` each fail it.
- [x] 6.3 `utils/safeUrl.ts` `safeHttpUrl()`. `PersonPage` renders the homepage link only through it
- [x] 6.4 Jest for `safeHttpUrl` (`javascript:`, `data:`, relative, `https:`), plus a TS e2e person page with a `javascript:` homepage that shows no `a[href^="javascript"]`

  - `safeUrl.test.ts` (12 cases) and `e2e/untrusted-links.spec.ts` (`javascript:` homepage shown as text with no `a[href^="javascript"]`; an https one is a `_blank` link). Fail-checked by making `safeHttpUrl` accept any scheme (Jest + e2e) and resolve relative URLs (Jest). The first attempted e2e break (changing only the link branch) didn't fail it, because a `javascript:` value never reaches that branch, so the break was moved into the helper.
## 7. Docs and verification

- [x] 7.1 CLAUDE.md:
  - Docker bullet: `/static/` 404, `index.html` no-cache, the db password lives only in `.env.db`
  - CSV bullet: the export prefix and import strip
  - TMDB proxy bullet: the client sends the JWT, with a 401 retry without it
  - Stack: Node 22 / `.nvmrc`
- [x] 7.2 `docs/ARCHITECTURE.md`: bullets for the entry-page caching, the TMDB-client token policy and CSV neutralization
  - Also added a "Third-party URLs" bullet for `safeHttpUrl`.
- [x] 7.3 Final runs: typecheck, lint, Jest, backend pytest, ruff (pinned), `makemigrations --check`, `npm run build` with `INLINE_RUNTIME_CHUNK=false`, both e2e suites (the only e2e run for this change, covering the 1.4 dependency bumps too; one suite at a time, TS with `--workers=2`)
  - Results, 2026-10-08: typecheck and lint clean. Jest 30 suites / 220 tests. `ruff check backend/` (pinned 0.15.16) and `makemigrations --check` clean. `npm run build` with `INLINE_RUNTIME_CHUNK=false` compiles, with no inline `<script>`. TS Playwright 143 passed, 3 skipped (both projects). Python e2e 200 passed (13 files).
  - Backend pytest first ran 269 passed, 1 failed: `CrossProcessStatusTests::test_stamp_set_on_start_and_cleared_when_finished` from `harden-backend-2`, failing 2 of 5 runs. Cause: a real bug. On Windows' coarse clock the refresh start stamp and `finished_at` can be the same instant, so `refreshing_since__lt=finished_at` never cleared that run's own stamp, and the status stayed `pending` for up to 10 minutes. Fixed to `__lte` (with a comment, and ARCHITECTURE.md updated); 8 of 8 reruns and the whole refresh file pass. The other 269 tests are unaffected.
  - Load flakes on this 5.9 GB machine (1.5 GB free): a single-worker TS run had 7 failures, all 30s timeouts, and all 7 passed on `--last-failed`. Python e2e as one run, and then 5 of 13 files run individually, hit pytest-timeout's thread-mode kill on random tests (`test_detail.py` passed alone, then timed out a minute later). Each of those files passed on its own retry. No assertion failed anywhere.
- [x] 7.4 `docs/BUG_BACKLOG.md`:
  - item 14 → 📝 now, ✅ on archive
  - close the two (14) open decisions as decided 2026-10-08
  - the Anaconda env drift note stays a one-line operator command
