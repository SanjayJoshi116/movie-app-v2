## 1. Shared pieces

- [ ] 1.1 Add `src/components/CardLink.tsx` (`to`, `state?`, `onNavigate?`, `stopPropagation?`, `label?`, `className?`): plain left-click/Enter with `onNavigate` → `preventDefault()` + `onNavigate()`; modifier/middle clicks fall through to the native `href`
- [ ] 1.2 `App.css`: `.card-link` base rule + `:focus:not(:focus-visible)` reset + paired `body.dark-theme` / `body:not(.dark-theme)` `:focus-visible` outlines (D3)
- [ ] 1.3 Add `src/utils/postLoginPath.ts` (path + search + hash from `state.from`, falls back to `/movies`, ignores auth-only paths); switch `LoginPage` to it; Jest tests (query/hash kept, missing state → `/movies`, `from=/login` → `/movies`)
- [ ] 1.4 Jest test for `CardLink` (renders an `<a href>`; Enter/click calls `onNavigate` and not the default; Ctrl-click doesn't call `onNavigate`; `stopPropagation` stops the parent handler)

## 2. Whole-card links

- [ ] 2.1 `MediaCardGrid`: wrap each `Card` in `CardLink to=/{type}/{id} label={name}`; drop the card `onClick`
- [ ] 2.2 MovieDetails + TVShowDetails cast cards: `CardLink to=/person/{id} label={actor.name}`; move the `aria-label` off the `Card`
- [ ] 2.3 CalendarPage release cards: `CardLink` with `onNavigate` keeping the existing `navigate(..., { state: { from, scrollY, mediaFilter, isReturn } })`
- [ ] 2.4 HomePage Recently Watched thumbnails: `CardLink` with `onNavigate` = `stashBrowseState()` + `navigate`, `label={item.title}`

## 3. Poster-only links on cards with controls

- [ ] 3.1 `PersonCard`: wrap the cover in `CardLink to=/person/{id} onNavigate={onClick} stopPropagation label="View profile of {name}"`; keep card-level `onClick` for the mouse; move `aria-label` off the `Card`
- [ ] 3.2 `LibraryItemCard`: add required `to` prop; wrap the cover (`img` / `PosterPlaceholder`) in `CardLink to={to} onNavigate={onOpen} label="Open {title}"`; drop the `onClick`s on `img`/placeholder
- [ ] 3.3 Pass `to` from `WatchlistPage`, `WatchedPage`, `ListDetailPage`

## 4. Labels and routing

- [ ] 4.1 TVShowDetails: `aria-label`s on the remove-progress trigger and the four season/episode stepper buttons
- [ ] 4.2 Add `src/pages/NotFoundPage.tsx` (`LoadError notFound` + "Go to Movies" link button); replace the `*` route's `Navigate` with it
- [ ] 4.3 `App.tsx`: `AUTH_ONLY_PATHS`; render `null` while `isLoading` on them; `<Navigate to={postLoginPath(location.state)} replace />` when authenticated; keep `/reset-password/...` public
- [ ] 4.4 `npx tsc --noEmit` and Jest

## 5. Tests and verification

- [ ] 5.1 Python e2e (`e2e/python`): keyboard — on a mocked movie detail page, focus a "Similar" card link and press Enter → URL is that title's detail page; 404 — `authed_page.goto("/does-not-exist")` shows "Page not found" and keeps the URL, its link goes to `/movies`; auth redirect — authed `goto("/login")` lands on `/movies` and the login form never appears. Mock every endpoint the visited pages call (CLAUDE.md base-fixture rule)
- [ ] 5.2 Run the full Python e2e suite and the TS Playwright specs; fix any selector that relied on the old card DOM
- [ ] 5.3 Live check under `npm run dev` with a throwaway `verify_*.py`: Tab through a detail page's Similar grid and cast row and open one with Enter; Ctrl-click a Calendar card opens a new page; focus outline visible in light and dark (screenshots); PersonCard Follow via keyboard doesn't navigate; `/moviez` shows the 404; reload of `/login` while signed in never paints the form (check for the form selector across the navigation). Delete the script afterwards
- [ ] 5.4 Docs: add a CLAUDE.md convention ("card that opens a page → `CardLink`, poster-only when the card has buttons") and an `ARCHITECTURE.md` rationale bullet for D1/D6
