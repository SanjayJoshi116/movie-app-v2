## Why

The F5 module review (backlog item 62) found ten verified issues in the app shell and theme. Four are medium severity:
- The sign-in page guard misses `/login/` and `/LOGIN`, so a signed-in user can sign in again in place and get a stale library.
- Dark-theme users see a light flash on every load.
- A crash on a sign-in, callback or 404 page takes down the whole app.
- A malformed history entry can crash the shell.

The rest are small UX, theme-parity and type-accuracy gaps.

## What Changes

- **Sign-in page guard:** recognises `/login`, `/register` and `/forgot-password` however the path is written (case, trailing slash). The post-login target uses the same check.
- **Theme:**
  - The saved theme is applied to the page before React renders, so there's no light flash.
  - The browser's address-bar color (`theme-color`), `color-scheme` and Firefox scrollbars follow the active theme.
  - The dead dark-only `Layout` override is removed.
- **Shell robustness:**
  - The sign-in, password, TMDB callback and not-found routes get their own error boundary, like every other route.
  - A restored Anime category is used only when it is a string.
- **Filter drawer:** it closes when the user leaves the browse pages or the session ends, instead of reopening on the next browse page.
- **Links:** Prime Video provider links open Prime Video's own search, which works in every region, instead of the amazon.com US store.
- **Types:**
  - `TMDBMovieDetail.certifications` is the release-date array it holds at runtime.
  - The raw movie response type marks its appended parts optional.
  - `AppContextType` derives its UI fields from `UIContextType`.
  - Callers that only need UI fields move to `useUIContext()`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `routing`: sign-in pages are recognised however their address is written.
- `theme-readability`: the page opens in the chosen theme; browser UI follows the theme.
- `load-states`: a page that fails to render keeps the rest of the app usable, and malformed restored state doesn't break the app.
- `browse-filters`: the filter drawer opens only when the user opens it.
- `title-details`: Prime Video links work in the user's region.

## Impact

- Frontend:
  - Shell and theme: `App.tsx`, `index.tsx`, `App.css`, `public/index.html`, `context/UIContext.tsx`, `utils/postLoginPath.ts`, `theme/antdTheme.ts`
  - Constants and types: `constants/providers.ts`, `types/tmdb.ts`, `types/context.ts`, `context/useAppContext.ts`
  - The UI-only `useAppContext()` callers.
- Tests: Jest for the guard, theme bootstrap, boundaries, restored state and drawer. The theme parity test (`themeContrast`) must stay green. e2e: routing/auth specs, theme-readability, browse-restore.
- No backend change, no dependency.
