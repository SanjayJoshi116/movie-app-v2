## Context

See proposal.md. Re-checked 2026-10-08:
- **Deps:** `axios ^1.7.2` and `react-router-dom ^6.24.1` are in `dependencies`, along with `concurrently` and `@testing-library/*`. Nothing in `src/` or `e2e/` imports `json2csv`, `file-saver` or `@testing-library/user-event`.
- **nginx:** `location / { try_files $uri $uri/ /index.html; }` covers static assets too. Security headers are declared at server level, and the existing comment warns that a location-level `add_header` would drop them.
- **Compose:** `env_file: .env.docker` is on both db and backend, and `TRUSTED_PROXY_COUNT: "1"` is a literal under backend `environment:`. The db password is already duplicated in `.env.docker` (`POSTGRES_PASSWORD` for the postgres image, `DB_PASSWORD` for `settings.py`). Compose auto-loads the repo-root `.env` (the *dev* file) for `${...}` interpolation. The root `.dockerignore` (the frontend build context) lists specific env files, not `.env.*`.
- **CI:** `pip install ruff` is unpinned, and `npm run build` runs without `INLINE_RUNTIME_CHUNK=false`. Node is 22 in CI and `Dockerfile.frontend`, and there's no `.nvmrc`/`engines`.
- **TMDB client:** `src/api/tmdb.ts` is its own axios instance with a response interceptor and no auth. `tmdb_proxy` is `AllowAny`. Under DRF's default JWT authentication, a request with an *invalid or expired* token gets a 401 even on an `AllowAny` view. That's why the client must retry without the token.
- **Detail routes** pass `useParams().id` straight into proxy paths.
- **CSV:** `export.ts`'s `escape()` only quotes. All importers go through `parseCSV` (`parseCSVForImport`, `parseBackupCSV`).

## Goals / Non-Goals

**Goals:**
- Each finding fixed with a check that can fail, or for infra, a recorded manual verification.
- No security header lost, and no session ended by public data.

**Non-Goals:**
- Major-version upgrades (React Router 7, axios 2). Same majors only.
- `npm audit` as a CI gate. It's noisy for CRA's dev-only tree, so it's left for a separate decision.
- Long-lived caching of hashed `/static/` assets. A nice-to-have, but out of scope. This change only stops the blank page.

## Decisions

**1. nginx (I2):**
```
map $uri $entry_cache_control { /index.html "no-cache"; default ""; }
server {
  ... existing server-level add_header lines ...
  add_header Cache-Control $entry_cache_control always;   # empty → not sent
  location /static/ { try_files $uri =404; }              # no add_header here
  location / { try_files $uri $uri/ /index.html; }
}
```
- After `try_files` falls back, `$uri` is `/index.html`, so every SPA route's entry page gets `no-cache`.
- An empty `add_header` value is skipped (the file already relies on this for HSTS).
- `/static/` declares no `add_header`, so it keeps inheriting the security headers.

**2. CI and Node:**
- `ruff==<current>` goes in `backend/requirements-test.txt` and the constraints. CI's backend job installs ruff through that file (`pip install -r requirements-test.txt -c constraints.txt` already exists for pytest), so the separate `pip install ruff` step is dropped.
- The frontend build step gets `env: INLINE_RUNTIME_CHUNK: "false"`.
- `.nvmrc` = `22`, `engines.node = ">=22 <23"`. No `engine-strict`, so Node 24 locally only warns.

