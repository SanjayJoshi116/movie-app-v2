## Why

`LoginPage.tsx` works but has several rough edges that hurt real users: a failed
login wipes the username the user just typed (not just the password), every
non-throttle failure — including network drops and 5xx server errors — is
flattened into the same "Invalid username or password" message (misleading and
makes real outages look like a typo), the username field doesn't autofocus so
users must click before typing, and inputs stay editable/re-submittable while a
login request is already in flight. None of this requires backend changes —
it's a self-contained UI correctness/UX pass on one page.

## What Changes

- On login failure, keep the username field populated and only clear/refocus
  the password field, so the user isn't forced to retype both.
- Distinguish error causes in the toast message:
  - `400`/`401` → "Invalid username or password." (unchanged, existing e2e
    coverage depends on this exact string for a 400 response)
  - `429` → "Too many login attempts. Please wait a moment and try again."
    (unchanged)
  - No response / network error / `5xx` → new "Can't reach the server. Check
    your connection and try again." message, so outages aren't mistaken for
    bad credentials.
- Autofocus the username input on mount.
- Disable both inputs (not just the submit button) while a login request is
  in flight, so a slow request can't be resubmitted with edited values.
- Trim leading/trailing whitespace from the username on submit (a common
  mobile-autocomplete/copy-paste footgun that currently produces a confusing
  "invalid credentials" for an otherwise-correct username).

## Capabilities

### New Capabilities
- `login-page`: Client-side behavior of the login form — field state handling
  on success/failure, error-message mapping by failure cause, and input
  availability while a request is in flight.

### Modified Capabilities
(none — no existing spec covers this behavior yet)

## Impact

- `src/pages/LoginPage.tsx` (primary change)
- `e2e/auth.spec.ts` — existing "shows error on invalid credentials" test
  (400 response) must keep passing unchanged; a new case should be added for
  the network-error path
- No backend, API, or `AuthContext` changes required
