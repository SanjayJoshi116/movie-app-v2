## Context

See proposal.md for the problem list. The parts of the current code that shape the approach:

- **Card navigation is mouse-only.** It happens in `onClick` on antd `Card`s or `motion.div`s, usually through `navigate(path, { state })`:
  - Several callers compute the router state **at click time**. `PeoplePage` saves `scrollY`/`loadedPages`, Home calls `stashReturnState()`, and Calendar saves its filter.
  - Nothing is focusable, and there's no `href`. The only existing keyboard handler is in `NotificationBell` (`tabIndex` + `onKeyDown`).
- **Some cards contain their own buttons:**
  - `PersonCard` has a Follow button inside a card-level `onClick`; the button calls `stopPropagation`.
  - `LibraryItemCard` puts `onOpen` on the poster `<img>` only, next to its `actionButtons`.

  Wrapping either whole card in an `<a>` would nest interactive content inside a link, which is invalid HTML and makes for confusing screen-reader output.
- **Routing:**
  - `App.tsx` ends its routes with `<Route path="*" element={<Navigate to="/movies" />}>`.
  - The auth guard only handles signed-out users: `!isLoading && !isAuthenticated && !isPublicPath → /login`.
  - `AuthContext.isLoading` starts `true`, so `/login` renders its form while the session is still being restored.
  - `LoginPage` builds its `from` target (path + search + hash) inline, per the `login-page` spec.
- **Theming:** `colorPrimary` is gold `#f5c518`. That's fine as a focus color on the dark theme, but against light backgrounds it falls well below a 3:1 contrast.

## Goals / Non-Goals

**Goals:**
- One reusable link primitive for "card that opens a page". Every card in scope then gets the same keyboard, new-tab and focus behavior.
- Keep each caller's click-time navigation state (scroll, stash) working.

**Non-Goals:**
- A full accessibility audit (color contrast across the app, heading structure, modal focus traps). This change covers only the backlog items and the same-pattern cards found while checking them.
- The brief flash of protected pages for a signed-out user while `isLoading` (the guard waits for `!isLoading`). That's a different flash and isn't in the backlog.
- Cards that already have a keyboard path through a "Details" button: `Movie`, `TVShowCard`, For You, and the Search movie/TV tabs.

## Decisions

### D1. Add a `CardLink` primitive: a real `<Link>` that can defer to a click-time handler
`src/components/CardLink.tsx` renders React Router's `<Link to={to} className="card-link" aria-label={label}>`. It takes these props:
- `to`, used as the real `href`
- an optional `state`
- an optional `onNavigate()`
- an optional `stopPropagation`

How a click is handled:
- **Plain activation** (left click without modifiers, or Enter, which browsers turn into a click on an anchor): when `onNavigate` is given, `CardLink` calls `preventDefault()` and then `onNavigate()`. The caller keeps its existing `navigate(path, { state: <computed now> })` logic. Without `onNavigate`, `Link` navigates to `to` with `state`.
- **Modifier clicks** (Ctrl/Cmd/Shift, or middle button): left alone. The browser opens `href` in a new tab or window.
- **`stopPropagation`:** set for cards that keep a card-level mouse `onClick`, so one click doesn't navigate twice.

*Alternative A:* `role="button"` + `tabIndex={0}` + an `onKeyDown` Enter/Space handler on the existing `div`s. Rejected:
- these cards navigate, so "link" is the right role
- there's no `href`, so no new tab, no URL preview and no browser context menu
- each call site would hand-roll key handling, which is exactly the kind of copy CLAUDE.md asks us to avoid

*Alternative B:* convert every caller to a static `to` + `state` prop. Rejected: router state computed at render time is stale, because `scrollY` keeps changing after render.

### D2. Whole card vs poster-only, decided by whether the card has its own controls
- **Whole card is the link** (no nested controls): `MediaCardGrid` items, MovieDetails/TVShowDetails cast cards, Calendar release cards, and Home's Recently Watched thumbnails. The existing `onClick` moves into `CardLink`; `Card` keeps `hoverable` for the visual.
- **Poster is the link** (the card has buttons):
  - `PersonCard` wraps its cover in a `CardLink`, with `to=/person/:id`, `onNavigate=onClick` and `stopPropagation`. The card-level `onClick` stays for mouse users, and the Follow button stays outside the link.
  - `LibraryItemCard` gains a required `to` prop. The cover (`img` or `PosterPlaceholder`) is wrapped in a `CardLink` with `onNavigate=onOpen`. Its three callers pass the detail path they already build inside `onOpen`.

  For these, the link's accessible name is "Open {title}" / "View profile of {name}". The existing `aria-label` on PersonCard's `Card` (a non-interactive element, where it does nothing useful) moves onto the link.

