## Context

See proposal.md - Why. `tmdb_proxy_views.py`'s `tmdb_proxy` view has exactly
two operations in its try block: `_session.get(...)` and `r.json()`. No DB
writes, no other I/O.

## Goals / Non-Goals

**Goals:**
- Match this call site to the convention `CLAUDE.md` already documents and
  gives this exact function as the example for.
- Preserve the view's existing external behavior for the two failure modes
  it's meant to handle (TMDB unreachable, TMDB returns non-JSON).

**Non-Goals:**
- Not changing the response shape or status code (`502`, `{"error": "TMDB
  request failed."}`) for the failure modes that are still caught — only
  which exception types trigger that response.
- Not adding retry/circuit-breaker logic beyond what `_session`'s existing
  `HTTPAdapter(max_retries=Retry(...))` already does.

## Decisions

- **Catch `(requests.RequestException, ValueError)`, not a broader or
  narrower set.** `requests.RequestException` is the base class for every
  exception `requests`/`_session.get()` can raise (`ConnectionError`,
  `Timeout`, `TooManyRedirects`, etc.) — catching subclasses individually
  would need updating if `requests` adds one. `ValueError` covers
  `r.json()`'s failure mode: `json.JSONDecodeError` is a `ValueError`
  subclass, raised when TMDB returns a non-JSON body (e.g. an HTML error
  page from a gateway timeout upstream of TMDB itself).
- **Do not add a third handler for `r.status_code` ranges.** A non-2xx TMDB
  response is already forwarded as-is via `Response(r.json(), status=r.status_code)`
  when the body does parse as JSON (TMDB returns JSON error bodies for its
  own 4xx/5xx) — that path doesn't raise, so it needs no exception handling
  changes.
- **Test the connection-failure path, not the malformed-JSON path.** Both
  are covered by the same except clause and the same fix; a connection
  failure is simpler to simulate reliably in a test (mock `_session.get` to
  raise `requests.ConnectionError`) than fabricating a response object whose
  `.json()` raises.

## Risks / Trade-offs

- [A genuinely unexpected exception in this view (e.g. a future edit
  introducing an `AttributeError`) now propagates as an unhandled 500
  instead of being silently reported as a 502] → This is the intended
  effect, not a side effect: masking real bugs as "TMDB request failed" was
  the actual problem `CLAUDE.md`'s convention exists to prevent. A 500 here
  surfaces in Django's error logging distinctly from a genuine TMDB outage.
