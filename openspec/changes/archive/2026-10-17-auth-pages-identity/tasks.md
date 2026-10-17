## 1. Theme tokens

- [x] 1.1 Add `LINK_BRASS = "#7d5f00"` to `src/constants/ui.ts`
- [x] 1.2 In `antdTheme.ts`, set `Button.primaryColor: ON_GOLD_TEXT` in both configs, and `colorLink` / `colorLinkHover` / `colorLinkActive` (gold family in dark, brass family in light)
- [x] 1.3 Extend `src/theme/__tests__/themeContrast.test.ts`: link colors (rest, hover, active) ≥ 4.5:1 on every background of their theme; `ON_GOLD_TEXT` ≥ 4.5:1 on `colorPrimary` and its hover/active shades
- [x] 1.4 Delete the pilot's page-scoped `.auth-screen a` color rules and the `.auth-stage .auth-screen .ant-btn-primary` rule from `App.css`; keep the card's link hover underline

## 2. Shared stage

- [x] 2.1 Create `src/components/AuthStage.tsx` (beam `aria-hidden`, head with `Wordmark` + tagline, `Card.auth-screen` max 360px with children) and a unit test for its landmarks (h1 wordmark, tagline, children rendered)
- [x] 2.2 Move the dark-mode wordmark glow from `.wordmark` to `.auth-stage .wordmark`
- [x] 2.3 Switch `LoginPage.tsx` to `AuthStage`; confirm no visible change against the pilot screenshots and that `auth.spec.ts` and the `/login` readability test still pass

## 3. Account pages

- [x] 3.1 `RegisterPage.tsx` on `AuthStage`; card heading becomes a left-aligned level-2 "Create Account" at `FONT_SIZE.emphasis`, form untouched
- [x] 3.2 `ForgotPasswordPage.tsx` on `AuthStage`, both states ("Forgot Password" form and "Check Your Inbox"), same heading treatment
- [x] 3.3 `ResetPasswordPage.tsx` on `AuthStage`, same heading treatment
- [x] 3.4 Check the signed-in Reset case at 320px and 1366px: no horizontal scroll, card not under `BottomNav`; if it is, adjust the stage's height rule for the in-shell case and note the outcome here. Outcome: fits as is at 320 and 1366 (the content area's bottom padding already clears `BottomNav`); no rule change.
- [x] 3.5 Check `e2e/auth.spec.ts`, `e2e/python/test_auth.py` and `e2e/python/test_a11y_routing.py` selectors against the new heading levels; run them

## 4. Sidebar wordmark

- [x] 4.1 Make `Wordmark`'s `size` optional (heading level's size when omitted); update `Wordmark.test.tsx`
- [x] 4.2 Replace the sidebar's inline title with `<Wordmark level={3} …>`; tune `.sidebar-wordmark` tracking so it stays on one line at 220px; give the compact "C" the theme-scoped wordmark color instead of inline `RATING_GOLD`
- [x] 4.3 Measure `.app-sidebar` `scrollHeight` vs `clientHeight` at 1366×768 on `/movies`, `/tv`, `/anime` (expect no increase from today). Outcome: no scrollbar on any of the three (responsive.spec.ts); the wordmark box is ~29px vs ~32px before.

## 5. Placeholder contrast

- [x] 5.1 `PosterPlaceholder` text to `colorTextSecondary`; the existing light placeholder readability test passes

## 6. Readability checks

- [x] 6.1 `e2e/theme-readability.spec.ts`: per-text contrast loop for `/register`, `/forgot-password` (both states), `/reset-password/…`, both themes
- [x] 6.2 Sidebar wordmark contrast at desktop (full) and tablet (rail "C"), both themes
- [x] 6.3 App-wide check on a signed-in page with an enabled primary button and a text link: button text dark and ≥ 4.5:1, link not blue and ≥ 4.5:1, both themes
- [x] 6.4 320px no-horizontal-scroll and reduced-motion (beam not animating) checks cover the three new pages
- [x] 6.5 A 1366×768 browse-page check that the sidebar shows no scrollbar, if `e2e/responsive.spec.ts` doesn't have one already

## 7. Verify and document

- [x] 7.1 `npm run typecheck`, `npm run lint`, Jest (`--maxWorkers=2`), and the touched e2e specs (`theme-readability`, `auth`, `responsive`, Python `test_auth.py`, `test_a11y_routing.py`)
- [x] 7.2 Screenshots of Register, Forgot (both states), Reset (signed out and signed in), plus sidebar and one signed-in page with buttons/links, both themes at 320/375/820/1366, for the user's review
- [x] 7.3 `CLAUDE.md`: account pages use `AuthStage`; brand mark is always `Wordmark`; link and primary-button text colors come from the theme tokens, never per-page CSS; `LINK_BRASS` in the shared constants list
- [x] 7.4 `CHANGELOG.md` [Unreleased] entry

## 8. Follow-up from review

- [x] 8.1 Sign-in page must not scroll vertically on phones: shell and stage use `100svh` (fallback `100vh`), stage spacing tightens under `max-height: 640px`; e2e at 320x568, 375x667, 390x844
- [x] 8.2 Keyboard open on phones: stage adapts to height (svh clamps, tagline hidden ≤520px, header visually hidden + tighter card ≤420px); `AuthStage` sets `interactive-widget=resizes-content` while mounted. Login/forgot/reset measured without scroll from 915 down to 330px tall; e2e covers 412x480, 390x440, 375x330 and the meta restore
