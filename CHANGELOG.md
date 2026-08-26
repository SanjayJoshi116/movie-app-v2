# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.15.7] - 2026-08-26

### Fixed
- Four remaining call sites (`Movie.tsx`, `TVShowCard.tsx`, `RecommendationsPage.tsx`'s `RecCard`, `SearchPage.tsx`'s Movies/TV tabs) were still falling back to a `placehold.co` SVG `<img>` for missing posters instead of the documented `PosterPlaceholder` component — swapped all four to match convention. `HomePage.tsx`'s recently-watched strip also switches its no-poster fallback to `PosterPlaceholder`, and its poster URL now uses a new `POSTER_THUMB_URL` (`w185`) constant instead of an inline hardcoded TMDB URL.
- Failed login no longer clears the username field — only the password is cleared and refocused, so a typo doesn't force retyping both. Error messaging now distinguishes bad credentials (400/401 → "Invalid username or password.") from an unreachable backend (anything else → "Can't reach the server. Check your connection and try again."), previously both cases showed the same message.

### Changed
- `HeroBanner.tsx` now imports `BACKDROP_URL` from `src/constants/ui.ts` instead of redeclaring it locally; `FilterPanel.tsx`'s genre-tag selected border now uses the shared `RATING_GOLD` constant instead of a hardcoded `#f5c518`.
- `LoginPage.tsx`: username/password inputs disable while a login request is in flight, username autofocuses on mount, and the submitted username is trimmed before the request.
- `Movies.tsx`'s results `<main>` gained `aria-label="Movie results"`.

### Added
- 2 new Playwright cases in `e2e/auth.spec.ts` covering the above: username-retained-after-failed-login, and the unreachable-server message path. TS Playwright suite is now 27 tests (was 25).

## [0.15.6] - 2026-08-03

### Fixed
- Entire e2e test suite (TS `@playwright/test` + Python pytest-playwright, ~180 tests) was broken by 0.15.4's Express removal and 0.15.5's notification bell, discovered while scoping new tests for this release: (1) test mocks still targeted `**/api/django/...`, a URL shape that stopped existing once the `/django` path segment was dropped; (2) `NotificationBell`/`useNotifications` now polls a new endpoint on every authenticated page (rendered globally in `Sidebar`/`BottomNav`), which no test mocked, so it fell through to a real 401 and the refresh-interceptor redirected to `/login`, failing almost every authenticated test; (3) separately, 3 TS spec files (`auth.spec.ts`, `movies.spec.ts`, `watchlist.spec.ts`) had a latent, pre-existing bug of their own — exact-match route patterns (`**/api/watchlist/"` etc.) with no trailing `**`, so `fetchAllPages()`'s always-appended `?page=1` never matched. Fixed all three; `mock_base_django_routes` (Python) and each TS file's `beforeEach` now mock `/api/notifications/new-releases/` too.
- `backend/start.py`'s best-effort `compute_recommendations` step (pre-startup cache warm) had no timeout, so a slow/hung TMDB call could block `runserver` from ever starting — `npm run dev`/`npm start` would silently never finish booting Django. Now capped at 30s with a clean skip-and-continue on timeout.
- `tmdb_proxy` (`backend/userdata/tmdb_proxy_views.py`) echoed raw exception text to the caller in its error response — since the view is `AllowAny`, any internet caller could see internal error detail. Now logs the real exception server-side and returns a generic message.

### Security
- Added per-endpoint rate limiting: `TmdbProxyThrottle` (120/min) on the open `AllowAny` TMDB passthrough, `NotificationsThrottle` (30/min) on the followed-people new-releases endpoint, and `UserRateThrottle` (5000/day default) added system-wide — previously only `AnonRateThrottle` existed, so authenticated users were completely unthrottled.
- Narrowed all 22 bare `except Exception:` blocks across the Django backend to specific exception types (`requests.RequestException`, `KeyError`/`TypeError`/`ValueError`, `django.db.Error`, `TMDBProfile.DoesNotExist`), except 4 sites where a genuinely heterogeneous operation mix (TMDB I/O + numpy/sklearn + DB writes in a background/batch context) makes a broad catch the deliberately-correct choice — each of those 4 now has a comment explaining why.

### Added
- `GET /api/health/` — plain `{"status": "ok"}`, no DB/TMDB calls. `docker-compose.yml`'s backend healthcheck switched from a raw TCP socket probe to hitting this endpoint over HTTP.
- `CONTRIBUTING.md` — dev setup pointer, commit-message convention, testing checklist.
- One representative test added per area with no prior coverage: 4 Django pytest cases (`test_notifications.py`), 7 Jest cases (`useLibraryFilters.test.ts`), 1 Playwright case (next-episode season-rollover, `test_detail.py`).

