## 1. Logging config

- [x] 1.1 In `backend/cinedb/settings.py` `LOGGING`:
  - add `root` (console handler, WARNING)
  - override `django` (no handlers, INFO, propagate) and `django.request` (ERROR)
  - make `userdata` propagate, with no handler of its own, at INFO
- [x] 1.2 Re-run the design's Context check with `DEBUG` False and True:
  - `django.request` ERROR is shown and redacted
  - `django.request` WARNING is hidden
  - `urllib3` WARNING is redacted
  - `userdata` INFO appears exactly once

## 2. Tests

- [x] 2.1 Test: a `urllib3.connectionpool` WARNING containing `api_key=<fake>` is written with `***` (capture the configured console handler's stream).
- [x] 2.2 Test: with `DEBUG` off, a view raising an exception whose message holds the fake key returns 500, and the log has an ERROR entry with the path, the traceback and `***`, not the key.
- [x] 2.3 Test: a 404 from an API endpoint writes no `django.request` entry.
- [x] 2.4 Test: every handler in `settings.LOGGING` uses the redacting formatter (extend `test_console_handler_uses_redacting_formatter`).
- [x] 2.5 Run `pytest`, `ruff check backend/` and `makemigrations --check --dry-run`. All must pass.

## 3. Docs

- [x] 3.1 Add a `docs/ARCHITECTURE.md` bullet: the root redacting handler and the `django.request` ERROR level, and why.
