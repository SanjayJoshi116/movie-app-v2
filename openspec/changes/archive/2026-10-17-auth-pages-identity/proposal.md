## Why

The `pilot-login-redesign` look (projector-beam stage, `Wordmark`, tagline) was accepted on 2026-10-16, but only `/login` has it. Register, Forgot password and Reset password still show the old bare card, so the sign-in flow changes style halfway through. The pilot also left two fixes page-scoped (dark text on the gold primary button, gold/brass links instead of antd blue) that are wrong app-wide: white on gold measures about 1.6:1 on every primary button, and the sidebar's gold "CINE DB" measures 1.5:1 on the light theme's cream. One readability check already fails on `main`: the light-theme "No Image" placeholder on `/movies` measures 4.26:1, under the 4.5:1 floor.

## What Changes

- Register, Forgot password (both the form and the "Check Your Inbox" state) and Reset password get the same stage as `/login`: beam, `Wordmark` as the page's main heading, tagline, and the lit card with the page's own heading demoted under it. Forms, field names, buttons, links, messages and page titles stay as they are.
- The stage markup moves into one shared component used by all four pages, so the pages can't drift apart. `/login` switches to it with no visible change.
- The sidebar's inline "CINE DB" title becomes `Wordmark` (gold in dark, brass in light), and the rail's compact "C" takes the same colors. The sidebar keeps its current height or less at 1366×768.
- Theme tokens, both themes: primary buttons get dark text on gold, and links use gold (dark) / brass (light) instead of antd's blue, everywhere. The pilot's page-scoped CSS for both is removed.
- The no-poster placeholder's text uses the theme's secondary text color, which reaches 4.5:1 on its fill in light mode.
- The TMDB callback page is left as is: it renders inside the signed-in app shell, next to the sidebar wordmark.

## Capabilities

### New Capabilities
- `auth-pages`: the account pages other than sign-in (register, forgot password, reset password) present the CINE DB identity like the sign-in page, readable in both themes, at 320px, and without decorative motion under reduced motion.

### Modified Capabilities
- `login-page`: the sign-in page also must not scroll vertically on phones (follow-up found in review).
- `theme-readability`: adds requirements that the sidebar wordmark is readable in both themes, and that primary-button text and links meet 4.5:1 app-wide in both themes. The placeholder fix is covered by the existing "Missing poster in light mode" scenario and needs no requirement change.

## Impact

- Frontend: `src/pages/RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `LoginPage.tsx`; new shared stage component in `src/components/`; `Wordmark.tsx` (size becomes optional); `Sidebar.tsx`; `src/theme/antdTheme.ts`; `PosterPlaceholder.tsx`; `App.css` (stage rules generalised, page-scoped button/link rules removed, sidebar wordmark rules).
- Tests: `themeContrast.test.ts` pins the new tokens; `Wordmark.test.tsx`; `e2e/theme-readability.spec.ts` (auth pages, sidebar wordmark, app-wide button and link); `e2e/auth.spec.ts` and `e2e/python/test_auth.py` selectors checked (they match by text, so a heading level change should not break them).
- Docs: `CLAUDE.md` conventions (auth stage, Wordmark, link/button tokens), `CHANGELOG.md` [Unreleased].
- No backend, API or dependency changes. No Docker or nginx changes.
