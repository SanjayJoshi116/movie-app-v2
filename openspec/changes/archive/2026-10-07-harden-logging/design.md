## Context

See proposal.md (Why). Django applies `DEFAULT_LOGGING` first and then the project's `LOGGING` (`disable_existing_loggers: False`). The project config defines a `console` handler with `RedactingFormatter` and wires it only to `userdata`. Measured on 2026-10-07:

| Logger | `DEBUG` off | `DEBUG` on |
|---|---|---|
| `django.request` ERROR | dropped | shown, key visible |
| `django.request` WARNING (4xx) | dropped | shown |
| `userdata.*` | redacted | redacted |
| `urllib3` (via root's last-resort handler) | shown, key visible | shown, key visible |

`RedactingFormatter` does a plain `str.replace` of `settings.TMDB_API_KEY` on the fully formatted text, so tracebacks are covered once a record reaches it. urllib3 2.6.3's `HTTPConnectionPool.urlopen` logs `"Retrying (%r) after connection broken by '%r': %s"` with the request URL, query string included.

## Goals / Non-Goals

**Goals:**
- One redacting sink for every logger.
- Production 500s visible in that sink.

**Non-Goals:**
- Request ids, structured or JSON logs, Sentry or log shipping, `ADMINS` email.
- Moving TMDB auth from the `api_key` query param to a v4 bearer header. That would take the key out of URLs entirely, but it needs a different credential from the user.

## Decisions

1. **The root logger carries the redacting handler.** `"root": {"handlers": ["console"], "level": "WARNING"}`. Third-party loggers propagate to root, so redaction no longer depends on knowing every logger name.
   - *Alternative:* a handler per known logger (`urllib3`, `django`). Rejected: it misses the next library.
2. **Override `django` and `django.request` explicitly.**
   - `"django": {"handlers": [], "level": "INFO", "propagate": True}`. This replaces Django's default handler list, which drops its debug-only `console` and its `mail_admins`. Records then reach root.
   - `"django.request": {"level": "ERROR"}`. Django logs every response ≥400 through this logger, at WARNING for 4xx and ERROR for 5xx. Raising it to ERROR keeps 500s and silences the 401 refresh churn and 404s.
   - `django.server` stays as Django configures it: its own handler, `propagate: False`. It only carries runserver access lines, which contain inbound paths and never the TMDB key.
3. **`userdata` propagates to root and has no handler of its own.** That avoids double lines. It keeps `level: INFO` so its existing info logs still show. A propagated record is checked only against handler levels, not root's logger level, so the console handler must stay unlevelled or at INFO.
4. **Same config in dev and prod.** No `DEBUG` branch, so what developers see is what production writes.

## Risks / Trade-offs

- [Prod now gets WARNING+ output from every library] → Expected volume is low (urllib3 retries, Django ERRORs), and that output is the visibility this change is for.
- [A handler added later beside `console` without the formatter would leak again] → A test asserts every handler in `LOGGING` uses the redacting formatter.
- [The key is already in past logs] → Ops note in the proposal: rotate the key if those logs were ever shared.
