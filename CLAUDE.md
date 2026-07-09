# CLAUDE.md

Guidance for Claude Code when working in this repo. See `README.md` for full feature/architecture docs — this file covers conventions not obvious from reading the code once.

## Stack
- Frontend: React 18 + TypeScript (strict) + Ant Design 5, CRA (`react-scripts`), React Router v6, Framer Motion, Recharts.
- Backend: Django 4 + DRF + PostgreSQL, JWT auth (`djangorestframework-simplejwt`).
- `npm run dev` starts all three: Express proxy (3001), React dev server (3000), Django (8000). Django runs via the Anaconda env: `G:/Anaconda/envs/django/python.exe` (see `package.json` scripts) — use that interpreter for any manual `manage.py` command, not system Python.

## Conventions to reuse, don't reinvent
- **Font size**: never hardcode `fontSize: N`. Import `FONT_SIZE` from `src/constants/typography.ts` (`caption` 12 / `body` 14 / `emphasis` 16 / `display` 28). Icon-scaling `fontSize` props (antd icons) are the one exception — those stay numeric.
- **Info tooltips**: use `<InfoTooltip title="..." />` from `src/components/InfoTooltip.tsx` (wraps antd `Tooltip` + `InfoCircleOutlined`) next to any label/stat that needs a one-line explanation. Don't hand-roll a new `Tooltip`+icon pairing.
- **Dates**: render with `formatDateDMY()` from `src/utils/formatDate.ts` — fixed `dd-mm-yyyy`, not locale-dependent `toLocaleDateString()`.
- **Fonts**: Poppins is set once via `commonTokens.fontFamily` in `src/theme/antdTheme.ts`. Never add a per-component `fontFamily` override.
- **Detail-page sections**: `MovieDetails.tsx` and `TVShowDetails.tsx` share `SectionHeader` (section divider+title), `WatchProviders` (streaming/rent logos), `MediaCardGrid` (poster-card grid for recommendations/similar/credits, default `limit=20`, optional `title`/per-item `subtitle`), and `ReviewsSection` (2-column review cards) from `src/components/`. Both pages render sections in the same order (Where to Watch → Cast → Recommendations → Similar → Trailers → Images → Reviews). Don't re-inline a copy in one of the two detail components — fix/extend the shared one. `PersonPage.tsx` also reuses `MediaCardGrid` (uncapped, `limit={array.length}`) for its Movies/TV credit tabs instead of a local card component.
- **Library item cards**: `WatchlistPage.tsx`, `WatchedPage.tsx`, and `ListsPage.tsx` share `LibraryItemCard.tsx` (poster + `Card.Meta` + icon action buttons) for their item grids. `PeoplePage.tsx` and `SearchPage.tsx`'s People tab share `PersonCard.tsx`. Don't hand-roll another `Card`/`Row`/`Col` poster grid — extend one of these.
- **Shared UI constants**: `IMG_URL`, `BACKDROP_URL`, `NO_IMAGE`, `RATING_GOLD`, `WATCHED_GREEN` live in `src/constants/ui.ts`; provider deep-links (`PROVIDER_SEARCH_URLS`) live in `src/constants/providers.ts`. Don't hardcode hex colors or TMDB image URLs inline.
- **List-page filter bars**: `WatchlistPage.tsx`, `WatchedPage.tsx`, `RecommendationsPage.tsx`, `ListsPage.tsx`, `ListDetailPage.tsx`, and `FollowingPage.tsx` all follow the same filter pattern — `search`/`sortKey`/`typeFilter` state seeded from and written back to `sessionStorage` (`SS_*` constants local to each file, distinct keys per page), an `Input.Search` + `Select`(s) bar, and a conditionally-rendered "Clear filters" `Button` that only appears once a filter diverges from its default. Follow this shape for any new list/browse page filter instead of inventing another persistence or reset scheme.
- **Adult content toggle**: single switch lives in `FilterPanel.tsx`, bound to the shared `includeAdult`/`setIncludeAdult` from `useAppContext()`/`UIContext`. Don't add another copy elsewhere (e.g. back into `SearchBox.tsx`) — every search/discover call already reads this one context value.
- **Add to List**: use `<AddToListModal open onClose mediaId mediaType title posterPath voteAverage />` (`src/components/AddToListModal.tsx`) — don't re-inline another bare-checkbox list picker. It already handles search, inline create-new-list, and the add/remove toggle itself.
- **Mark as Watched**: use `<MarkWatchedModal open mediaId mediaType onCancel onConfirm />` (`src/components/MarkWatchedModal.tsx`) whenever a UI lets the user mark something watched — it self-fetches runtime + streaming-platform options from TMDB given just the id/type, so callers never pass detail data in. Only wire it for the "mark as watched" direction; unmarking stays an instant `toggleWatched(...)` call, no modal. If you add a new watched-toggle icon anywhere, route it through this modal — several existing ones (`Movie.tsx`, `TVShowCard.tsx`, `RecommendationsPage.tsx`, `SearchPage.tsx`) were missed on a first pass and silently never recorded runtime/platform until fixed.

## Verification
- Typecheck: `npx tsc --noEmit` (fast, always run after TSX/TS edits).
- To actually see a change: `npm run dev`, then drive it with Playwright (`playwright-core` is already a devDependency) — most pages require an authenticated user. Fastest path: register a throwaway account via `/register` (no email verification), then navigate. Movie ID `550` (Fight Club) is a reliable TMDB id for detail-page checks.
- Write any verification scripts into the project root as `verify_*.js` and delete them before finishing — don't leave scratch scripts in the tree (`.gitignore` also excludes this pattern as a backstop).

## Don't
- Don't bypass `docker-entrypoint.sh` / `backend/start.py` migration flow — `makemigrations` is intentionally not run automatically at boot; generate migrations explicitly.
- Don't add a new localStorage-backed data store — all user data (watchlist/watched/ratings/lists/etc.) lives in PostgreSQL via the Django API.
