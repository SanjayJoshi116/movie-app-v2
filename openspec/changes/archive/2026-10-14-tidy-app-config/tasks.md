## 1. FRONTEND_URL fails closed

- [x] 1.1 In `backend/cinedb/settings.py`, with debug off, require `FRONTEND_URL` to be set, non-blank and an absolute `http`/`https` URL with a host (`urlsplit`), else raise `ImproperlyConfigured` naming `FRONTEND_URL`. Keep the `http://localhost:3000` default under debug, and `rstrip("/")` in both modes.
- [x] 1.2 In `test_settings_fail_closed.py`: add `FRONTEND_URL` to `PROD` and to the stripped-env list; add cases for unset, blank, no scheme, `ftp://`, a valid `https://…/` (starts, trailing slash stripped) and debug with it unset (default).
- [x] 1.3 Add a reset-email test: with `FRONTEND_URL=https://cinedb.example.com/` (override_settings after the strip, or a settings re-import), the link starts with `https://cinedb.example.com/reset-password/`.

## 2. Remove the Django admin

- [x] 2.1 Remove the `admin/` route and import from `backend/cinedb/urls.py`, and `django.contrib.admin` from `INSTALLED_APPS`. Update the `STATIC_ROOT` comment, which mentions admin.
- [x] 2.2 Add a test: `GET /admin/` and `/admin/login/` return 404. Run `makemigrations --check --dry-run` (with `DEBUG=True`, using the project's Django env interpreter) to confirm no migration is needed.

## 3. Bulk imports bounded by body size

- [x] 3.1 In `src/api/userApi.ts`, add `BULK_MAX_BYTES = 2_000_000` and make `postBulkChunks` build chunks greedily under both `BULK_CHUNK_SIZE` and the byte budget (UTF-8 length of `JSON.stringify(entry)` + commas + the wrapper allowance). One entry is never split, and `guard.check()` still runs before each request. Update the doc comments.
- [x] 3.2 In `src/api/__tests__/bulkImport.test.ts`, test that 500 ratings with 5,000-emoji reviews go out in several requests, each body ≤ `BULK_MAX_BYTES`, with every entry sent exactly once and in order, and that the counts sum. Existing 500-row chunk tests stay green.

## 4. Dev interpreter from DJANGO_PYTHON

- [x] 4.1 Add `scripts/run-django.js`: resolve the interpreter from env `DJANGO_PYTHON`, then the root `.env` line, then `python`. Print which interpreter it uses, spawn `backend/start.py` with inherited stdio and extra args passed through, forward SIGINT/SIGTERM, exit with the child's code, and on ENOENT exit 1 with a message naming `DJANGO_PYTHON` and the value.
- [x] 4.2 Point `package.json`'s `start`, `dev` and `django` scripts at `node scripts/run-django.js`. No machine path may remain in `package.json` or the live docs (archived changes and the backlog's bug record keep it as history).
- [x] 4.3 Document `DJANGO_PYTHON` in the root `.env.example`. Operator step, not committed: add `DJANGO_PYTHON` to the local root `.env` with the project's Conda env interpreter, then confirm `npm run dev` boots Django and `npm run django` exits non-zero with the clear message for a bogus value.
- [x] 4.4 Check that `scripts/` stays out of the frontend image's build context if it isn't needed there (root `.dockerignore`), and that `npm run lint`/`typecheck` don't need to cover a plain `.js` script outside `src`/`e2e`.

## 5. Env examples cover every setting

- [x] 5.1 Add `FRONTEND_URL` (required with debug off), `JWT_SIGNING_KEY`, `CONN_MAX_AGE`, `DEFAULT_FROM_EMAIL`, `EMAIL_TIMEOUT` to `backend/.env.example` with defaults noted, plus a `POSTGRES_PASSWORD` comment pointing at `.env.db`.
- [x] 5.2 Add a backend test that scans `backend/cinedb/settings.py` for environment reads and fails, naming the variable, when one is missing from `backend/.env.example`.

## 6. Docs and verification

- [x] 6.1 README: setup step for `DJANGO_PYTHON`, the scripts table, `FRONTEND_URL` marked required with debug off in the env-vars block, and the stale "Start all three servers" wording. CLAUDE.md: the dedicated-Conda-env sentence names `DJANGO_PYTHON`. `docs/ARCHITECTURE.md`: admin removed (update the JSON-only bullet), the bulk byte budget, the `FRONTEND_URL` fail-closed check. CHANGELOG `[Unreleased]`: an upgrade note for `FRONTEND_URL`.
- [x] 6.2 `docs/BUG_BACKLOG.md`: name 34b `tidy-app-config` in the status table and the item 34 heading.
- [x] 6.3 Run backend pytest, `ruff check backend/`, `makemigrations --check --dry-run`, `npm run typecheck`, `npm run lint` and the Jest `bulkImport` tests. No e2e specs are touched, so skip Playwright.
