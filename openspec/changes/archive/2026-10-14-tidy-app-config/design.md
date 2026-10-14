## Context

See proposal.md for the why. Current state:
- `settings.py` already fails closed on `ALLOWED_HOSTS`, `SECRET_KEY` and `EMAIL_BACKEND` with debug off (`ImproperlyConfigured`), and `test_settings_fail_closed.py` checks each one by importing settings in a subprocess with a controlled env (its `PROD` dict). `FRONTEND_URL` defaults to `http://localhost:3000` in every mode, and `auth_views.py` builds `f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"`.
- `cinedb/urls.py` mounts `admin.site.urls`. No app has an `admin.py`. Only `django.contrib.auth`'s own User/Group registrations exist. nginx proxies only `/api/` and `/media/`.
- `postBulkChunks` (`src/api/userApi.ts`) slices 500 entries per POST. Django's `DATA_UPLOAD_MAX_MEMORY_SIZE` is the default 2,621,440 bytes, checked against the body's size for non-form bodies. nginx's `client_max_body_size` is 8m. A review is at most 5,000 code points, which is up to 20 KB in UTF-8 for emoji, so 500 of them can reach about 10 MB.
- `package.json`'s `start`, `dev` and `django` scripts call `G:/Anaconda/envs/django/python.exe backend/start.py`. npm runs scripts through `cmd.exe` on Windows and `sh` elsewhere, so an inline `${VAR:-python}` isn't portable. CRA reads the root `.env` but only exposes `REACT_APP_*` to the bundle, so a `DJANGO_PYTHON` line there is harmless to the frontend.

## Goals / Non-Goals

**Goals:**
- Each of the four defects is fixed, and a test pins the fix where one is practical.

**Non-Goals:**
- Making the admin reachable in production (that would need whitenoise and nginx routes, and nothing uses the admin).
- Raising Django's request-body limit, or adding a server-side chunk size to the bulk endpoints.
- Changing `.env.docker` or the Docker images. Docker deploys already set `FRONTEND_URL`.
- Dropping the `django_admin_log` table with a migration.

## Decisions

**1. `FRONTEND_URL`: validate only with debug off, strip the trailing slash in every mode.** The check reads the variable without a default when debug is off, then parses it with `urllib.parse.urlsplit`, which requires `scheme in {"http", "https"}` and a non-empty `netloc`. Otherwise it raises `ImproperlyConfigured` naming `FRONTEND_URL`, in the same style as the `ALLOWED_HOSTS` message. Under debug, the default stays `http://localhost:3000` and isn't validated, the same relaxation the other fail-closed settings get. `rstrip("/")` runs in both modes. *Alternative:* deriving the URL from the request's `Host`. That was rejected because a client controls `Host`, which is the reset-link poisoning pattern.

**2. Remove the admin outright, not throttle it.** Drop the route and `django.contrib.admin` from `INSTALLED_APPS`. `messages`, `sessions` and `staticfiles` stay: removing them is unrelated scope, and the browsable API under debug still uses `staticfiles`. With the app gone, the admin's `LogEntry` model isn't loaded, so its table becomes an orphan. That's harmless, and no migration in `userdata` depends on `admin`. `createsuperuser`/`changepassword` come from `django.contrib.auth` and keep working. *Alternative:* keep it and add a throttle plus documentation. That was rejected because the admin has no users, no registered models and no production route.

**3. Byte-budget chunking on the client.** `postBulkChunks` builds chunks greedily: it adds entries while `count < BULK_CHUNK_SIZE` and the chunk's encoded size stays at or under `BULK_MAX_BYTES = 2_000_000`. The size is measured as the UTF-8 length of `JSON.stringify(entry)` (a small counter, since Jest's jsdom has no `TextEncoder`) plus one byte per comma, plus a fixed allowance for the `{"entries":[…]}` wrapper. That leaves about 600 KB of headroom under Django's 2.5 MB for any other fields (`mediaType` on `bulkMarkWatched`'s body isn't on this path). An entry is never split, and one oversize entry still goes alone (it can't exceed about 25 KB, given the serializer bounds). Session `guard.check()` still runs before each request. Failure accounting stays per chunk. *Alternatives:* raising `DATA_UPLOAD_MAX_MEMORY_SIZE` alone was rejected, because 500 emoji reviews still exceed nginx's 8 MB, and a bigger in-memory body per request is a DoS lever. A server-side byte check doesn't help, because the request is already refused.

**4. A Node launcher, `scripts/run-django.js`.** Node is always present (npm runs it), so it is portable across `cmd`/`sh` without new dependencies. It resolves the interpreter in order: `process.env.DJANGO_PYTHON`, then a `DJANGO_PYTHON=` line in the root `.env` (a small parser: ignore comments and blank lines, trim, strip one pair of surrounding quotes), then `python`. It then runs `spawn(python, ["backend/start.py", ...process.argv.slice(2)], { stdio: "inherit" })`. On `error` with `ENOENT`, it prints `DJANGO_PYTHON=<value> was not found …` plus a pointer to `.env.example`, then exits 1. On child `exit`, it exits with the child's code. It forwards `SIGINT`/`SIGTERM` to the child, so `concurrently`'s shutdown and Ctrl+C still stop Django. *Alternatives:* the `dotenv` package was rejected, since it's only a transitive dependency of `react-scripts` and relying on that is fragile. `cross-env` can't express "fall back if unset" either.

**5. Env-example coverage test.** A backend test regex-scans `backend/cinedb/settings.py` for `os.environ.get("X"` / `os.environ["X"]` / `os.getenv("X"`, then asserts that each name appears in `backend/.env.example` (commented or not). The scan covers only `settings.py`: the audit found no environment reads elsewhere in runtime code, and widening the scan to tests would pull in test-only variables. `POSTGRES_PASSWORD` is satisfied by a comment line that points at `.env.db`.

## Risks / Trade-offs

- [A deploy without `FRONTEND_URL` stops starting after upgrade] → This is intended. The README Docker section already lists it, and the CHANGELOG entry calls it out as an upgrade note.
- [The developer's `npm run dev` breaks until `DJANGO_PYTHON` is set, because `python` on the `PATH` may be base Conda with Django 6.0] → Apply sets it in the local untracked `.env` (operator step, not committed). `test_dependency_versions.py` already fails on a wrong Django, and the launcher prints the interpreter it used at startup.
- [The byte measure differs slightly from axios's actual serialization] → The 600 KB headroom covers the wrapper and any difference. A unit test sends a chunk of max-length emoji reviews and asserts every request body is ≤ 2,000,000 bytes.
- [An orphan `django_admin_log` table] → It's harmless. ARCHITECTURE notes that it can be dropped by hand.

## Migration Plan

1. Deploy with `FRONTEND_URL` set (Docker's `.env.docker` already has it).
2. Developers add `DJANGO_PYTHON=<their env's python>` to the root `.env`.
3. Rollback: revert the change. No schema change is involved.
