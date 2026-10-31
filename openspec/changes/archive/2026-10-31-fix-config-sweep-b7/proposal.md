## Why

The B7 module sweep (config & startup, backlog item 55) found that production settings still accept a weak or blank signing key, a missing TMDB key and misspelled booleans, that every dev device shares one throttle bucket behind CRA's proxy, and that the startup recommendation warm-up ignores the outage backoff. Each one either weakens a fail-closed guarantee the app already claims or lets a misconfiguration boot silently.

## What Changes

- A set-but-blank `JWT_SIGNING_KEY` falls back to `SECRET_KEY` instead of signing with `""`.
- With debug off, startup refuses a weak `SECRET_KEY` (Django's `check --deploy` W009 rule: under 50 characters, under 5 distinct characters, or starting `django-insecure-`), which also covers the built-in default and the `.env.example` placeholder. A non-blank `JWT_SIGNING_KEY` is held to the same rule. **BREAKING** for a deploy running on a short key: it must set a stronger one.
- With debug off, startup refuses an unset or blank `TMDB_API_KEY`.
- Boolean settings (`DEBUG`, `EMAIL_USE_TLS`) go through one parser: `true/1/yes/on` and `false/0/no/off` (any case); any other value is a configuration error naming the variable. `DEBUG` unset stays off.
- `start.py` defaults `TRUSTED_PROXY_COUNT` to 1, since dev traffic arrives through CRA's proxy. The settings default stays 0.
- `start.py` starts `runserver` first and runs the three best-effort steps beside it, with the same bounds, as the Docker entrypoint does.
- The startup warm-up handles a refused (outage) result the way a background refresh does: it sets the user's failure backoff, and it skips users already in backoff.
- Stale settings comment on `LOGIN_FAILURE_LIMIT` corrected.
- Not in this change: the `DatabaseCache` throttle cost (low, performance only, would change the throttle design); the dev shutdown orphan finding (false positive).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `api-hardening`: "Production configuration fails closed" gains the secret-key strength rule, the blank JWT key fallback, the required TMDB key and strict boolean parsing; new requirement for a per-device rate-limit identity in local development.
- `service-health`: "Best-effort pre-warm work cannot block startup" extends the run-beside-the-server rule to `start.py`.
- `recommendation-refresh`: new requirement that the startup warm-up honours the refresh backoff.

## Impact

- `backend/cinedb/settings.py`, `backend/start.py`, `backend/userdata/management/commands/compute_recommendations.py`, `backend/userdata/recommendations.py` (shared outcome handling).
- `backend/.env.example` (boolean spelling note, key strength note), `.github/workflows/ci.yml` (`check --deploy` step needs a `TMDB_API_KEY` placeholder).
- Tests: `test_settings_fail_closed.py` (longer `PROD` key, new cases), `test_startup_warmup.py`, recommendation backoff tests.
- Docs: CLAUDE.md (fail-closed list, start.py order), `docs/ARCHITECTURE.md`, backlog item 55.
- Operators: a production key under 50 characters, or a missing `TMDB_API_KEY`, now stops startup.
