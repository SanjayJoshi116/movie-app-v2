## Context

`LoginPage.tsx` (see proposal.md - Why) is a single self-contained component:
local `useState` for `loading`, an antd `Form` instance, and a single
`onFinish` handler that calls `AuthContext.login`. There is no shared
login-error-mapping utility elsewhere in the codebase to reuse, and
`AuthContext.login` already throws the raw `AxiosError` through unchanged, so
all of the behavior in specs/login-page/spec.md is implementable entirely
inside this one component with no API or context changes.

## Goals / Non-Goals

**Goals:**
- Keep every behavior change scoped to `LoginPage.tsx`.
- Preserve the exact existing message string/status mapping the current e2e
  test (`e2e/auth.spec.ts`, 400 → "Invalid username or password.") already
  asserts on.

**Non-Goals:**
- No "remember me" / session-vs-persistent login choice — `AuthContext`
  always persists to `localStorage` today and changing that is a separate,
  larger change touching token lifetime handling.
- No visual/layout redesign of the `Card` — this is a behavior/robustness
  pass, not a restyle.
- No change to `AuthContext.login` or the backend `auth/login/` endpoint.

## Decisions

- **Error classification lives inline in `onFinish`, not a shared helper.**
  Only one call site exists today (`RegisterPage.tsx` has its own, differently-shaped
  error handling for field-level validation errors, which doesn't fit the same
  three-bucket model). Extracting a shared `classifyAuthError()` now would be
  a one-caller abstraction; revisit if a second page needs the same three-way
  split.
- **Detect "server unreachable" via `err.response === undefined` rather than
  a specific error code.** Axios sets `response` to `undefined` for both
  network failures and timeouts, and any `5xx` still has a `response` with a
  `status >= 500` — checking `!err.response || status >= 500` covers both
  without needing `err.code === "ERR_NETWORK"` (which axios doesn't set for
  every transport-level failure, e.g. CORS rejections).
- **Clear only the password field via `form.setFields`/`form.resetFields(["password"])`,
  not the current `form.resetFields()` (both fields).** Antd's `Form` supports
  clearing a single named field; no workaround needed.
- **Disable inputs via the existing `loading` state**, passing `disabled={loading}`
  to both `Form.Item` children — no new state variable needed since `loading`
  already tracks the in-flight request.
- **Trim username with `values.username.trim()`** at the top of `onFinish`,
  before calling `login()` — cheapest point to normalize, and keeps the
  trimmed value available for the `form.setFieldsValue` restore-on-failure
  path too.

## Risks / Trade-offs

- [Autofocus can be mildly disruptive for screen-reader users on page load] →
  Acceptable here: it's a single-purpose auth page with one logical starting
  point (username), matching common login-form convention, and antd's
  `Input autoFocus` still announces the field label normally.
- [New network-error message branch is untested by existing e2e suite] →
  Proposal calls for one new `e2e/auth.spec.ts` case that aborts/fails the
  route to hit this branch; keeps the existing 400-response case unchanged.
