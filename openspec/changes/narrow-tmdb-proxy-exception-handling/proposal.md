## Why

`CLAUDE.md` documents a specific convention for this codebase: `except
Exception:` should be narrowed to what the try block can actually raise, and
gives the exact example of `(requests.RequestException, ValueError)` "for a
TMDB fetch alone." It also names the handful of call sites that are
deliberately broad on purpose, each with a comment explaining why
(`recommendations.py`'s `_refresh_cache` and `f.result()` loop,
`compute_recommendations.py`'s batch loop, `auth_views.py`'s `send_mail`
call).

`tmdb_proxy_views.py`'s `tmdb_proxy` view — a TMDB fetch alone, the exact
case the convention's own example describes — still catches bare `except
Exception:` with no narrowing and no exemption comment. It's the one
documented gap between the stated convention and the code. Concretely, its
try block only does two things that can fail: `_session.get(...)` (raises
`requests.RequestException` subclasses — `ConnectionError`, `Timeout`,
etc.) and `r.json()` (raises `ValueError`/`json.JSONDecodeError`, a
`ValueError` subclass, when TMDB returns a non-JSON body). A bare `except
Exception:` also silently swallows genuine bugs in this view — e.g. an
`AttributeError` from a future edit — and reports them to the client as a
misleading "TMDB request failed" 502 instead of surfacing as a 500 that
would get noticed and logged distinctly.

## What Changes

- Narrow `tmdb_proxy_views.py`'s `except Exception:` to
  `except (requests.RequestException, ValueError):`.
- Add a regression test confirming the proxy still returns a clean 502 on a
  simulated TMDB connection failure (the behavior the broad catch was
  originally protecting).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — this is an internal error-handling narrowing with no change to the
view's documented external behavior: a TMDB connection failure or malformed
response still produces a 502 with the same error body. This change sets
`skip_specs: true` in `.openspec.yaml`.)

## Impact

- `backend/userdata/tmdb_proxy_views.py`
- `backend/userdata/tests/test_tmdb_proxy.py` (new)
- No frontend, routing, or API contract changes — response shape and status
  codes for the two failure modes this endpoint is meant to handle
  (connection failure, non-JSON response) are unchanged; only genuinely
  unexpected exceptions now propagate instead of being masked as a 502
