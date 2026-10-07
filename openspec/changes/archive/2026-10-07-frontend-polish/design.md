## Context

See proposal.md for the item list. All items were re-checked against the current tree (after `fix-browse-filters` and `fix-data-correctness`). Current state:

- **`StatsPage.tsx` hardcodes dark-only colors:**
  - `rgba(255,255,255,0.35–0.7)` text at lines 101, 130, 136, 200, 239, 243 and 297
  - an empty heatmap cell of `rgba(255,255,255,0.06)` (`heatColor`, line 175)
  - two tooltips with a fixed dark background (`rgba(10,10,20,0.95)`), white text and white borders (`CustomTooltip` line 91, the heatmap hover portal line 246)

  Nothing in the file reads the theme.
- **The theme tokens Stats needs already exist in both themes** (`src/theme/antdTheme.ts`): `colorText`, `colorTextSecondary`, `colorBorderSecondary`, `colorBgElevated`. CLAUDE.md asks for `theme.useToken()` instead of literals.
- **`getRatingColor` exists 5 times, identical** (≥8 green, ≥5 `#faad14`, else `#ff4d4f`): `Movie.tsx`, `TVShowCard.tsx`, `CalendarPage.tsx`, `RecommendationsPage.tsx`, `SearchPage.tsx`. `avatarColor` (with its `AVATAR_COLORS` table) is duplicated in `Sidebar.tsx` and `BottomNav.tsx`.
- **There are 32 hardcoded `#52c41a`/`#f5c518` literals** across 12 files. Two of them are the constant definitions themselves (`ui.ts`), and some are in `antdTheme.ts`.
- **The CRA defaults are confirmed:**
  - `public/logo192.png` is the React atom (viewed), and `favicon.ico`/`logo512.png` match CRA's default byte sizes (3870/9664)
  - `manifest.json` says "React App"/"Create React App Sample"
  - `index.html` has the CRA description and three template comments (its `<title>` is already "CineDB")
- **`RecommendationsPage` keeps a `hasFetched` ref** that gates its fetch/poll effect (`[isDataLoading, watchedList.length]` deps). The "Try again" link calls `window.location.reload()`.

## Goals / Non-Goals

**Goals:**
- Stats reads the theme; nothing on it is white-on-white in light mode. Dark mode stays pixel-equivalent.
- One source per shared color helper or constant.

**Non-Goals:**
- **New icons or branding.** Replacing the React-logo icons needs real artwork (see Open Questions). This change only fixes the text metadata.
- **Auditing light mode on every other page.** Stats is the only page with a known bug. The spec capability is page-agnostic so later fixes can add requirements.
- **Uninstalling the `web-vitals` npm package.** `package.json`/the lockfile belong to the parallel `fix-dependency-drift` change. Here we only delete the code that imports it. A note goes in that change's lane.
- **Changing `ErrorBoundary`'s `window.location.reload()`.** A crashed render tree has no in-place recovery, so a reload is correct there.
- Accessibility labels, routing and CI. Those are sibling changes.

## Decisions

### D1. Stats colors come from `theme.useToken()`
The main `StatsPage` component reads `const { token } = theme.useToken()` and passes the token, or the derived colors, down to `CustomTooltip`, `ActivityHeatmap`, the stat card and the poster caption. Mapping:
- **Label and caption text:** `token.colorTextSecondary`. The dark value `#a0a0b8` is close to the current `rgba(255,255,255,0.5)` on navy.
- **"Faint" text** (suffix, legend, month labels, previously alpha 0.35–0.4): `token.colorTextTertiary`. That's antd's derived token, already present in both themes.
- **Empty heatmap cell:** `token.colorFillTertiary`.
- **Tooltip background, border and text:** `token.colorBgElevated`, `token.colorBorderSecondary`, `token.colorText`.
- **Series-colored tooltip lines:** unchanged (they use `p.color`). Their fallback `#fff` becomes `token.colorText`.

The heatmap's green scale (`#1a5c2a`…`#39d353`) stays as is. It's GitHub's contribution palette and reads fine on both backgrounds.

*Alternative:* scoped CSS rules in `App.css` (`body.dark-theme .stats-label`). Rejected: these are inline styles inside Recharts render props and a portal, so tokens are the direct fix. CLAUDE.md prefers tokens over hex for one-off colors.

**Dark-mode parity check:** the swapped values are close but not identical (for example `#a0a0b8` vs white at 0.5 alpha). The verification task compares before/after dark-mode screenshots and accepts small tonal shifts, not layout changes.

### D2. One `src/utils/colors.ts`
- **`ratingColor(vote)`:** the shared rule. `≥8` → `WATCHED_GREEN`, `≥5` → `RATING_WARN`, else `RATING_BAD`. The two new constants go in `ui.ts`.
- **`avatarColor(username)`:** together with `AVATAR_COLORS`.

