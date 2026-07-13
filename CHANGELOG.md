# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.14.0] - 2026-07-13

### Changed
- `LoginPage.tsx`'s invalid-credentials error moved from a `Tooltip` pinned open over the Sign In button to an antd `message.error` toast via `App.useApp()`, matching `RegisterPage.tsx`'s existing error pattern — the two auth pages had drifted onto different conventions for the same kind of feedback.

### Fixed
- E2E CI job (`e2e-python`) could hang for GitHub Actions' full 6h default job timeout instead of failing cleanly: pytest-timeout's default `signal` method can't interrupt a hung Playwright call blocked in a background thread (its own asyncio subprocess reaper), so a stuck test just sat there forever once the alarm fired. `e2e/python/pytest.ini` now sets `timeout_method = thread` (Playwright's own recommendation), and `.github/workflows/ci.yml` caps the job at `timeout-minutes: 15` as a backstop.
- Widespread E2E test bug: most `page.route()` overrides for `/api/django/(watchlist|watched|ratings|lists)/` across the suite used an exact path with no trailing wildcard, so they never matched — `fetchAllPages()` (`src/utils/fetchAllPages.ts`) always appends `?page=1`, even to the first request. Tests asserting an empty list passed by accident; tests asserting real content silently got the fixture's empty-list fallback instead. Added the missing `**` across `test_detail.py`, `test_lists.py`, `test_watchlist.py`, `test_profile.py`, `test_watched.py`, and `test_ratings.py`.
- Several tests stacked two `page.route()` calls on the same pattern to model different requests (e.g. GET the list vs. POST to create) — Playwright checks routes last-registered-first, so the second call silently shadowed the first for *every* request on that path, including the initial GET, which then got a single object back where the app expected an array. This stalled the page past the test timeout and, combined with the `thread`-mode fix above, was killing the whole run rather than just the one test. Fixed in `test_detail.py` (watchlist/watched toggles) and `test_ratings.py` (rating-save) by branching on `r.request.method` inside one handler instead, matching `test_lists.py`'s existing pattern.
- `test_movie_detail_watched_toggle` (`test_detail.py`) asserted an instant success toast after clicking "Mark as watched," but that action opens `MarkWatchedModal` first — only unmarking is a direct instant toggle. Test now waits for the modal and clicks "Mark Watched" before asserting the toast.
- `test_clear_all_network_error_shows_error_toast` (`test_watched.py`) mocked its 500 response with a `"detail"` field, which `getApiError()` (`src/utils/apiError.ts`) prefers over the component's own fallback message — so the test was asserting text that could never actually appear. Mock body no longer includes `detail`, so the fallback path the test is meant to exercise actually runs.
- `test_remove_cancelled_keeps_item` (`test_watchlist.py`) could hang indefinitely: a leftover `Tooltip` ("Remove", from the icon button underneath) stayed visually overlapping the Popconfirm's Cancel button, and Playwright's synthetic click doesn't fire the hover-exit that would normally dismiss it — so the click retried against an intercepted target forever. `force=True` on that click, since the target itself is unambiguous.
- `test_tv_detail_episode_guide_shows_pilot` (`test_detail.py`) asserted "Pilot" was visible immediately on page load, but the episode guide is collapsed by default (documented behavior, `features.txt`) — antd doesn't render a collapsed panel's children at all, so the episode list never mounted until expanded. Test now expands the panel first.

## [0.13.0] - 2026-07-11

### Added
- Light mode is now a fully custom "warm paper" theme instead of stock antd gray — matches the level of design care dark mode ("cinema-dark") already had. `antdTheme.ts`'s `lightThemeConfig` gained the full token set dark mode already defined (`colorText`, `colorTextSecondary`, `colorBorder`, `colorBorderSecondary`, `colorBgElevated`) plus matching `Table`/`Drawer` component overrides, previously entirely absent so those surfaces fell back to raw antd defaults. `App.css` gained a light-mode equivalent of dark mode's `.app-content` radial-gradient background (warm gold-tinted instead of navy/purple), and the glass-panel/scrollbar colors (`.glass-sidebar`, `.glass-overlay-card`, `.app-bottom-nav`, `::-webkit-scrollbar`) were retinted from stock gray to match. Palette chosen from a 2-option visual mockup shown to the user before implementation.

