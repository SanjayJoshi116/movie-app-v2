## 1. Settings fail closed

- [x] 1.1 Add `_env_bool(name, default)` to `settings.py` (true/1/yes/on, false/0/no/off, case-insensitive, stripped; else `ImproperlyConfigured` naming the variable) and use it for `DEBUG` and `EMAIL_USE_TLS`
- [x] 1.2 Replace the default-`SECRET_KEY` check with the W009 strength rule (≥50 chars, ≥5 distinct, no `django-insecure-` prefix) when `DEBUG` is off; error names the variable, never the value
- [x] 1.3 `JWT_SIGNING_KEY`: blank falls back to `SECRET_KEY` (`or`); a non-blank value is held to the same rule when `DEBUG` is off
- [x] 1.4 Require a non-blank `TMDB_API_KEY` when `DEBUG` is off
- [x] 1.5 Rewrite the `NUM_PROXIES` comment (dev gets 1 from `start.py`) and fix the stale `LOGIN_FAILURE_LIMIT` comment (failures live in the `LoginFailure` table)
- [x] 1.6 `backend/.env.example`: note the key strength rule and accepted boolean spellings, and that rotating `SECRET_KEY` signs users out unless `JWT_SIGNING_KEY` is set
- [x] 1.7 `.github/workflows/ci.yml`: add a `TMDB_API_KEY` placeholder to the "Check backend image" step
- [x] 1.8 `test_settings_fail_closed.py`: lengthen `PROD`'s `SECRET_KEY`, add `TMDB_API_KEY` to `PROD` and `CONTROLLED` (plus `JWT_SIGNING_KEY`, `EMAIL_USE_TLS`); cases: placeholder/short/low-variety/`django-insecure-` key refused, weak JWT key refused, blank JWT key falls back, missing TMDB key refused (allowed under DEBUG), `true`/`1`/`yes` accepted, `maybe` refused for both booleans, unset `DEBUG` still off

## 2. Dev launcher

- [x] 2.1 `start.py`: `os.environ.setdefault("TRUSTED_PROXY_COUNT", "1")` beside the `DEBUG` default
- [x] 2.2 `start.py`: start `runserver` with `Popen` after the required steps, then run the three best-effort steps through `run_warmup` with unchanged bounds, then `sys.exit(proc.wait())`
- [x] 2.3 `test_startup_warmup.py`: assert `start.py` starts the server before the first best-effort step and keeps the same step list/bounds as the entrypoint; assert the `TRUSTED_PROXY_COUNT` default line

## 3. Warm-up backoff

- [x] 3.1 `recommendations.py`: extract `apply_refresh_outcome(user_id, outcome)` (backoff on `KEPT_OUTAGE`) and call it from `_refresh_cache`
- [x] 3.2 `compute_recommendations.py`: call it after `save_recommendations`; skip users in `in_failure_backoff()`
- [x] 3.3 Tests: warm-up with a refused result sets the backoff; a backed-off user is skipped; a saved/superseded result sets none

## 4. Checks and docs

- [x] 4.1 Run backend pytest, `ruff check backend/`, `makemigrations --check --dry-run` (with `DEBUG=True`); run `check --deploy` locally with the CI step's placeholder env
- [x] 4.2 Update CLAUDE.md (fail-closed list incl. key strength and `TMDB_API_KEY`, boolean parsing, `start.py` order and `TRUSTED_PROXY_COUNT` default), `docs/ARCHITECTURE.md` (rationale for W009 rule and start.py-only proxy default), and backlog item 55 (📝 proposed, then status table)