### Changed
- `NotificationBell.tsx`'s dropdown rows are now keyboard-accessible (`role="button"`, `tabIndex`, Enter/Space) — previously an unlabeled `<div onClick>`.
- `useNotifications.ts` surfaces a visible "couldn't check for updates" state after a failed poll instead of failing silently forever, and defensively falls back on a malformed/unexpected response shape instead of crashing `NotificationBell`'s render.
- README: Feature Overview matrix gained a Social row (previously didn't mention notifications at all); Deployment's DEBUG/SECRET_KEY guidance promoted from a sentence to a `> **Warning:**` callout; API Overview table gained the TMDB-proxy and notifications endpoints (33 → 36 documented endpoints).

## [0.15.5] - 2026-08-03

### Added
- In-app notifications for new releases from followed people: new `NotificationCheckpoint` model + `GET /api/notifications/new-releases/` (last-30-days releases from followed people's TMDB credits, unread count computed against the checkpoint's `last_seen_at`) and `POST /api/notifications/mark-seen/`. `NotificationBell.tsx` (bell icon + unread badge + dropdown) wired inline into `Sidebar.tsx`'s existing footer row (no added vertical space — respects the sidebar's documented space budget) and into `BottomNav.tsx`; `useNotifications.ts` polls every 3 minutes while authenticated. Extracted the threaded TMDB `combined_credits` fetch out of `followed_people_recommendations` into a shared `_fetch_followed_people_credits()` helper so the new endpoint reuses it instead of duplicating the thread-pool code.
- Auto-next-episode workflow: `TVShowDetails.tsx`'s episode-progress bookmark gained a "Next Episode →" button that auto-increments season/episode (handling season rollover, hiding at the series finale) instead of requiring the manual +/- stepper edit for the common case. No backend change — reuses the existing `episode-progress/<show_id>/` bookmark endpoint.
- Pagination on `/api/lists/` — matches every other paginated endpoint now (`DefaultPagination` backend, `fetchAllPages` frontend).

### Changed
- De-duplicated `WatchlistPage.tsx`/`WatchedPage.tsx`'s near-identical search/sort/type-filter state, sessionStorage persistence, and poster-grid markup into a shared `useLibraryFilters.ts` hook and `MediaGrid.tsx` component. Each page keeps its own page-specific bits (Watchlist's watched-status filter, Watched's URL-based pagination) layered on top.
- `SearchPage.tsx`'s `usePaginatedSearch` no longer reimplements the page/loadMore/hasMore state machine — it's now a thin adapter over the shared `usePaginatedFetch.ts` (same hook Home/Anime/People already used), which gained an opt-in `restoredState` param so a caller holding its own cache (Search's sessionStorage query cache) can seed items/hasMore directly instead of the hook's default refetch-by-page-count restore path.

### Fixed
- The `usePaginatedSearch` → `usePaginatedFetch` merge above initially introduced an infinite refetch loop: `fetchPage`'s `useCallback` depended on the `fetcher` argument, which is a fresh inline closure on every render of `MoviesTab`/`TVTab`/`PeopleTab` — any render retriggered a "new" `fetchPage` identity, refetching page 1 forever. Fixed by reading `fetcher` through a ref instead of a dependency (`fetchPage`'s deps are back to just `[query, adult]`, matching the pre-merge effect's own dependency list).
- Found via the same verification pass: `usePaginatedFetch.ts` itself had a latent React 18 StrictMode (dev-only) bug affecting all four consumers (Home/Anime/People's refetch-by-page-count restore, and now Search's cache restore) — StrictMode's intentional dev-mode effect double-invoke replays the mount effect with the *same* `fetchPage` reference, but `isRestoringRef.current` had already been flipped to `false` by the first pass's `finally` block, so the replay silently fell through to a fresh page-1 fetch and clobbered a correctly-restored multi-page/scroll state. Guarded by tracking the last-consumed `fetchPage` reference and skipping the replay entirely when it's identical (a real dependency-triggered rerun only ever happens when `fetchPage` actually changes — an identical reference can only mean StrictMode's replay). Dev-only; never affected production builds, but was reproducible under the app's own documented `npm run dev` + Playwright verification method.

## [0.15.4] - 2026-08-03