**3. Compose:**
- **Chosen: a db-only `.env.db`** holding just `POSTGRES_PASSWORD`.
  - db: `env_file: .env.db`, plus the existing `POSTGRES_DB`/`POSTGRES_USER` literals.
  - backend: `env_file: [.env.docker, .env.db]`.
  - `.env.docker` drops both password keys, and `settings.py` reads `DB_PASSWORD` falling back to `POSTGRES_PASSWORD`.
  - The password then exists in exactly one file, so nothing can drift (today it's duplicated). Plain `docker compose up` works, and a missing `.env.db` is a compose startup error naming the file.
  - `.env.db.example` is committed (negated in `.gitignore`). `.env.db` is excluded by `.env.*` in both `.dockerignore` files, the root one included, since the frontend context is the repo root.
- backend: `TRUSTED_PROXY_COUNT: "${TRUSTED_PROXY_COUNT:-1}"`. Its interpolation reads the shell or the root `.env`, which is fine for an optional value with a default.
- *Rejected: `environment: POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"` + `docker compose --env-file .env.docker`.* It's an extra flag on every run, and if it's forgotten, compose silently interpolates from the dev `.env`.
- *Rejected: Docker secrets (`POSTGRES_PASSWORD_FILE` + a `DB_PASSWORD_FILE` reader).* It keeps the password out of the environment entirely, but it's more change than this deploy's threat model needs.

**4. TMDB client token (F6), in order:**
1. **Route ids:** a `useValidId()` helper (`/^[1-9]\d{0,9}$/`, ≤ INT32_MAX) used by `MovieDetailPage`, `TVDetailPage` and `PersonPage`. An invalid id renders the existing not-found page and makes no fetch. Other `api/tmdb.ts` callers take ids from TMDB responses, which are already numbers.
2. **Request interceptor** on the `tmdb.ts` instance: attach `Authorization: Bearer <cinedb_access>` when present.
3. **Response interceptor:** on 401 with `config._noAuthRetry` unset, retry once with the header removed and `_noAuthRetry = true`. It never calls `forceLogout`, and never runs the refresh flow, which stays exclusive to `userApi` (CLAUDE.md: one refresh path).

The access token gets refreshed by the next `userApi` call anyway, so public browsing doesn't need its own refresh path.

**5. CSV neutralization (S3):**
- **Export:** in `escape()`, before quoting, a string matching `/^[=+\-@\t\r']/` gets a `'` prepended. A leading `'` gets doubled the same way, which keeps the rule reversible.
- **Import:** `parseCSV` (shared by all importers) strips one leading `'` from a cell matching `/^'[=+\-@\t\r']/`.
- **Old backups:** they never had the prefix. A genuine leading `'` in an old backup is followed by another character (e.g. `'Salem's Lot`), so it doesn't match and is kept. A cell that was literally `'=…` in an old file would lose its `'`. That is accepted, and it requires a title that starts with an apostrophe followed by a formula character.
- **Numeric cells:** values like `-1` never occur in exports today (ids, ratings and runtimes are positive). They would round-trip anyway.

**6. Untrusted links (S5):** a `safeHttpUrl(value)` helper (`new URL()` parse, protocol in `{http:, https:}`) in `src/utils/`. `PersonPage` renders the link only when it returns a URL.

## Risks / Trade-offs

- [The react-router 6.24 → 6.30 bump changes future-flag warnings or `useBlocker` behavior] → The app uses no data router. Run both e2e suites and check the console for new warnings.
- [A token on TMDB calls makes an expired token cost one extra request] → Bounded at one retry, and only until the next `userApi` call refreshes the token.
- [Existing deploys have no `.env.db`] → Compose fails at startup naming the file, and the README's upgrade note says to move `POSTGRES_PASSWORD` there and delete both password keys from `.env.docker`.
- [Docker/nginx checks can't run on this machine] → Same as `harden-docker`: verify with `docker compose config` and `nginx -t` where available, and record them as waived otherwise.

## Migration Plan

- One-time operator step: create `.env.db` from `.env.db.example` with the current `POSTGRES_PASSWORD`, then remove `POSTGRES_PASSWORD` and `DB_PASSWORD` from `.env.docker`. This is documented in the README. `docker compose up` is unchanged after that.
- No data migrations.
- The CSV change is additive, so old backups import unchanged.
- To roll back, revert the commit and `npm ci`.
