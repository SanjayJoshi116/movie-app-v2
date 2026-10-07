## Why

`LOGGING` attaches the TMDB-key `RedactingFormatter` only to the `userdata` logger. Every other logger falls back to Django's defaults or to Python's last-resort handler. Checked on 2026-10-07, this causes two problems:

- **Live key leak.** The TMDB proxy's shared `requests.Session` retries through urllib3. On every retry, urllib3 logs `Retrying (...) after connection broken by ...: /3/...?api_key=<KEY>` at WARNING. The last-resort handler writes that to stderr without redaction, so the key ends up in `docker logs` (prod) and in the dev terminal. The backlog's "no live leak path today" note is wrong.
- **Production 500s leave no trace.** Django's default `console` handler is filtered to `DEBUG=True`, and `mail_admins` needs `ADMINS`, which isn't set. With `DEBUG` off, an unhandled view exception logs nothing at all. Under `DEBUG`, the traceback is printed unredacted.

## What Changes

- Attach the redacting console handler to the **root** logger at WARNING, so every logger is redacted: Django's, urllib3's, and any future one.
- Route the `django` logger to that handler in every mode. Set `django.request` to ERROR, so unhandled 500 tracebacks are logged in production and routine 4xx responses (401 refresh churn, 404s) aren't. Leave `django.server` (runserver access lines) as Django configures it.
- `userdata` keeps INFO and logs once. It propagates to root, and its own duplicate handler is removed.
- Kept minimal on purpose: no request ids, JSON format, or log shipping.
- Backlog: move the deferred "redaction covers only `userdata`" item to this change, and correct its "no live leak path" note.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `api-hardening`: add a requirement that no server log output, from any logger, contains the TMDB API key.
- `service-health`: add a requirement that unhandled server errors are logged with a traceback in production, and routine client errors aren't.

## Impact

- `backend/cinedb/settings.py` (`LOGGING` only). `backend/userdata/logging.py` is unchanged.
- Tests: `backend/userdata/tests/test_tmdb_auth.py` (or a new `test_logging.py`): urllib3-style and `django.request` records are redacted, and a 500 is logged with `DEBUG` off.
- No API, frontend, migration, or dependency changes. If production logs were ever shared, the TMDB key should be rotated. That's an ops step, not code.
