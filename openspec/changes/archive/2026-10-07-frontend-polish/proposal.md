## Why

Several frontend pieces still look like unfinished scaffolding or drift from the app's own conventions:
- In light mode, the Stats page draws its labels and heatmap in near-white text, so they are barely readable.
- Installing the app as a PWA shows "React App" with the React logo.
- The For You page's "Try again" reloads the whole browser tab.
- The same rating color helper is copied into 5 files, and ~30 places hardcode the shared green/gold hex values.

This is the frontend-polish slice of `docs/BUG_BACKLOG.md` item 7. The rest of item 7 is proposed separately: CI coverage, dependency drift, accessibility/routing, and Docker hardening.

## What Changes

### User-visible
- **Stats in light mode:** stat-card labels and suffixes, heatmap month/legend labels, empty heatmap cells, chart and heatmap tooltips, and poster captions use theme tokens. They read correctly in both light and dark mode. Dark mode looks the same as today.
- **App identity:**
  - `manifest.json` names the app "CINE DB".
  - `index.html`'s meta description describes the app.
  - The CRA template comments are removed.
  - The React-logo icons are **flagged for replacement** (see Open Questions in design.md). This change doesn't invent branding.
- **For You retry:** a failed recommendations load shows the shared `LoadError` with a Retry that refetches in place, without reloading the browser tab.

### Internal (no behavior change)
- **Shared helpers:**
  - one `ratingColor(vote)` helper replaces the 5 copies of `getRatingColor`
  - one `avatarColor(username)` helper replaces the 2 copies in `Sidebar`/`BottomNav`
  - the remaining hardcoded `#52c41a`/`#f5c518` literals use `WATCHED_GREEN`/`RATING_GOLD`
- **TMDB image URLs:** `EpisodeGuide`'s still URL and `WatchProviders`' logo URL move to `src/constants/ui.ts`.
- **Widths:** `FilterPanel`'s drawer and `NotificationBell`'s dropdown follow the `width: "100%", maxWidth: N` convention.
- **Inputs:** `AddToListModal`'s two inputs get `id`, `name` and `autoComplete="off"`.
- **CRA leftovers:** delete the unused `src/logo.svg` and the no-op `reportWebVitals` wiring.
- **Types:** the 7 explicit `any`s are replaced by real types (missing fields added to `src/types/tmdb.ts`; `RegisterPage` catches `unknown` and uses `getApiError`). The stale `eslint-disable` above `TMDBCallbackPage` in `App.tsx` is removed.

## Capabilities

### New Capabilities
- `theme-readability`: pages render readable text and UI chrome in both light and dark themes, starting with Stats.
- `app-identity`: the installed-app name, description and page metadata identify the app as CINE DB rather than the CRA template.

### Modified Capabilities
- `load-states`: adds a requirement that a failed recommendations load offers a Retry that refetches in place, without a full page reload.

## Impact

- **Frontend only:**
  - `src/pages/StatsPage.tsx`, `RecommendationsPage.tsx`, `CalendarPage.tsx`, `SearchPage.tsx`, `WatchedPage.tsx`, `WatchlistPage.tsx`, `MovieDetailPage.tsx`, `RegisterPage.tsx`
  - `src/components/Movie.tsx`, `TVShowCard.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `ui/StarRating.tsx`, `EpisodeGuide.tsx`, `WatchProviders.tsx`, `NotificationBell.tsx`, `AddToListModal.tsx`, `MovieDetails.tsx`, `TVShowDetails.tsx`, `layout/FilterPanel.tsx`
  - `src/App.tsx`, `src/index.tsx`
  - `src/constants/ui.ts`, a new `src/utils/colors.ts`, `src/types/tmdb.ts`
  - `public/manifest.json`, `public/index.html`
- **Deleted:** `src/logo.svg` and `src/reportWebVitals.ts`, plus the `web-vitals` dependency if nothing else uses it.
- No backend or API change.
- **Tests:** Jest for the new color helpers; a Python e2e for the For You retry; a light-mode screenshot check of Stats.
