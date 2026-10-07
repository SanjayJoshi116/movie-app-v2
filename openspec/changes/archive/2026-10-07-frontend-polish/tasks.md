## 1. Stats readable in light mode

- [x] 1.1 `StatsPage`: read `theme.useToken()`; replace the `rgba(255,255,255,…)` label/suffix/legend/month/caption colors with `colorTextSecondary`/`colorTextTertiary`, the empty heatmap cell with `colorFillTertiary`
- [x] 1.2 `CustomTooltip` and the heatmap hover portal: background `colorBgElevated`, border `colorBorderSecondary`, text `colorText` (series color fallback `colorText` instead of `#fff`)
- [x] 1.3 Grep `StatsPage.tsx` for remaining `rgba(255` / `#fff` and confirm none are left outside the heatmap green scale

## 2. Shared colors and constants

- [x] 2.1 Add `src/utils/colors.ts` with `ratingColor(vote)` and `avatarColor(username)` (+ `AVATAR_COLORS`); add `RATING_WARN`/`RATING_BAD` to `src/constants/ui.ts`
- [x] 2.2 Replace the 5 `getRatingColor` copies (`Movie.tsx`, `TVShowCard.tsx`, `CalendarPage.tsx`, `RecommendationsPage.tsx`, `SearchPage.tsx`) and the 2 `avatarColor` copies (`Sidebar.tsx`, `BottomNav.tsx`)
- [x] 2.3 Replace remaining `#52c41a`/`#f5c518` literals with `WATCHED_GREEN`/`RATING_GOLD`; done when `grep -rn "#52c41a\|#f5c518" src` only hits `constants/ui.ts` (and `antdTheme.ts` where a literal is unavoidable)
  - **Note:** `src/App.css`'s scrollbar-thumb hover (`#f5c518`) stays a literal: plain CSS can't import a TS constant.
- [x] 2.4 Add `STILL_URL` (w300) and `LOGO_URL` (w92) to `ui.ts`; use them in `EpisodeGuide.tsx` and `WatchProviders.tsx`
- [x] 2.5 Jest: `ratingColor` thresholds (8, 7.9, 5, 4.9) and `avatarColor` determinism

## 3. Widths and inputs

- [x] 3.1 `FilterPanel` Drawer `width="min(320px, 100vw)"`
- [x] 3.2 `NotificationBell` popup `width: "100%", maxWidth: 320` (fallback `min(320px, calc(100vw - 32px))` if the popup collapses); check desktop + 375px phone
  - **Note:** `width: "100%", maxWidth: 320` collapsed the popup to ~90px (desktop/tablet), so the fallback `min(320px, calc(100vw - 32px))` is used: 320px wide on desktop/tablet/phone. Found a pre-existing bug while checking: the popup renders partly off the left edge at every breakpoint (left ≈ -230px desktop, -85px at 375px), identical with the original `width: 320`, because no `placement` is set and the popup is mounted inside the sidebar/bottom-nav. Not fixed here; raised with the user.
- [x] 3.3 `AddToListModal` inputs: `id`/`name` (`add-to-list-new-name`, `add-to-list-search`) and `autoComplete="off"`

## 4. For You in-place retry

- [x] 4.1 `RecommendationsPage`: `retryToken` state in the fetch/poll effect deps; `retry()` resets `hasFetched`, `fetchError`, sets `loading`, bumps the token
- [x] 4.2 Replace the `Empty` + `window.location.reload()` link with `<LoadError title="Couldn't load recommendations" onRetry={retry} />`
- [x] 4.3 e2e (`e2e/python`): recommendations endpoints fail → error with Retry → fix the route → Retry shows sections, with no page reload (assert a `window` marker set before Retry survives)

## 5. Types and lint

- [x] 5.1 `TMDBTVDetail.created_by`; drop the cast in `TVShowDetails.tsx`
- [x] 5.2 Type `credits.crew` as `TMDBCrewMember[]`; drop the `any`s in `MovieDetails.tsx`
- [x] 5.3 `TMDBMovieDetailResponse` raw type for the detail fetch; drop the cast in `MovieDetailPage.tsx`
- [x] 5.4 Remove the stale `(t as any)` in `CalendarPage.tsx`
- [x] 5.5 `RegisterPage`: `catch (err: unknown)` + `isAxiosError` narrowing + `getApiError` fallback
- [x] 5.6 `App.tsx`: remove the stale `eslint-disable-next-line @typescript-eslint/no-unused-vars` above `TMDBCallbackPage`
- [x] 5.7 Done when `grep -rn ": any\|as any" src --include=*.ts --include=*.tsx` (excluding tests) is empty

## 6. CRA leftovers

- [x] 6.1 `public/manifest.json`: names "CINE DB", `theme_color`/`background_color` from the dark theme background
- [x] 6.2 `public/index.html`: CINE DB meta description, remove the three template comments; `theme-color` meta matches the manifest
- [x] 6.3 Delete `src/logo.svg`, `src/reportWebVitals.ts`, and the import/call in `src/index.tsx` (leave the `web-vitals` package to `fix-dependency-drift`)

## 7. Verification

- [x] 7.1 `npx tsc --noEmit`, `npx eslint src`, Jest (`CI=true npx react-scripts test --watchAll=false`)
- [x] 7.2 Python e2e suite green (`G:/Anaconda/envs/django/python.exe -m pytest e2e/python`)
- [x] 7.3 Live check under `npm run dev` with a throwaway `verify_*.py`: Stats screenshots in light and dark theme (set `cinedb_theme` JSON-encoded, wait for `.ant-skeleton` gone); confirm light-mode labels/legend/tooltip are readable and dark mode matches the pre-change screenshot; For You retry without reload; NotificationBell/FilterPanel at 375px. View the screenshots, then delete the script and screenshots
  - **Note:** Stats light mode: labels, legend, empty cells (light-gray grid) and both tooltips readable; dark mode matches the baseline apart from the tooltip background moving to `colorBgElevated` (slightly bluer), an accepted tonal shift. For You retry against the real backend: error → Retry → 168 cards, `window` marker survived (no reload). FilterPanel drawer 320px at 1366/800/375 (opened at 800, then resized: the phone layout has no Filters button, a pre-existing gap). Scripts and screenshots deleted.
- [x] 7.4 Docs: CLAUDE.md conventions (`ratingColor`/`avatarColor` in `src/utils/colors.ts`, `STILL_URL`/`LOGO_URL`); note the icon decision for the user
  - **Note:** Icons are still the CRA React logo (`favicon.ico`, `logo192.png`, `logo512.png`); waiting on the user for artwork or approval of a generated wordmark.
