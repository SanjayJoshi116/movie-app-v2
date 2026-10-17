## 1. Direction

- [x] 1.1 Load the `frontend-design` skill and settle the cinematic direction for `/login` within the constraints in design.md (Poppins only, existing palette, both themes, no imagery); write the chosen direction as a short note in design.md's Decisions
- [x] 1.2 Screenshot the current `/login` in both themes at 375, 820 and 1366 widths as the "before" set (scratchpad, not the repo)

## 2. Building blocks

- [x] 2.1 Add `src/components/Wordmark.tsx` (gold "CINE DB", letter-spaced, weight 700, size from `FONT_SIZE`/heading tokens), with a unit test that it renders the name
- [x] 2.2 Add any new named color the stage needs to `src/constants/ui.ts` (none inline); reuse theme tokens where they fit (none needed: stage colors, brass included, live in theme-scoped `App.css` rules, see design.md decision 8)
- [x] 2.3 Add `.auth-stage` (and child) rules to `App.css`, each under `body.dark-theme` and `body:not(.dark-theme)`, using `width: 100%` + `max-width`, no JS width checks

## 3. Login page

- [x] 3.1 Restyle `src/pages/LoginPage.tsx`: stage wrapper, `Wordmark`, tagline in `colorTextSecondary`, card heading demoted so the wordmark leads; leave every `Form.Item`, label, `autoComplete`, `autoFocus`, `disabled`/`loading`, message and link unchanged
- [x] 3.2 If there is mount motion, keep it short and non-looping, and confirm it does not run under `prefers-reduced-motion: reduce`
- [x] 3.3 Confirm `usePageTitle("Sign In")` is still the page's only title call

## 4. Tests

- [x] 4.1 Add e2e checks: wordmark and tagline visible on `/login` in dark and light themes
- [x] 4.2 Extend `e2e/theme-readability.spec.ts` to measure `/login` text (wordmark, tagline, labels, links) at ≥ 4.5:1 in both themes
- [x] 4.3 Add a reduced-motion e2e check for `/login` (emulated `reducedMotion: "reduce"`: no running animations on the stage)
- [x] 4.4 Run the specs the change touches: `e2e/responsive.spec.ts`, `e2e/auth.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/theme-readability.spec.ts`, `e2e/session-expiry.spec.ts`, `e2e/python/test_auth.py`, `e2e/python/test_a11y_routing.py`
- [x] 4.5 Run `npm run typecheck`, `npm run lint` and the Jest suite (LoginPage and theme contrast tests included)

## 5. Review

- [x] 5.1 Screenshot the new `/login` in both themes at 375, 820 and 1366 widths (and 320 for overflow) and present before/after to the user for the accept/reject call
- [x] 5.2 Record the outcome in design.md; if accepted, note the follow-up change (Register, Forgot, Reset pages; sidebar switched to `Wordmark`; candidate tokens to promote)
