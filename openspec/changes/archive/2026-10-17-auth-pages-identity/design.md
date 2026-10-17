## Context

The pilot (`openspec/changes/archive/2026-10-16-pilot-login-redesign/design.md`, decision 8) set the direction: a single gold projector beam falling onto the card, `Wordmark` as the page's `h1`, a tagline at body size in `colorTextSecondary`, the card's own heading demoted to an `h2` at `FONT_SIZE.emphasis`. Poppins only. The stage lives in `App.css` (`.auth-stage`, `.auth-stage-beam`, `.auth-stage-head`, `.auth-screen`, `.wordmark`), each theme rule with its sibling.

Current state of what this change touches:
- Register, Forgot and Reset each render the old markup: a flex wrapper at `minHeight: 80vh` with a 360px `Card` and a centred level-3 title. Forgot has two states (form, "Check Your Inbox").
- `/reset-password/:uid/:token` is public but also reachable while signed in (`test_reset_link_still_works_when_signed_in`), so it can render inside the app shell next to the sidebar and above `BottomNav`. `/register` and `/forgot-password` redirect a signed-in user.
- `Sidebar.tsx` draws "CINE DB" as an inline level-3 `Typography.Title` (24px, `letterSpacing: 3`, `RATING_GOLD`) plus a compact "C" for the rail. The sidebar has zero vertical slack at 1366×768 on browse pages.
- `antdTheme.ts` sets `colorPrimary: RATING_GOLD` and no link or button text tokens, so antd uses white primary-button text and its default blue links. antd is 5.29, which has the `Button.primaryColor` component token and the `colorLink` seed token.
- `PosterPlaceholder` draws "No Image" in `colorTextTertiary` (#776e58 in light) on `colorFillSecondary`, painted over a translucent card: 4.26:1.

## Goals / Non-Goals

**Goals:**
- One stage implementation shared by all four account pages.
- Brand colors for buttons and links set once, in the theme, for both themes.
- Sidebar wordmark readable in light mode without costing sidebar height.

**Non-Goals:**
- Any other place the light theme draws gold as text (selected menu item, active tab, rating numbers). Those are a separate audit; this change only fixes the wordmark, buttons and links.
- A new font, a new `FONT_SIZE` step, or new colors beyond the pilot's brass `#7d5f00`.
- The TMDB callback page, the app's signed-in pages' layout, `BottomNav`.
- Tagline copy per page: one tagline is the identity line, the card heading says what the page is for.

## Decisions

1. **`AuthStage` component owns the stage.** `src/components/AuthStage.tsx` renders the beam (`aria-hidden`), the head (`Wordmark` + tagline) and a `Card` with class `auth-screen` holding its children. Each page passes its card heading and content. Alternative: copy the pilot markup into three more pages. Rejected: four copies of the same structure is exactly what the repo's shared-component rules exist to prevent, and a later tweak would land on one page only. The card heading stays in each page (passed as children), so heading text and the existing tests' text selectors don't move.

2. **The stage must also work inside the shell.** The pilot's `.auth-stage` cancels the content padding with negative margins and takes `min-height: 100vh`. Inside the signed-in shell (Reset only) the same rule still fits: the content area's padding is the same, and the stage simply fills the content column beside the sidebar. The phone rule's `-72px` bottom margin is checked against `BottomNav` with a signed-in Reset at 320px; if the card ends up under the nav, the stage gets `min-height: 100%` of the content area instead of `100vh` in that case. Decided at apply time by measurement, recorded in tasks.

3. **Buttons and links through tokens, not CSS.**
   - `Button.primaryColor: ON_GOLD_TEXT` in both theme configs. Not `colorTextLightSolid`: that token is also the text color of tooltips, badges and danger buttons, which sit on dark or red fills and need white.
   - `colorLink`: `RATING_GOLD` in dark, brass in light. (Found at apply: the dark algorithm re-derives the link seed, so dark links render `#d3aa17`, the same gold as the dark theme's primary buttons; tests read the derived token.) Brass becomes a named constant `LINK_BRASS` in `src/constants/ui.ts` (it is the light theme's link and wordmark color, used from TS and CSS). `colorLinkHover` / `colorLinkActive` are set explicitly too, so the hover state can't be derived into a shade under 4.5:1.
   - `themeContrast.test.ts` pins: brass on every light background ≥ 4.5:1, gold on every dark background ≥ 4.5:1, `ON_GOLD_TEXT` on `colorPrimary` and on its hover/active shades ≥ 4.5:1.
   - The pilot's `.auth-screen a` and `.auth-stage .auth-screen .ant-btn-primary` rules are deleted. The `a:hover` underline stays page-scoped to the card (it's a stage detail, not a theme rule).
   - Alternative: keep the CSS overrides and widen their selectors to the whole app. Rejected: antd components read the token in places a selector misses (Typography.Link, Pagination, Steps), and CSS would fight the token on hover.

4. **Sidebar: `Wordmark` at the heading-3 size, no glow.** `Wordmark`'s `size` becomes optional; without it the heading level's antd size applies (24px at level 3). The sidebar renders `<Wordmark level={3} className="sidebar-logo-full sidebar-wordmark" />`. The wordmark's 0.32em tracking makes 7 caps at 24px about 170px against the sidebar's 180px inner width, so `.sidebar-wordmark` narrows tracking (starting at 0.2em, tuned by measurement so the text never wraps at 220px). `.wordmark`'s line-height 1.2 makes it about 29px tall versus the current ~32px, so the sidebar loses height rather than gaining it. The compact "C" stays its own element but drops the inline `RATING_GOLD` for the same theme-scoped color class. The dark-mode glow moves from `.wordmark` to `.auth-stage .wordmark`: one lit marquee per screen, not a glowing logo on every page.

5. **Placeholder text uses `colorTextSecondary`.** `#706753` on the painted fill measures about 4.8:1 in light; the dark theme's secondary is lighter than its tertiary, so it gains contrast there too. Alternative: a lighter fill (`colorFillTertiary`) with tertiary text, about 4.55:1. Rejected: too close to the floor once painted over a translucent card on a gradient.

6. **Verification by measurement.** `e2e/theme-readability.spec.ts` gets the pilot's per-text loop for Register, Forgot (both states) and Reset, both themes; a sidebar wordmark check (full at desktop, compact in the rail) both themes; an app-wide primary button and link check on a signed-in page; and the existing 1366×768 sidebar `scrollHeight` vs `clientHeight` check on `/movies` if one exists, else a new one. Screenshots of each account page in both themes at 320/375/820/1366 go to the user before archiving.

## Risks / Trade-offs

- [Gold `colorLink` changes every link at once, including ones inside alerts and notifications] → the theme-readability check covers a signed-in page; the screenshots pass over Watchlist, Lists, Stats and the profile dialog in both themes.
- [Dark button text changes every primary button, e.g. Stats/BottomNav badges already use `ON_GOLD_TEXT` by hand] → those call sites keep working; their inline color becomes redundant but harmless, and is left alone.
- [Sidebar wordmark wraps or clips at 220px with tracking] → tracking tuned by measurement; responsive e2e checks the logo box width and single line.
- [Reset page stage inside the shell looks odd next to the sidebar wordmark (two wordmarks)] → accepted: it's a rare path (a signed-in user opening a reset email), and the stage keeps the reset page consistent with the signed-out case.
- [Antd hover shade of gold with dark text] → pinned in `themeContrast.test.ts`.