All 7 call sites import these.

Literal sweep: every remaining `#52c41a`/`#f5c518` in components and pages becomes `WATCHED_GREEN`/`RATING_GOLD`. `antdTheme.ts` keeps literals where the theme config needs plain values, but imports the constants where it can. A `grep` with an empty result outside `ui.ts`/`antdTheme.ts` is the done-check.

### D3. TMDB image size constants
Add `STILL_URL = ".../w300"` and `LOGO_URL = ".../w92"` to `ui.ts`, next to `IMG_URL`/`POSTER_THUMB_URL`. Use them in `EpisodeGuide` and `WatchProviders`.

### D4. Widths
- **`FilterPanel`'s antd `Drawer`:** `width={320}` → `width="min(320px, 100vw)"` (antd accepts a CSS string). A drawer has no wrapper to put `maxWidth` on, so `min()` is the equivalent of the convention.
- **`NotificationBell`'s popup:** `style={{ width: "100%", maxWidth: 320, ... }}`. Check that the `Dropdown` popup still sizes to 320 on desktop. If `width: 100%` collapses inside the popup container, use `width: "min(320px, calc(100vw - 32px))"` instead.

### D5. In-place For You retry
- Add `const [retryToken, setRetryToken] = useState(0)` to the fetch/poll effect's deps.
- A `retry()` handler:
  - sets `hasFetched.current = false`
  - calls `setFetchError(false)` and `setLoading(true)`
  - bumps `retryToken`
- The error branch renders `<LoadError title="Couldn't load recommendations" onRetry={retry} />` instead of the `Empty` + link, per the `surface-failures` convention.

This mirrors `usePaginatedFetch`'s `retryToken`.

### D6. Types for the `any`s
Checked against `src/types/tmdb.ts`:
- **`TVShowDetails`:** add `created_by?: { id: number; name: string }[]` to `TMDBTVDetail` and drop the `(tvShow as any)` cast.
- **`MovieDetails` crew:** `TMDBCrewMember` already has `job`. Type the `credits.crew` elements as `TMDBCrewMember` (or make `TMDBCredits.crew` use it) and drop the `(c: any)` annotations.
- **`MovieDetailPage`:** the API returns `recommendations` as a paginated object (`append_to_response`), but `TMDBMovieDetail.recommendations` is the app-level flattened array. That mismatch is why the cast exists. Add a raw response type `TMDBMovieDetailResponse = Omit<TMDBMovieDetail, "recommendations"> & { recommendations?: TMDBPaginatedResponse<TMDBMovieSummary> }` for the fetch, and keep the flattened `TMDBMovieDetail` for state.
- **`CalendarPage`:** `TMDBTVSummary` already declares `first_air_date`, so the `(t as any)` cast is simply stale. Remove it.
- **`RegisterPage`:** `catch (err: unknown)`. Keep the per-field message join (narrow `isAxiosError(err)` before reading `err.response?.data`), and fall back to `getApiError(err, "Registration failed.")`.

### D7. CRA cleanup
- **`manifest.json`:**
  - `short_name`/`name`: "CINE DB"
  - `theme_color`/`background_color`: the dark theme's background token value, so the splash isn't white-flash-then-navy
  - icons: entries kept as they are (same files)
- **`index.html`:** meta description "CINE DB — track the movies and TV shows you watch, rate them, and get recommendations.", and the three template comments are removed. `<title>` stays.
- **`src/logo.svg`:** deleted (unused).
- **`reportWebVitals`:** `src/reportWebVitals.ts` and its import/call in `index.tsx` are deleted.
- **`App.tsx`:** the `eslint-disable-next-line @typescript-eslint/no-unused-vars` above `TMDBCallbackPage` is removed. It's used by the `/tmdb-callback` route.

## Risks / Trade-offs

- **[Token swaps shift dark-mode tones slightly]** → Compare before/after screenshots. If a value visibly regresses, use an alpha of `token.colorText` instead of the named token.
- **[`width: 100%` inside antd's dropdown popup may collapse]** → D4 names the fallback, and it gets verified at desktop and phone widths.
- **[Removing the `any`s may expose a real shape mismatch, so `tsc` fails]** → That's the point. Fix it at the type, not with a cast. If a field is genuinely optional in TMDB's response, mark it optional and handle `undefined`.

## Open Questions

- **App icons:** `favicon.ico`, `logo192.png` and `logo512.png` are still the React logo. Replacing them needs CINE DB artwork, which this change shouldn't invent. Until the user supplies an icon (or approves a simple generated wordmark), the manifest and HTML keep pointing at the existing files. Answering this later only adds or swaps files; it doesn't change the approach or tasks.
