## 1. Routing and shell robustness

- [x] 1.1 `isAuthOnlyPath(pathname)` in `utils/postLoginPath.ts` (lower-case, strip trailing slashes); used by `App.tsx`'s guard and `postLoginPath`; reset-link check on the normalised path
- [x] 1.2 `ErrorBoundary` around the sign-in, register, forgot-password, reset-password, tmdb-callback and `*` routes
- [x] 1.3 Restored Anime mode adopted only when `activeCategory` is a string
- [x] 1.4 `showFilterPanel` reset when the browse scope becomes null and on sign-out, in render
- [x] 1.5 Jest: `isAuthOnlyPath` cases; `postLoginPath` with `from: /login/`; signed-in `/login/` redirects; a throwing lazy auth route shows the boundary inside the layout; non-string restored category doesn't throw; drawer closed after leaving and returning, and after sign-out

## 2. Theme

- [x] 2.1 `utils/documentTheme.ts`: `applyDocumentTheme(theme)` (body class, `colorScheme`, `theme-color` from the theme config's `colorBgLayout`) and `readStoredTheme()`
- [x] 2.2 `index.tsx` applies the stored theme before render; `UIContext` effect uses `applyDocumentTheme`; `public/index.html` body starts with `class="dark-theme"`
- [x] 2.3 `App.css`: `scrollbar-color` per theme on `html` (via `:has`)
- [x] 2.4 Remove the dark-only `Layout` override from `antdTheme.ts`
- [x] 2.5 Jest: `applyDocumentTheme` sets class, color-scheme and meta for both themes; `readStoredTheme` handles JSON, a bare string and a missing key; `themeContrast` still passes

## 3. Links and types

- [x] 3.1 Prime Video ids 9 and 119 link to Prime Video's own search; check the URL opens a search and note the result here (checked 2026-11-02: `https://www.primevideo.com/search/?phrase=Fight%20Club` is a "Prime Video: Search" page with Fight Club first)
- [x] 3.2 `TMDBMovieDetail.certifications` typed as release-date results; `TMDBMovieDetailResponse` appended parts optional and without app-built fields; drop `MovieDetails.tsx`'s local override; fix any reads it surfaces
- [x] 3.3 `AppContextType` UI members derived from `UIContextType`; UI-only `useAppContext()` callers move to `useUIContext()` (update their test mocks)

## 4. Docs and checks

- [x] 4.1 CLAUDE.md: theme applied before render via `applyDocumentTheme`; `isAuthOnlyPath`; every route has a boundary; backlog item 62 marked proposed
- [x] 4.2 Run Jest (full, `--maxWorkers=2`), typecheck, lint; e2e only touched specs (auth/routing, theme-readability, browse-restore, responsive)
