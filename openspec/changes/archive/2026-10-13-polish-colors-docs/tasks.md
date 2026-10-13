## 1. Shared color pieces

- [x] 1.1 `constants/ui.ts`: add `IN_WATCHLIST_BLUE` (`#1677ff`), `ON_GOLD_TEXT` (`#000`), `AVATAR_INITIALS_TEXT` (`#fff`), each with a one-line comment on why it is fixed
- [x] 1.2 `src/hooks/useActionIconColor.ts`: returns `RATING_GOLD` in dark mode and `token.colorText` in light mode; a Jest test for both themes

## 2. Replace inline colors

- [x] 2.1 Idle/active action icons through the hook and `IN_WATCHLIST_BLUE`: `Movie.tsx`, `TVShowCard.tsx`, `MovieDetails.tsx`, `TVShowDetails.tsx`, `SearchPage.tsx` (2), `WatchlistPage.tsx`, `RecommendationsPage.tsx` (2); drop each file's now-unused `theme` read if nothing else uses it
- [x] 2.2 Empty-state icons → `colorTextTertiary` (planned `colorTextQuaternary`; the 5.2 check measured it too faint): `Movies.tsx` (3), `TVShows.tsx` (3), `CalendarPage.tsx`, `RecommendationsPage.tsx` (2), `SearchPage.tsx`; Watchlist review caption → `colorTextTertiary`
- [x] 2.3 `FilterPanel.tsx` genre chip border → `colorBorder`; `PosterPlaceholder.tsx` → `colorFillSecondary` / `colorTextTertiary`
- [x] 2.4 Fixed-fill text: `BottomNav.tsx` badge and `StatsPage.tsx` FILM/TV badge → `ON_GOLD_TEXT`; avatar initials in `BottomNav.tsx` and `Sidebar.tsx` → `AVATAR_INITIALS_TEXT`; `BottomNav.tsx` initials `fontSize: 10` → `FONT_SIZE.caption`
- [x] 2.5 Sweep: no `"#…"` or `rgba(` literal left in `src/` outside `constants/`, `theme/`, `utils/colors.ts`, tests, and `StatsPage.tsx`'s palette/heat scale

## 3. Small fixes

- [x] 3.1 `public/index.html`: `<title>CINE DB</title>`; a TS e2e assertion (`toHaveTitle("CINE DB")`) in an existing spec that loads the app
- [x] 3.2 `backend/start.py`: `DB_PASSWORD` falling back to `POSTGRES_PASSWORD`, with a comment pointing at `settings.py`
- [x] 3.3 `settings.py`: fix the two `â€”` comments (lines 21, 174) and rewrite the CORS comment that says dev is cross-origin (dev is same-origin since `speed-up-pages`; `x-timezone` stays for a cross-origin `REACT_APP_*` base URL)

## 4. Docs

- [x] 4.1 `backend/.env.example` and README's `backend/.env` block: commented `CORS_ALLOWED_ORIGINS` (used only when `DEBUG` is off; empty = no cross-origin browser access, which the same-origin nginx setup doesn't need)
- [x] 4.2 `docs/ARCHITECTURE.md` scroll-restoration bullet: RecommendationsPage persists search/type filters (no sort); ListsPage persists its `useLibraryFilters` filters under `keyPrefix: "lists"`, not a selected list id
- [x] 4.3 `CLAUDE.md`: `playwright-core` comes with `@playwright/test` (not a direct devDependency); "Shared UI constants" lists the three new constants and `useActionIconColor()`, and notes Stats' chart palette/heat scale as the deliberate fixed-color exception
- [x] 4.4 `docs/BUG_BACKLOG.md`: item 21b status; note the dropped `browseFilters.ts` finding and the Stats palette exception

## 5. Verify

- [x] 5.1 `npm run typecheck`, `npm run lint`, Jest, `npx playwright test`, backend `pytest`, `ruff check backend/`
- [x] 5.2 Live check with `npm run dev` + Playwright in both themes at 1366 px: a Movies grid (idle and active icons), a detail page, an empty Search, Calendar and For You empty states, a no-poster card, Watchlist with a review caption, the phone bottom nav with initials and the gold count badge; compare light-mode empty-state icon contrast against the Empty description (switch to `colorTextTertiary` if too faint); delete the throwaway account and any `verify_*` scripts
