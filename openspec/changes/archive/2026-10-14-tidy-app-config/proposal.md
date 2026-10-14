## Why

Backlog item 34b, the config half of the fifth audit's infra pass: four small defects in how the app is configured and started. A production deploy that forgets `FRONTEND_URL` mails password-reset links pointing at `localhost:3000`, while every other risky setting already fails closed. `backend/.env.example` doesn't list several settings the backend reads. The Django admin is mounted but unused, undocumented and unreachable through nginx, yet in dev it's an unthrottled password form. A backup restore with long reviews can exceed Django's 2.5 MB request-body limit, and then a whole 500-row chunk is lost. And `npm run dev` works only on the original machine, because `package.json` hardcodes its Python path.

## What Changes

- With debug off, the backend refuses to start when `FRONTEND_URL` is unset, blank or not an absolute `http(s)` URL. A trailing slash is stripped, so reset links never contain `//reset-password`. Dev keeps the `http://localhost:3000` default.
- `backend/.env.example` lists every environment variable the backend reads (`FRONTEND_URL`, `JWT_SIGNING_KEY`, `CONN_MAX_AGE`, `DEFAULT_FROM_EMAIL`, `EMAIL_TIMEOUT` were missing). The database password's Docker-only home (`.env.db`) gets a pointer. A backend test fails when settings read a variable the example doesn't mention.
- **BREAKING (dev only)**: the Django admin is removed: no `admin/` route and no `django.contrib.admin` app. Nothing registers a model with it, and production never routed it. Existing databases keep the unused `django_admin_log` table.
- Bulk imports split each request by encoded body size as well as by row count (at most 500 rows and at most about 2 MB of JSON), so a chunk of long reviews stays under Django's default `DATA_UPLOAD_MAX_MEMORY_SIZE` and nginx's 8 MB. The server limit stays at Django's default.
- `npm run dev`, `npm start` and `npm run django` launch Django through a small Node launcher. It takes the interpreter from `DJANGO_PYTHON` (the environment, then the untracked root `.env`) and otherwise falls back to `python`. A missing interpreter gives an error that names `DJANGO_PYTHON`. The root `.env.example` and README's setup section document it, and no machine path remains in `package.json`.

## Capabilities

### New Capabilities
- `dev-environment`: how a developer configures and starts the local stack: the interpreter setting for `npm run dev`, and env example files that list every setting the backend reads.

### Modified Capabilities
- `api-hardening`: "Production configuration fails closed" also covers an unset or malformed `FRONTEND_URL`. A new requirement says the backend exposes no admin interface.
- `data-backup`: "Large imports and retries work" also holds when rows are large (long reviews), not only when they're many.

## Impact

- Backend: `backend/cinedb/settings.py` (`FRONTEND_URL` check, admin app removed), `backend/cinedb/urls.py` (admin route removed), `backend/.env.example`; tests `test_settings_fail_closed.py` (`FRONTEND_URL` cases; the production env gains `FRONTEND_URL`) and a new env-example coverage test.
- Frontend: `src/api/userApi.ts` (`postBulkChunks` byte budget) and `src/api/__tests__/bulkImport.test.ts`.
- Dev tooling: `package.json` scripts, a new `scripts/run-django.js`, root `.env.example`. The developer's local `.env` needs `DJANGO_PYTHON` set to their Conda env's interpreter (operator step).
- Docs: README (setup, scripts table, env vars), CLAUDE.md (the "Dedicated Conda env" note now points at `DJANGO_PYTHON`), `docs/ARCHITECTURE.md` (the admin and JSON-only bullets, the bulk byte budget), `docs/BUG_BACKLOG.md` status row.
- Docker: no image change. `.env.docker` already sets `FRONTEND_URL`. A deploy without it now fails at startup instead of mailing localhost links.
