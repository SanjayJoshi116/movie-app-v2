# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.4.0] - 2026-07-08

### Added
- TV Detail Reviews section (previously movie-only) via a new `fetchTVReviews` endpoint call and shared `ReviewsSection` component (2-column card layout), reused by both `MovieDetails.tsx` and `TVShowDetails.tsx`.
- Watchlist page: media-type (Movie/TV) and watched-status (Watched/Unwatched) filters, persisted in `sessionStorage` alongside search/sort. Wired up the previously-dead `markWatched` API (existed in `useWatchlist.ts` but was never called from any UI) with an in-card toggle so the watched-status filter has real data to act on.
- `LibraryItemCard.tsx` — shared poster/`Card.Meta`/icon-action card, replacing three near-duplicate implementations across `WatchlistPage.tsx`, `WatchedPage.tsx`, and `ListsPage.tsx`.
- `PersonCard.tsx` — shared browse card for the People listing and search results, adding a Follow/Unfollow button directly on the card (previously only available from the person's own detail page).

### Changed
- Recommendations/Similar card limit raised from 10 to 20 (`MediaCardGrid.tsx` default), applied across Movie/TV detail pages and Person credit tabs.
- Person page: container/spacing aligned with the Movie/TV detail convention (`.detail-container`), birthday/deathday now render via `formatDateDMY`, info panel gained Known For, Deathday, IMDb, and Website fields, and the Movies/TV credit tabs now reuse `MediaCardGrid` (uncapped) instead of a duplicate `CreditCard` component. The redundant "All Credits" tab was dropped. The Photos tab now uses `Image.PreviewGroup` for a lightbox, matching Movie/TV's Images section.
- Cast section on Movie/TV detail pages now wraps to a grid instead of horizontal-scrolling (`.cast-scroll-container` in `App.css`).
- TV detail section order standardized to match Movie detail (Recommendations before Similar, Reviews added at the end). Episode Guide is open by default, but the episode list for the selected season now sits behind its own collapse toggle so a large first season doesn't dump 20+ rows onto the page immediately.
- Removed the "My Stats" summary card from the top of the Watchlist page.

### Removed
- `src/components/watchlist/WatchlistStats.tsx` (superseded by the above removal; was only used on the Watchlist page).

## [0.3.0] - 2026-07-07

### Fixed
- TV Detail page brought to parity with Movie Detail: added a Trailers section (`videos` now requested via `append_to_response` on `fetchTVDetails`), added the TMDB Rating info tooltip, and switched First/Last Air Date, Next Episode, and Episode Guide air dates from raw ISO strings to `formatDateDMY`.
- TV Detail backdrop gallery now sources images from `IMG_URL` (w500) instead of a page-local original-quality URL, matching Movie Detail's convention.

### Changed
- Extracted `WatchProviders`, `SectionHeader`, and `MediaCardGrid` (new `src/components/`) — previously near-identical code duplicated in both `MovieDetails.tsx` and `TVShowDetails.tsx`. The streaming-provider deep-link map moved to `src/constants/providers.ts`.
- Centralized shared UI constants (`BACKDROP_URL`, `NO_IMAGE`, `RATING_GOLD`, `WATCHED_GREEN`) in `src/constants/ui.ts`, replacing hardcoded hex colors and placeholder image URLs scattered across `MovieDetails.tsx`, `TVShowDetails.tsx`, and `EpisodeGuide.tsx`.
- Poster and content-width layout moved to CSS classes (`.detail-poster-img`, `.detail-container` in `src/App.css`), replacing duplicated inline style objects across `MovieDetailPage`, `TVDetailPage`, `MovieDetails`, and `TVShowDetails`.

## [0.2.0] - 2026-07-07

### Added
- Info tooltips (`InfoCircleOutlined` + antd `Tooltip`, via new `src/components/InfoTooltip.tsx`) next to non-obvious labels/stats across Stats, Calendar, Lists, Watched, Recommendations, and Movie/TV Detail pages.
- Unified typography scale: `src/constants/typography.ts` (`FONT_SIZE.caption/body/emphasis/display`) replacing ~110 ad-hoc inline `fontSize` values across 28 files. Heading tokens pinned in `src/theme/antdTheme.ts`.
- `src/utils/formatDate.ts` (`formatDateDMY`) — dates now render as `dd-mm-yyyy` everywhere (Watched, Lists, Movie/TV Detail release date), independent of viewer locale.

### Fixed
- Release Calendar "Upcoming releases" label said "next 7 days" but actually fetched a 60-day window — label corrected to match behavior.
- Stats page activity-heatmap hover tooltip rendered far from the cursor — caused by `position: fixed` losing the viewport as its containing block under the page's `motion.div` transform. Tooltip now portals to `document.body` and tracks the live pointer position.

## [0.1.0] - 2026-03-26

Initial tracked baseline: React + TypeScript frontend, Django + PostgreSQL backend, JWT auth, TMDB-powered discovery, watchlist/watched/ratings/lists, recommendations, stats dashboard, release calendar.
