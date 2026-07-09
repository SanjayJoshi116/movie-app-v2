# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.6.0] - 2026-07-09

### Added
- Per-list detail page (`/lists/:id`, new `ListDetailPage.tsx`) replacing the old expand-below-grid pattern on `ListsPage.tsx` — list-level actions (rename, Export CSV, Clear All, scoped CSV import, Delete) consolidated in one header, plus its own search/sort/type filter bar for the item grid. `ListsPage.tsx` itself gained a search+sort bar and a poster "theme image" per card (first item's poster, `NO_IMAGE` fallback when empty).
- List rename: new `PATCH /api/lists/<id>/` endpoint (`lists_views.py`), `updateList()` in `useLists.ts`/`ListsContextType` — previously only create/delete existed.
- `AddToListModal.tsx` — shared "Add to List" modal (search, inline create-new-list, `List`+`Tag` row styling) used by both `MovieDetails.tsx` and `TVShowDetails.tsx`, replacing two duplicated bare-checkbox modals; the button no longer disappears when the user has zero lists (previously a dead end).
- `MarkWatchedModal.tsx` — shared confirm-step modal shown when marking a title watched (movie/TV detail pages and every browse/search/recommendation card's watched-toggle icon, replacing an instant one-click toggle). Auto-fetches runtime and that title's streaming platforms via TMDB (`fetchMovieDetails`/`fetchTVDetails` + `fetchMovieProviders`/`fetchTVWatchProviders`) using just `mediaId`/`mediaType` — runtime is read-only (auto-only, not user-entered), platform is a dropdown of real providers plus a free-text "Other". Un-marking stays an instant toggle, no modal.
- `WatchedEntry` gained `runtime_minutes` and `platform` fields (migration `0013_watchedentry_platform_watchedentry_runtime_minutes.py`), captured via the modal above.
- Stats page: "Hours Watched", "Reviews Written", "My Lists", and "Watchlist Backlog" KPI tiles; "Rating by Genre" chart (avg rating per genre, min. 3 rated titles); "Platform Breakdown" chart (from the new `platform` field).
- Release Calendar: title search, sticky per-date headers, "Jump to Today" button.
- Following page: search + sort (name A–Z/Z–A) bar; new "Recommended From People You Follow" section wired to the previously-unused `fetchFollowedPeopleRecommendations()` endpoint.

### Changed
- Release Calendar reverted to a 7-day lookahead (previously 60 days) — the 60-day window silently truncated to the first ~week of dense release volume anyway, since `fetchAllPages` caps at 3 pages (~60 items) per media type sorted date-ascending.
- Release Calendar poster grid: fixed 6-per-row above mobile widths (2 on `xs`, 3 on `sm`), consistent spacing between date header and card grid.
- `PersonCard.tsx`'s `person` prop relaxed from full `TMDBPersonSummary` to the minimal shape it actually reads (`id`/`name`/`profile_path`/optional `known_for_department`), enabling reuse from `FollowingPage.tsx` without synthesizing fake TMDB fields.
- `RecommendationsPage.tsx`'s `SectionRow` exported for reuse by `FollowingPage.tsx`.
- `FollowingPage.tsx` and `ListsPage.tsx` no longer redefine local color/image constants — both now import `RATING_GOLD`/`IMG_URL`/`NO_IMAGE` from `constants/ui.ts`.

### Fixed
- Duplicate items appearing (and firing a React key-collision warning) on the Release Calendar — TMDB's paginated discover results could list the same title on two adjacent pages under concurrent fetch; entries are now deduped by `type-id` before grouping.
- `WatchedEntrySerializer`'s `platform` field passed a redundant `source="platform"`, which Django REST Framework rejects with a 500 (`AssertionError`) on every "mark watched" request — removed.
- 4 grid/card-level "mark as watched" toggles (`Movie.tsx`, `TVShowCard.tsx`, `RecommendationsPage.tsx`'s `RecCard`, `SearchPage.tsx`'s Movie/TV tabs) were still instant-toggling directly against the watched API, bypassing `MarkWatchedModal` entirely — runtime/platform were silently never captured from these 4 spots even though the detail-page flow worked, so "Hours Watched" undercounted anything marked watched from a browse grid. All now route through the modal.
- `AddToListModal`'s per-row checkbox had a redundant `stopPropagation` that would have silently prevented the actual add/remove toggle from ever firing on checkbox clicks (caught in review before shipping, not a live regression).

## [0.5.0] - 2026-07-08

### Added
- People page: search input (`Input.Search`), wired to the shared `searchTerm` context — previously the only way to search people was via the global search bar's `/search?tab=people` redirect.
- Watched page: media-type (Movie/TV) filter, matching the one Watchlist already had; search/sort/type now persist in `sessionStorage` (previously reset on every navigation away and back) and a "Clear filters" reset button appears once any filter diverges from default.
- Watchlist page: "Clear filters" reset button (search/sort/type/watched-status), same conditional-render pattern now shared with Watched.
- For You page: search + media-type filter bar (same `sessionStorage`-persisted pattern as Watchlist/Watched), applied per-section so empty sections after filtering are hidden rather than showing a bare divider; each recommendation card gained inline "mark watched" (eye) and "add to watchlist" (book) toggle icons, mirroring `Movie.tsx`'s card actions — previously the only way to act on a recommendation was opening its detail page.

### Changed
- Consolidated the two independent, unsynced "Include Adult Content" toggles (one in `SearchBox.tsx` driving global search calls, one duplicated inside `FilterPanel.tsx`'s local filter state driving discover calls) into a single switch inside `FilterPanel.tsx` bound to the shared `includeAdult` context value. `SearchBox.tsx` no longer renders its own toggle.
- Watched page's per-card action icon changed from a trash/delete icon to an eye icon ("Mark unwatched") — the underlying action (`removeFromWatched`) was already an unmark-watched operation since the watched list carries no separate watched flag, but the trash icon read as a destructive delete.

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
