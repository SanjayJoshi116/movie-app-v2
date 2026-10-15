## 1. Reduced motion

- [x] 1.1 `index.tsx`: wrap the app in `<MotionConfig reducedMotion="user">`
- [x] 1.2 `App.css`: `@media (prefers-reduced-motion: reduce)` shortening animations and transitions everywhere
- [x] 1.3 `StatsPage.tsx` `useCountUp`: final value at once under reduced motion; Jest

## 2. Page titles and announcements

- [x] 2.1 `src/hooks/usePageTitle.ts` (sets/resets `document.title`, publishes the latest title) + Jest
- [x] 2.2 `src/components/RouteAnnouncer.tsx` (visually hidden polite live region, announces the settled title after a pathname change, not on first render) in `App.tsx` + Jest
- [x] 2.3 Call `usePageTitle` on every page; Movie/TV/person pages use the loaded name
- [x] 2.4 e2e: tab title per page (Watchlist, a movie page) and the announcer text after navigation

## 3. Card buttons, nav links, password fields

- [x] 3.1 Watchlist/Watched/ListDetail card action labels include the title
- [x] 3.2 Sidebar entries are `<Link>`s, no double navigation; BottomNav core buttons `href` + `isPlainClick`, More drawer `<Link>`s
- [x] 3.3 `ProfileModal` password fields: `current-password` / `new-password`
- [x] 3.4 e2e: a sidebar entry has an href and a plain click routes in-app with one history entry; a library card button's name includes its title; profile fields' autocomplete attributes

## 4. Mark as Watched

- [x] 4.1 `MarkWatchedModal`: `onConfirm` returns a Promise; busy state blocks close and repeat confirms; stays open on rejection
- [x] 4.2 Six callers rethrow after showing their error and close only on success
- [x] 4.3 Jest: busy blocks Cancel/Escape; failure keeps the dialog and its values; success closes

## 5. Marquee

- [x] 5.1 `MarqueeTitle`: ellipsis at rest, `title` attribute, `ResizeObserver`, no scroll under reduced motion; Jest

## 6. Contrast

- [x] 6.1 Measure light and dark secondary/tertiary against each theme's three backgrounds; set tokens (explicit `colorTextTertiary` in both) to ≥ 4.5:1
- [x] 6.2 Jest pinning the computed contrast of the theme tokens
- [x] 6.3 `theme-readability.spec.ts`: text floor 4.5

## 7. Verify

- [x] 7.1 Typecheck, lint, Jest (`--maxWorkers=2`)
- [x] 7.2 e2e: accessibility, theme-readability, responsive, detail-and-nav, write-feedback, watchlist (both projects); Python `test_a11y_routing.py`, `test_watchlist.py`, `test_watched.py`
- [x] 7.3 Run the app with reduced motion emulated and screen-reader-relevant checks (titles, announcer, nav links)

## 8. Docs

- [x] 8.1 CLAUDE.md: page titles via `usePageTitle`, reduced motion, nav entries are links, AA floor for text tokens, MarkWatchedModal's `onConfirm` contract
- [x] 8.2 README features; `docs/BUG_BACKLOG.md` item 37 → 📝, and the "Open, not yet grouped" contrast note pointing here