### Fixed
- Custom scrollbar (`App.css`) was hardcoded dark-navy with no light-mode override, so it stayed dark-themed even on a white page — the one objective bug found while designing the light theme above. Now theme-scoped like every other glass/surface color.
- The "No Image" poster fallback (`NO_IMAGE`, an inline SVG data-URI) always rendered its text in generic `sans-serif`, never Poppins — SVGs embedded via `<img src="data:...">` can't see the page's `@font-face`, so this could never be fixed by just changing the font-family string inside the SVG. Replaced with a real DOM component (`PosterPlaceholder.tsx`) at all 11 call sites across 9 files, which inherits Poppins for free like every other piece of text in the app. `NO_IMAGE` removed from `constants/ui.ts` as dead code once nothing referenced it.

## [0.12.0] - 2026-07-11

### Fixed
- `GET /api/stats/` 500'd on every call — `stats_views.py` filtered `WatchlistEntry.objects.filter(watched=False)`, but that column was removed in `0015_remove_watchlistentry_watched.py` (0.10.0) and `stats_views.py` was never updated to match. Now derives the "unwatched" count from the already-fetched `WatchedEntry` list instead of a dead column.
- `POST /auth/token/refresh/` 500'd (unhandled `User.DoesNotExist`) instead of cleanly 401ing when a stored refresh token's user no longer exists in the DB — reproduces reliably in this dev environment given how many throwaway test accounts churn through it, and looks like "the app is just broken" from the browser (an uncaught 500 error overlay, not a redirect to `/login`) since it defeats the frontend's own refresh-failure handling before that handling ever gets a clean error to act on. Root cause: `rest_framework_simplejwt`'s stock `TokenRefreshSerializer.validate()` does a bare `User.objects.get(...)` with no exception handling. Added `SafeTokenRefreshSerializer`/`SafeTokenRefreshView` (`backend/userdata/auth_views.py`) wrapping that lookup and converting it to `InvalidToken` (401); wired in at `urls.py` in place of the stock view. Audited the rest of the installed `rest_framework_simplejwt` package for the same bare-`.get()` shape — the other three call sites were already exception-guarded, this was the only gap.
- `InfoTooltip.tsx`'s info icon was invisible in dark mode — hardcoded `color: "rgba(0,0,0,0.45)"` (near-black) instead of a theme-aware token. Swapped for antd's `theme.useToken().colorTextSecondary`, per the existing "no hardcoded hex, prefer `theme.useToken()`" convention this component had drifted from. Affects every page using `InfoTooltip` (it's the one shared component for this), not just wherever it was first noticed.
- Sidebar showed its own vertical scrollbar only on `/movies`, `/tv`, and `/anime` — `.app-sidebar` is intentionally `height: 100vh; overflow-y: auto` as a safety valve, but those three routes render one extra element (`Sidebar.tsx`'s filter-toggle button, shown only when `isBrowsePage`) that was just enough to push total sidebar content past a standard 1366×768 viewport. Trimmed logo/search padding, divider margins, and footer gap in `Sidebar.tsx` (~36px reclaimed) — verified via `scrollHeight`/`clientHeight` measurement at 1366×768 (now 0px overflow, was 36px) and 1366×700 (down to 64px overflow from 104px; still relies on the intentional scroll fallback at unusually short viewport heights).
- Fire-and-forget mutation calls across `ListsPage.tsx`, `AddToListModal.tsx`, `WatchlistPage.tsx`, `SearchPage.tsx`, `MovieDetails.tsx`, `TVShowDetails.tsx`, `Movie.tsx`, `TVShowCard.tsx`, and `RecommendationsPage.tsx` — toggling watchlist/watched, creating/deleting a list, and adding/removing a list item all called their async context method without `await`/`try`/`catch`, so a success toast fired unconditionally even if the API call actually failed, leaving local UI state silently out of sync with the server. All now `await` the call inside a `try`/`catch`, only toasting success on success and surfacing `getApiError(...)` on failure — matching the pattern `WatchlistPage.tsx`'s rating-save flow already used correctly.
- `formatDateDMY()` (`src/utils/formatDate.ts`) rendered dates a day early for any timezone behind UTC — `new Date("YYYY-MM-DD")` parses as UTC midnight, then `.getDate()`/`.getMonth()` read it back in local time. `CalendarPage.tsx` had already worked around the same root problem locally (appending `T12:00:00`) but the shared util itself was never patched, so every other caller (`MovieDetails.tsx`, `TVShowDetails.tsx`, `WatchedPage.tsx`, `PersonPage.tsx`, `ListsPage.tsx`, `EpisodeGuide.tsx`) still had the bug. Now parses the `YYYY-MM-DD` segment directly instead of going through `Date` at all.
- `password_reset_confirm` (`backend/userdata/auth_views.py`) had no throttle, falling back to the generous global `anon: 300/day` rate instead of the same `password_reset: 5/hour` scope already applied to `password_reset_request` — inconsistent given it's the credential-verification half of the same flow.

### Removed
- Dead `UserListItem.watched` column, end to end: never settable (no PATCH endpoint for a single list item existed), never rendered anywhere in `ListDetailPage.tsx`, always `False`. Removed from the model (migration `0016_remove_userlistitem_watched.py`), serializer, and the two frontend spots (`useLists.ts`, `UserListItemDTO`) that carried it through unused.
- Four confirmed-dead frontend components with zero imports anywhere in `src`, each fully superseded by a shared component from an earlier refactor: `Pagination.tsx` (pages use antd's `Pagination` directly), `StreamingBadges.tsx` (→ `WatchProviders.tsx`), `Tags.tsx` (→ inline genre `CheckableTag` logic in `FilterPanel.tsx`), `Overlay.tsx` (→ inline trailer sections in the detail pages). Also removed the now-dead `.overlay-content` CSS rules from `App.css`.

### Security
- Added JWT refresh-token blacklisting: `rest_framework_simplejwt.token_blacklist` was in the dependency but not wired in — `ROTATE_REFRESH_TOKENS` was already `True` but with no `BLACKLIST_AFTER_ROTATION`, so a rotated-out refresh token stayed valid for its full remaining 7-day lifetime instead of being invalidated. Added the app to `INSTALLED_APPS`, set `BLACKLIST_AFTER_ROTATION: True`, migrated.

## [0.11.0] - 2026-07-10

### Added
- Desktop sidebar manual collapse: footer toggle button (`Sidebar.tsx`) folds the full 220px sidebar to the same 64px icon-only rail tablet already uses (768-991px). State persists via `useLocalStorage("cinedb_sidebar_collapsed", false)`, same convention as `cinedb_theme`. Collapsed-state CSS rules live in `App.css`'s existing `@media (min-width: 992px)` block, reusing the tablet rail's child selectors rather than duplicating them. Toggle button itself is hidden below 992px since tablet/phone already have their own fixed sidebar/bottom-nav layout.

### Changed
- `WatchlistPage.tsx` no longer destructures the unused `watchedList` from context (leftover from the 0.10.0 watched-state decoupling — `isWatched(id, type)` alone is sufficient).

## [0.10.0] - 2026-07-10

### Changed
- Watchlist page's "watched" status no longer lives on its own `WatchlistEntry.watched` DB column — it's now derived live from the shared Watched list (`isWatched(id, type)` via `WatchedContext`), same source every other page already reads from. Marking watched from `WatchlistPage.tsx` now opens `MarkWatchedModal` (auto-fetches runtime/platform) instead of an instant local toggle, matching the convention used everywhere else (`SearchPage.tsx`, `Movie.tsx`, `TVShowCard.tsx`); unmarking stays instant. Removed `WatchlistEntry.watched` (migration `0015_remove_watchlistentry_watched.py`), `WatchlistEntrySerializer`'s `watched` field, and `markWatched`/`useWatchlist.ts`'s corresponding endpoint call, context method, and type entries — all now dead code since the derived value replaces them everywhere.
- Watchlist page's eye icon now colors green when watched (matching `SearchPage.tsx`/`Movie.tsx`/`TVShowCard.tsx`'s existing convention) instead of only swapping icon shape with no color change.
- Removed the separate cyan "Watched" `Tag` from Watchlist page cards — the green eye icon is now the only (and sufficient) watched indicator, avoiding a redundant second signal.

### Fixed
- Watchlist page cards showed the correct watched state but stayed visually stale relative to marking something watched from a different page (e.g. Search) — the root cause was two independent, unsynced "watched" booleans (`WatchlistEntry.watched` vs the separate `WatchedEntry` table); see "Changed" above for the fix.
- Watchlist cards of different content lengths (long review text, missing rating, etc.) rendered at different heights despite sharing a grid row — `LibraryItemCard.tsx`'s outer `motion.div` wrapper had no height set, so the inner `Card`'s existing `height: 100%` had nothing to resolve against; the antd `Col` itself was already stretched to match its tallest row sibling (default flex behavior), but the visible card box just sat at its own natural content height inside that stretched space. Added `height: "100%"` to the wrapper — fixes it for `WatchlistPage.tsx`, `WatchedPage.tsx`, and `ListsPage.tsx`/`ListDetailPage.tsx` alike, since they all share this component.
- `backend/userdata/auth_views.py`'s avatar-upload error response exceeded ruff's 120-char line limit, failing `ruff check backend/` in CI's backend job on every single run (deterministic, not flaky) — wrapped across multiple lines.

## [0.9.0] - 2026-07-10

### Added
- Recommendations sections on Movie/TV detail pages now run through the same `filterByGenreOverlap` genre-overlap filter already used by "Similar" — keeps only recommendations sharing ≥half the opened title's genres, falling back to the unfiltered TMDB list if that would empty the section. `MovieDetails.tsx`'s `RecommendationItem` type gained `genre_ids`; `TVShowDetails.tsx` normalizes the raw `{results: [...]}` shape TMDB's `append_to_response=recommendations` actually returns for `/tv/{id}` (previously accessed via an inline cast with no filtering).
- Nav "flash tooltip": clicking a Sidebar or BottomNav icon now force-shows its tooltip label for ~1.4s (`useFlashTooltip.ts`), confirming which page you navigated to — most useful on the icon-only tablet sidebar rail and phone bottom nav, where no text label is otherwise visible.

### Changed
- Cast grid on Movie/TV detail pages now centers (`justify-content: center`) instead of left-aligning when the row doesn't fill.
- Backdrop images in the Images section now open a full-size lightbox on click (`Image`'s `preview.src` pointed at `BACKDROP_URL`) instead of only showing the thumbnail-cropped version.

### Fixed
- `GET /api/watched/` (and any other paginated list endpoint once a user has more than `page_size` rows) 500'd with `django.core.exceptions.DisallowedHost` — DRF's default `PageNumberPagination.get_paginated_response()` builds an absolute `next`/`previous` URL via `request.build_absolute_uri()`, which validates the request's Host header against `ALLOWED_HOSTS` (only bare `localhost`/`127.0.0.1` are implicitly allowed under `DEBUG=True`; a LAN IP or any other host 500s). Only fired for endpoints where a user has enough rows to need a `next` page — small lists (watchlist, followed-people) never hit it. `DefaultPagination` (`backend/userdata/pagination.py`) now overrides `get_next_link`/`get_previous_link` to return plain page numbers instead of absolute URLs; the frontend's `fetchAllPages.ts` only ever checked `next` for truthiness, so this is a drop-in fix with no frontend changes.
- Sidebar drifted upward while scrolling instead of staying pinned — `src/index.css` set `overflow-x: hidden` on `html, body, #root` with no explicit `overflow-y`, and per the CSS overflow spec that silently promotes `overflow-y` to `auto` too, turning `#root` into an unintended scroll container sitting between `.app-sidebar` and the real viewport scroller. `position: sticky` sticks to the *nearest* scrolling ancestor, so it locked onto `#root` (whose `scrollTop` never actually moves) instead of `<html>`, and the sidebar just rode along with normal page scroll. Fixed by scoping `overflow-x: hidden` to `html` only.
- Recent-searches dropdown visibly jumped up/down mid-scroll — antd's `Dropdown` mounts its popup in `document.body` by default and repositions it via scroll-linked recalculation built for a trigger that scrolls with the page; once the sidebar (and the search input inside it) became genuinely sticky (previous fix), that recalculation briefly miscomputed on each scroll tick before self-correcting. `SearchBox.tsx`'s `Dropdown` now sets `getPopupContainer` to mount the popup inside the sidebar's own search wrapper (`Sidebar.tsx`, given `position: relative`) instead of `document.body`, so it never needs scroll-based repositioning at all.

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
