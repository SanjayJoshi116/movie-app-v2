## 1. Backend pins

- [x] 1.1 `backend/requirements.txt`: pin each direct dependency `==` to the tested version (Django 5.2.17, DRF 3.16.1, simplejwt 5.5.1, psycopg2-binary 2.9.9, django-cors-headers 4.9.0, Pillow 12.1.1, python-dotenv 1.2.2, requests 2.33.0, scikit-learn 1.8.0, numpy 2.2.6, gunicorn 23.0.0); keep the simplejwt comment
- [x] 1.2 `backend/requirements-test.txt`: pin pytest 9.1.1, pytest-django 4.12.0 (keep the `pytest>=8.4` reason as a comment)
- [x] 1.3 Generate `backend/constraints.txt`: fresh venv from `G:/Anaconda/envs/django/python.exe -m venv`, `pip install -r requirements-test.txt`, `pip freeze`; add a header comment with the regeneration command; review for Windows-only packages and drop/mark them
- [x] 1.4 `e2e/python/requirements.txt`: pin pytest, pytest-playwright 0.8.0, pytest-timeout 2.4.0, playwright 1.60.0 (matches npm `@playwright/test`)
- [x] 1.5 Add `backend/userdata/tests/test_dependency_versions.py`: `django.VERSION[:2]` equals the major.minor of the `Django==` pin in `requirements.txt`

## 2. Docker images

- [x] 2.1 `backend/Dockerfile`: both stages `python:3.12-slim`; install with `-r requirements.txt -c constraints.txt` (copy `constraints.txt` into the builder stage)
- [x] 2.2 `Dockerfile.frontend`: `node:18-alpine` → `node:22-alpine`; keep `npm ci --legacy-peer-deps`

## 3. Docs

- [x] 3.1 `docs/ARCHITECTURE.md`: restate the avatar-URL bullet's reason without the Express proxy; delete the "Multipart proxy passthrough" (`server.js`) bullet; API-key bullet → "only by Django (`tmdb_proxy`)"
- [x] 3.2 `e2e/python/conftest.py:4`: "no real Django/Express server" → "no real Django server"
- [x] 3.3 README install commands (`pip install -r backend/requirements*.txt`) add `-c backend/constraints.txt`; add a short "Updating backend dependencies" note (edit pin → regenerate constraints → run tests); add one line to CLAUDE.md's Stack section pointing at the constraints file and the version guard test

## 4. Verification

- [x] 4.1 Fresh venv (Python 3.12): `pip install -r backend/requirements-test.txt -c backend/constraints.txt` succeeds; `pytest backend` all green in that venv; `manage.py makemigrations --check` reports no changes
- [x] 4.2 Guard test: passes in the django env; fails with a clear message when run with base Anaconda (Django 6.0.3) — confirm, then don't leave anything installed
- [x] 4.3 Frontend unaffected: `npm ci --legacy-peer-deps` (Node 22 if available, else current) then `npx tsc --noEmit` and Jest green
- [x] 4.4 `git grep -niE "express|server\.js"` returns only CLAUDE.md history, LICENSE and the backlog
- [x] 4.5 MANUAL (Docker not installed here): user runs `docker compose build --no-cache` and `docker compose up`, confirms the backend container reports Django 5.2.17 (`docker compose exec backend python -m django --version`) and the healthcheck goes healthy
  - **Note (2026-10-06): not run, closed by user decision.** Docker isn't installed on the dev machine. Covered instead: a fresh Python 3.12 venv installed `-r requirements-test.txt -c constraints.txt` (Django 5.2.17) and passed the backend suite (197/197) plus `makemigrations --check`. `npm ci` + typecheck + Jest passed on local Node 24. Still unverified: the image build itself (`python:3.12-slim`, `node:22-alpine`) and the healthcheck. Run the commands above on the first Docker deploy.
