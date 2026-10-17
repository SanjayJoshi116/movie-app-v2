## Why

The sign-in page is the first screen every user sees, and today it is a stock antd `Card` with a "Sign In" heading: nothing on it says CINE DB or carries the app's navy-and-gold "cinema" identity. It is also the cheapest place to pilot a deliberate visual direction (via the `frontend-design` skill) before touching shared tokens: it renders without the sidebar or bottom nav, needs no data and no account, and is 73 lines.

## What Changes

- Restyle `/login` in a cinematic direction built on the existing palette: a branded stage (the CINE DB wordmark in gold, a short tagline, layered depth behind the form) instead of a bare centred card.
- Poppins stays the only font. Hierarchy comes from weight, size, letter-spacing and spacing, using `FONT_SIZE` steps and antd tokens (no new color literals outside `constants/`/`theme/`).
- Both themes get the design at once (dark "cinema" and light "cream"), with matching scoped `App.css` rules.
- Decorative motion, if any, is CSS or framer-motion and turns off under reduced motion.
- Pure CSS and type; no TMDB images, so no new request, CSP origin or image fallback.
- Behaviour is unchanged: field labels, button names, the failed-login messages, username retention, autofocus, trimming, in-flight locking and redirects stay exactly as specified.
- Register, Forgot password and Reset password are **not** restyled here. If the pilot is accepted, a follow-up change applies the same look to them (and later, possibly, promotes pieces into shared tokens).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `login-page`: adds a requirement that the sign-in page presents the CINE DB identity, stays readable in both themes, fits a 320px phone without horizontal scroll, and keeps decorative motion off under reduced motion. Existing requirements are unchanged.

## Impact

- `src/pages/LoginPage.tsx` (markup and class names only; logic untouched).
- `src/App.css`: new auth-stage rules, each with its light/dark sibling, inside the existing breakpoint tiers.
- Possibly a small shared piece (e.g. a wordmark component) if the sidebar's inline "CINE DB" title is reused; the sidebar itself is not changed.
- Tests: `e2e/responsive.spec.ts` (login card overflow at narrow phone), `e2e/auth.spec.ts`, `e2e/python/test_auth.py`, `e2e/accessibility.spec.ts` and `LoginPage` unit tests must keep passing; new e2e checks for the added requirement.
- No backend, API, dependency or nginx change.
