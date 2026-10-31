## Context

`settings.py` reads every setting with `os.environ.get` at import time and raises `ImproperlyConfigured` for a handful of production mistakes (wildcard hosts, default secret key, no email backend, bad `FRONTEND_URL`, bad `TMDB_SESSION_KEYS`). `test_settings_fail_closed.py` imports settings in a fresh interpreter per case, with `backend/.env` disabled. `start.py` is the dev-only launcher (`npm run dev` through `scripts/run-django.js`); it already `setdefault`s `DEBUG=True`. The Docker entrypoint (I1, `fix-deploy-sweep-i1`) now runs the best-effort steps in a background block beside gunicorn, and `test_startup_warmup.py` keeps both paths' step lists equal. The warm-up (`compute_recommendations`) is a separate process from the server, so `request_refresh`'s in-memory per-user coalescing and semaphore can't see it; the outage backoff is a `default`-cache key and is visible across processes.

## Goals / Non-Goals

**Goals:**
- No production boot with a weak or empty signing key, a missing TMDB key, or a boolean that silently means "off".
- One throttle bucket per device in dev.
- Dev Django listens without waiting for the best-effort steps.
- Warm-up and background refreshes back off from a TMDB outage the same way.

**Non-Goals:**
- `DatabaseCache` throttle cost (COUNT per set, 5000-entry `user` history). Low impact, needs a throttle redesign.
- Coordinating the warm-up with in-process refreshes beyond the backoff (overlap stays bounded by the 30 s cap, the daily title budget, and `save_recommendations`' superseded check).
- Parsing integer env vars more kindly (`int("")` crash stays; it names nothing but fails closed).

## Decisions

1. **Secret strength = Django's W009 rule, enforced only with `DEBUG` off.** Under 50 characters, under 5 distinct characters, or a `django-insecure-` prefix fails startup. It is the rule `check --deploy` already warns on, so nothing new to explain, and it covers the built-in default, the `.env.example` placeholder and short guessable values in one check. Alternative: reject only the placeholder string (catches one value, the next `changeme` passes). Applied to `JWT_SIGNING_KEY` too when it's non-blank. The existing "default key" check folds into this one. The secret value is never put in the error message.
2. **Blank `JWT_SIGNING_KEY` = unset**: `os.environ.get("JWT_SIGNING_KEY") or SECRET_KEY`, as `DB_PASSWORD` already does.
3. **`TMDB_API_KEY` required with `DEBUG` off**, same shape as the `EMAIL_BACKEND` check. Under `DEBUG` a blank key still boots (tests and offline dev).
4. **One `_env_bool(name, default)` helper in `settings.py`.** Accepts `true/1/yes/on` / `false/0/no/off`, case-insensitive, whitespace stripped; anything else raises `ImproperlyConfigured` naming the variable, in every mode (a typo in `DEBUG` should fail loudly, not run with debug off). Used for `DEBUG` and `EMAIL_USE_TLS`. Unset `DEBUG` is still off.
5. **`TRUSTED_PROXY_COUNT=1` set by `start.py` (`os.environ.setdefault`), settings default stays 0.** `start.py` only runs for local dev, where CRA's proxy (loopback, `xfwd: true`) is always in front. Changing the settings default would make any proxy-less deploy trust a client-chosen `X-Forwarded-For`. Accepted downside: a LAN device hitting `:8000` directly in dev can pick its own throttle bucket; dev only, throttling only. The `NUM_PROXIES` comment is rewritten to match.
6. **`start.py` order: required steps → `Popen(runserver)` → best-effort steps → `wait()`.** Mirrors the entrypoint's background block without a shell. The steps still go through `run_warmup` with unchanged bounds, so `test_startup_warmup`'s list-equality and bound checks keep working; the order test gains a `start.py` case (server started before the first best-effort step). `runserver`'s exit code is passed on (`sys.exit(proc.wait())`), so `run-django.js` still reports Django's status. Ctrl+C reaches the whole console group, so the child stops with the launcher.
7. **Shared outcome handling.** A small `recommendations.apply_refresh_outcome(user_id, outcome)` sets the backoff on `KEPT_OUTAGE` (the code now inline in `_refresh_cache`); `_refresh_cache` and the warm-up both call it. `users_to_warm()` drops users for whom `in_failure_backoff()` is true (a cache read per candidate; the list is small and the step is capped at 30 s). Alternative: route the warm-up through `request_refresh` — rejected, its coalescing is in-memory per process and would not see gunicorn's refreshes anyway.

## Risks / Trade-offs

- [A running deploy with a short `SECRET_KEY` stops booting after upgrade] → CHANGELOG and README call it out; the error names the variable and the rule. Rotating `SECRET_KEY` invalidates outstanding JWTs (users sign in again) unless `JWT_SIGNING_KEY` is set; documented. `TMDB_SESSION_KEYS` are independent of it in production.
- [`DEBUG=yes`-style values that used to mean "off" now mean "on"] → only values outside the old exact `True` spelling change; `yes`/`1` meaning on is what an operator writing them intended.
- [Warm-up still overlaps a refresh in another process] → bounded as above; not worth cross-process coordination.
- [CI `check --deploy` step lacks `TMDB_API_KEY`] → add a placeholder there, or the docker job fails.
