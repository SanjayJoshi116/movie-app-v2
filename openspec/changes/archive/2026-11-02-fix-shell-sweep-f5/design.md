## Context

See proposal.md for the findings (backlog item 62). The current state that matters:

- `App.tsx`:
  - The guard checks `AUTH_ONLY_PATHS.includes(location.pathname)`, and `postLoginPath` does the same check on `from.pathname`.
  - React Router v6 matches `/login/` and `/LOGIN` to the `/login` route.
- Theme:
  - The theme lives in `UIContext` (`useLocalStorage("cinedb_theme", "dark")`), and an effect toggles `body.dark-theme`.
  - `App.css` styles the unclassed body as light.
  - `public/index.html` has a fixed `theme-color` and no `color-scheme`. The CSP is `script-src 'self'`, so no inline script can run before the bundle.
- Error boundaries: every route except the sign-in, password, callback and `*` routes is wrapped in an `ErrorBoundary` inside `ConfigProvider`. The root boundary in `index.tsx` sits outside the providers.

## Goals / Non-Goals

**Goals:**
- Fix the ten findings of item 62, each with a test where it is testable in Jest.

**Non-Goals:**
- Removing the `useAppContext()` shim. Callers that need library data keep it; only UI-only callers move.
- Rendering the root error boundary's fallback in the theme. It catches only what the route boundaries can't, and stays a last resort.
- Clearing session caches on an in-place sign-in. The guard fix removes the only path to an in-place sign-in.

## Decisions

**1. One path check.**
- `utils/postLoginPath.ts` exports `isAuthOnlyPath(pathname)`: lower-case the path, strip trailing slashes (keeping `/`), then match against `AUTH_ONLY_PATHS`.
- `App.tsx`'s guard and `postLoginPath`'s `from` check both use it. The reset-link check uses the same normalised path with `startsWith`.
- Rejected: `matchPath` over the routes. It needs the route patterns duplicated or exported, while the three paths are fixed strings.

**2. Theme applied before render.**
- A new `utils/documentTheme.ts` exports `applyDocumentTheme(theme)`. It toggles `body.dark-theme`, sets `document.documentElement.style.colorScheme` (`dark`/`light`), and updates `<meta name="theme-color">` to that theme's `colorBgLayout`, read from `antdTheme.ts` so no color literal is added.
- `index.tsx` calls it with `readStoredTheme()` (`JSON.parse` of `cinedb_theme` with a `"dark"` fallback, matching `useLocalStorage`'s encoding) before `createRoot().render`.
- `UIContext`'s effect calls the same function on change.
- The bundle loads with `defer`, so the first paint before it still uses the HTML's background. `public/index.html`'s `<body>` therefore gets the dark class as its static default, which matches the default theme. Light users see their background from the bundle's first statement, the reverse of today's case and limited to non-default users.
- Rejected: an inline script, which the CSP forbids. Also rejected: flipping the CSS default to dark and scoping light, because it rewrites every `body:not(.dark-theme)` rule.

**3. Scrollbars.** `App.css` adds `scrollbar-color` on `html` per theme, scoped like the existing `::-webkit-scrollbar` pair (`body.dark-theme` / `body:not(.dark-theme)` can't style `html`, so it uses `html:has(body.dark-theme)`). Browsers without `:has()` keep their default scrollbar, which is today's behaviour.

**4. Route boundaries.** The sign-in, register, forgot-password, reset-password, tmdb-callback and `*` routes get `<ErrorBoundary>` like the rest. They sit inside `ConfigProvider`, so the fallback has the theme's tokens, and inside the keyed `<Routes>`, so a navigation remounts them.

**5. Restored category.** Adopt the restored mode only when `typeof restore.activeCategory === "string"`.

**6. Drawer reset.** In render, alongside the existing resets:
- When `filterScope` becomes null (left the browse pages), set `showFilterPanel` false.
- On the signed-in → signed-out transition, set it false too.

**7. Prime Video.**
- Ids 9 and 119 use `https://www.primevideo.com/search/?phrase=<title>`, Prime Video's own site search, which serves the visitor's region.
- Check at implement time that the URL opens a search, and record the result in the task.

**8. Types.**
- `TMDBMovieDetail.certifications` becomes `TMDBReleaseDates["results"]`, and `MovieDetails.tsx`'s local override goes.
- `TMDBMovieDetailResponse` stops extending the app-built fields and makes `credits`, `videos`, `images`, `release_dates`, `recommendations`, `similar`, `reviews` and `watch/providers` optional, as the TV response does.

**9. Context types.**
- `AppContextType` takes its UI members as `Pick<UIContextType, "searchTerm" | "setSearchTerm" | "clearSearch" | "includeAdult" | "setIncludeAdult" | "theme" | "toggleTheme">`.
- Each non-test `useAppContext()` caller that reads only those members switches to `useUIContext()`.

**10. Dead config.** Delete `darkThemeConfig.components.Layout`.

## Risks / Trade-offs

- [The static dark class on `<body>` makes light users see dark until the bundle runs] → It is one bundle-parse long and only for the non-default theme, versus today's flash for every default user.
- [The Prime Video URL format changes] → It's in one constant. The task checks it once.
- [Type tightening exposes unguarded reads of appended parts] → Fix the reads it surfaces (they already go through `appended.ts` guards), and keep the change type-only where possible.
