## Why

Backlog item 14 (2026-10-07 audit, re-checked 2026-10-08). This is the last open audit item. It covers:
- runtime dependencies with known advisories
- a redeploy that can leave users on a blank page
- an unpinned linter that can fail CI on unchanged code
- deploy config that leaks secrets to the db container or makes every user share one throttle bucket
- TMDB proxy calls throttled per IP instead of per user
- CSV exports that run as formulas in Excel
- a third-party URL rendered as a raw link

## What Changes

- **Dependencies (I1, I8):**
  - bump `axios` to ^1.20 and `react-router-dom` to ^6.30.4 (same majors)
  - remove unused `json2csv`, `file-saver`, `@types/file-saver` and `@testing-library/user-event`
  - move `concurrently` and `@testing-library/*` to `devDependencies`
  - update the lockfile
- **Redeploy blank page (I2):**
  - `nginx.conf` serves `/static/` with `try_files $uri =404`, so a missing old chunk is a 404, not `index.html`
  - `index.html` gets `Cache-Control: no-cache` through a `map` on the URI plus a server-level `add_header`, so no location loses the inherited security headers
- **CI (I3 and notes):**
  - pin `ruff` in `backend/requirements-test.txt` (and `constraints.txt`), and install it from there in CI
  - CI's `npm run build` sets `INLINE_RUNTIME_CHUNK=false`, so CI builds the CSP bundle that actually ships
  - add `.nvmrc` (`22`) and `engines.node: ">=22 <23"`. Decided 2026-10-08: Node 22, matching CI and Docker
- **Compose and image (I5, I6, I7):**
  - `TRUSTED_PROXY_COUNT: "${TRUSTED_PROXY_COUNT:-1}"`
  - the db password moves to its own `.env.db` (only `POSTGRES_PASSWORD`). db gets `env_file: .env.db`, and backend gets `[.env.docker, .env.db]`. `.env.docker` drops both `POSTGRES_PASSWORD` and `DB_PASSWORD`, so the password is defined once and plain `docker compose up` works with no extra flag
  - `backend/.dockerignore` and the root `.dockerignore` (the frontend build context) exclude `.env.*` except the committed examples, plus `*.env.bak`
- **TMDB proxy per-user throttle (F6).** Decided 2026-10-08: yes, with id validation.
  - **First:** detail and person routes check that `:id` is a positive integer and render the not-found page otherwise, so a decoded `../` can't reach the app's own API through the proxy path.
  - **Then:** the TMDB client attaches the JWT. A 401 from the TMDB client never forces a logout: the request is retried once without the token, because it's public data.
- **CSV formula neutralization (S3).** Decided 2026-10-08: a `'` prefix plus a strip on import.
  - Export cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'`, and a value that already starts with `'` gets one more.
  - `parseCSV`-based importers strip exactly one leading `'` from cells that had it, so backups round-trip losslessly and older backups (no prefix) import unchanged.
- **Untrusted links (S5):** `PersonPage` renders `homepage` as a link only for `http:`/`https:` URLs, and as plain text otherwise.

## Capabilities

### New Capabilities
- `untrusted-content`: data from TMDB or other third parties, used as a link target, is restricted to safe schemes.

### Modified Capabilities
- `container-deployment`:
  - a redeploy never strands an open tab on a blank page
  - the database container receives only its own secret
  - images exclude env-file copies
  - the trusted proxy count is configurable
- `ci-pipeline`:
  - lint tool versions are pinned
  - CI builds the exact bundle that ships
  - the local Node version is declared and matches CI
- `api-hardening`:
  - TMDB proxy limits apply per user
  - proxy paths built from route ids can't reach other app endpoints
- `routing`: detail and person routes with a non-numeric id show the not-found page.
- `auth-session`: a 401 from the public-data client never ends the session.
- `data-backup`:
  - exported CSVs can't run as spreadsheet formulas
  - the backup round trip stays lossless

## Impact

- **Frontend:**
  - `package.json` / `package-lock.json`
  - `src/api/tmdb.ts` (token + 401 handling)
  - `MovieDetailPage.tsx`, `TVDetailPage.tsx`, `PersonPage.tsx` (id validation, homepage link)
  - `src/utils/export.ts`, `src/utils/csvParse.ts`
  - `.nvmrc`
- **Infra:** `nginx.conf`, `docker-compose.yml`, `backend/.dockerignore`, root `.dockerignore`, `.gitignore`, new `.env.db.example`, `.github/workflows/ci.yml`, `backend/requirements-test.txt`, `backend/constraints.txt`.
- **Backend:** one line in `settings.py`: `DB_PASSWORD` falls back to `POSTGRES_PASSWORD`, so the password lives only in `.env.db`. `TmdbProxyThrottle` already keys per user once requests carry a token.
- **Verification:**
  - full Jest, both e2e suites and `npm run build` after the bumps
  - `docker compose config` to check the interpolation
  - an nginx config check (`nginx -t` in the frontend image) where Docker is available. Docker checks were waived for `harden-docker`, so they stay best-effort here and are recorded if skipped
- **Docs:**
  - CLAUDE.md: the CSP/nginx bullet (static 404 + `index.html` no-cache), the CSV import rule (prefix strip) and Node 22
  - `docs/ARCHITECTURE.md`
  - `docs/BUG_BACKLOG.md`: closes the two (14) open decisions