### Changed
- Removed the Express proxy (`server.js`, `Dockerfile.proxy`) entirely — its two real jobs (hiding the TMDB API key, forwarding `/api/django/*`) now live directly in Django. New `backend/userdata/tmdb_proxy_views.py` (`tmdb_proxy`, mounted at `api/tmdb/<path:tmdb_path>`) is a public (`AllowAny`) passthrough reusing `tmdb_client.py`'s `TMDB_BASE`; `src/api/tmdb.ts` and `src/api/userApi.ts` now point at Django (`:8000`) directly instead of the old `:3001` proxy, and `userApi.ts` drops the `/django` path segment Express used to strip. `nginx.conf` now proxies `/api/` straight to `backend:8000`; `docker-compose.yml` drops the `proxy` service (`frontend` now depends on `backend`); `Dockerfile.frontend`'s `REACT_APP_API_BASE_URL` build arg updated to match. `package.json` drops `express`/`cors`/`csv-writer`/`dotenv`/`body-parser` (all unused once `server.js` is gone) and the `dev`/`start` scripts' `concurrently` calls go from 3 processes to 2.
- The dead `/api/mark-watched` CSV-writer endpoint (`server.js`, superseded by the Postgres-backed watched feature since 0.10.0, zero callers anywhere in `src/`) is gone along with the file — no replacement needed.
- `SkeletonCard.tsx` cards now fade/slide in staggered instead of appearing all at once, and its poster placeholder uses a real `2/3` aspect ratio instead of a fixed 220px block. Extracted the byte-identical loading-skeleton block duplicated across `MovieDetailPage.tsx`/`TVDetailPage.tsx` into a shared `DetailPageSkeleton.tsx` (also fades in); `HeroBanner.tsx`'s and `EpisodeGuide.tsx`'s loading skeletons got the same fade/stagger treatment for consistency.
- Added `predev`/`prestart` npm scripts (`kill-port 3000 8000`) so a stale process left on those ports from a previous run no longer silently blocks the next `npm run dev`.

### Fixed
- LAN access broke as a side effect of the Express removal above: Express always talked to Django via `localhost:8000` internally, so Django's `ALLOWED_HOSTS` check never saw a request's real Host header; with the browser now hitting Django directly, a LAN device (e.g. `192.168.x.x:8000`) got a `DisallowedHost` 400 on login. `backend/cinedb/settings.py` now appends `"*"` to `ALLOWED_HOSTS` under `DEBUG`, mirroring the wildcard `CORS_ALLOW_ALL_ORIGINS` already gets in dev.
- The new `tmdb_proxy` view saw sporadic 502s under normal use — a movie/TV detail page fires ~6 concurrent proxy requests, and a bare per-call `requests.get()` (fresh TLS handshake each time, no pooling) occasionally hit a transient connection reset under that burst, unlike the old Express/axios proxy which kept a persistent connection pool. Now uses a shared module-level `requests.Session()` with an `HTTPAdapter`/`Retry` (2 retries, 0.3s backoff) mounted on it, and the timeout raised from 10s to 20s.

## [0.15.3] - 2026-07-14

### Changed
- Dropped `UserAttributeSimilarityValidator` from `AUTH_PASSWORD_VALIDATORS` (`backend/cinedb/settings.py`) — users can now register/reset to a password that resembles their username or email. `MinimumLengthValidator`, `CommonPasswordValidator`, and `NumericPasswordValidator` still apply. `RegisterSerializer.validate()` (`backend/userdata/serializers.py`) simplified back to a field-level `validate_password` hook now that no validator in the active set needs a `user=` instance to compare against.

### Fixed
- `LoginPage.tsx`'s catch block showed "Invalid username or password" for every login failure, including a 429 from `LoginThrottle` (10 attempts/min per IP) — so a user testing several credential combos in quick succession would see every subsequent attempt reported as wrong, even a correct one, once throttled. Now checks the response status and shows a distinct "Too many login attempts" message for 429.

## [0.15.2] - 2026-07-14

### Changed
- README overhauled for portfolio readiness (external review, cross-checked against the repo before acting — the review's ".env.example missing" and "link Swagger" suggestions were already-false/not-applicable and skipped): added a Table of Contents, a `## Highlights` section with real repo-derived numbers (33 API endpoints, 234 tests), a `## Feature Overview` quick-matrix ahead of the detailed feature list, per-theme screenshot captions, a Mermaid request-flow diagram in Architecture Overview, and a `## Deployment` blurb. The ~55-bullet "Key design decisions" list moved out of `README.md` into a new `docs/ARCHITECTURE.md`, linked from the Architecture Overview section instead of inlined.

## [0.15.1] - 2026-07-14

### Fixed
- README's Stats screenshot showed the app's empty state ("Start watching movies and TV shows...") because the throwaway demo account used to capture it had no watch history — regenerated after seeding 6 well-known titles via the `/watched/` API first, so the dashboard, genre charts, and Home page's "Recently Watched" strip all show real data.
- README's Calendar screenshot occasionally showed blank/skeleton poster cards: the capture script's image-load wait only checked `<img>` completeness, but `SkeletonCard`'s antd `Skeleton`/`Skeleton.Image` placeholders don't render real `<img>` tags at all while `CalendarPage`'s own data fetch is still in flight, so the wait passed before any poster existed to load. Also hit the live "next 7 days" TMDB fetch occasionally coming back empty under the capture script's request burst even moments after the same account got a full list — now retries a few times before accepting an empty result.

## [0.15.0] - 2026-07-14

### Added
- README's `## Screenshots` section replaced its `*Coming soon*` placeholder table with 9 real captures under `docs/screenshots/`: Home/Movie Detail/Stats/Calendar in both dark and light theme, plus one phone-width shot showing `BottomNav`.

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