### D3. Focus style: `:focus-visible` with per-theme colors
In `App.css`, `.card-link` gets `display: block; color: inherit; text-decoration: none; border-radius: 8px` (so the outline follows the card's corners) and `outline: none` for `:focus:not(:focus-visible)`. Paired rules, following the light/dark parity convention:
- `body.dark-theme .card-link:focus-visible { outline: 2px solid #f5c518; outline-offset: 3px }`
- `body:not(.dark-theme) .card-link:focus-visible { outline: 2px solid #8a6d00; outline-offset: 3px }`

The light-theme color is a dark gold that keeps the brand hue with at least 3:1 contrast against light backgrounds.

`motion.div` hover-scale wrappers stay; keyboard focus doesn't trigger them, and it doesn't need to.

### D4. Icon-button labels
Add `aria-label`s to the 5 unlabeled icon-only `Button`s in TVShowDetails' episode-progress area:
- the Popconfirm trigger: "Remove episode progress"
- season −/+: "Previous season" / "Next season"
- episode −/+: "Previous episode" / "Next episode"

MovieDetails has no unlabeled icon-only buttons; its back, rate and add-to-list buttons all have a text label or `aria-label`. That was checked by scanning every icon `Button` in both detail components and `EpisodeGuide`.

### D5. A not-found page instead of the catch-all redirect
- **Page:** `src/pages/NotFoundPage.tsx` renders `<LoadError notFound title="Page not found" subTitle="There's nothing at this address." />` plus a primary "Go to Movies" `<Link>` button. `LoadError` itself is unchanged (it only renders Retry for the error variant), and the page adds its own action below it.
- **Route:** `<Route path="*" element={<NotFoundPage />} />` replaces the `Navigate`. `/` keeps redirecting to `/movies`.
- **Signed-out users:** the existing guard already sends a signed-out user on an unknown path to `/login` with `from` set to that path, so after signing in they see the 404 with the address they typed.

### D6. Redirect signed-in users away from auth pages, sharing the `from` rule
- **Shared helper:** move LoginPage's inline `from` computation into `src/utils/postLoginPath.ts` (`postLoginPath(location.state): string`, returning path + search + hash, or `/movies`). `LoginPage` and `App` both call it, so the `login-page` spec's rule has a single implementation.
- **`App.tsx` guard:** `AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password"]`. Before rendering routes:
  - `isLoading` on an auth-only path → render `null` (the same blank the `Suspense` fallback shows)
  - `isAuthenticated` on an auth-only path → `<Navigate to={postLoginPath(location.state)} replace />`

  `/reset-password/...` stays public and is excluded.
- **Login race:** after a successful sign-in, `setUser` flips `isAuthenticated`, so `App` redirects to the same target `LoginPage` was about to `navigate` to. The page's own `navigate` then runs after unmount and does nothing. That's harmless, and it goes to the same place either way. `RegisterPage`'s `navigate("/movies")` behaves the same way.

## Risks / Trade-offs

- **[Some e2e tests click a card element that's no longer the navigation target]** → Mouse clicks anywhere on whole-card links still navigate, because the link *is* the card. For PersonCard the card-level `onClick` is kept. LibraryItemCard only ever navigated from the poster, and the poster is still the target. Run the full Python + TS e2e suites; fix selectors only if one depended on the old DOM shape.
- **[An `<a>` around an antd `Card` changes inherited text color and underline]** → `.card-link { color: inherit; text-decoration: none }`. Verify visually in both themes in the live check.
- **[Enter on a focused poster link inside a card that also has a card-level onClick could double-navigate]** → `CardLink`'s `stopPropagation` option, set for PersonCard.
- **[`postLoginPath` returning `/login` itself (state.from = /login) would loop]** → The helper ignores a `from` that is one of the auth-only paths and falls back to `/movies`. A unit test covers it.

## Migration Plan

Frontend only. Ship with the next version bump. Rolling back is a code revert.
