# Bug Backlog

The working list of known bugs, grouped into planned OpenSpec changes. Sources:
- the 2026-10-03 full audit (against 0.15.8)
- a 2026-10-05 re-check of that audit, plus a review of the uncommitted diff and fresh frontend and backend bug hunts

Line numbers were accurate on 2026-10-05; re-check before fixing. When a change is proposed, link it here. When it's archived, mark it done.

**Status key:** ✅ done (archived) · 📝 proposed (`openspec/changes/<name>`) · ⏳ not yet proposed

| # | Change | Status | Theme |
|---|---|---|---|
| — | `harden-security-p0` | ✅ 2026-10-04 | Key leaks, avatar XSS, throttle bypass, email re-auth, fail-closed settings |
| — | `fix-ops-reliability` | ✅ 2026-10-04 | Healthcheck throttle, entrypoint timeout, refresh-thread storm |
| — | `fix-session-lifecycle` | ✅ 2026-10-05 | Refresh rotation, revoke-all, logout endpoint, teardown, safe retries |
| 0 | `fix-session-followups` | ✅ 2026-10-05 | Regressions/gaps in the uncommitted work above, to fix **before committing** |
| 1 | `harden-input-validation` | ✅ 2026-10-05 | Backend: bad input → 400, never 500 |
| 2 | `fix-backup-roundtrip` | ✅ 2026-10-05 | Export/import loses or corrupts data |
| 3 | `surface-failures` | ✅ 2026-10-06 | Frontend: errors shown as empty/success; unsafe writes |
| 4 | `fix-browse-filters` | ✅ 2026-10-06 | Browse/list filter, restore and pagination UX bugs |
| 5 | `user-local-dates` | ⏳ needs design decision | UTC vs local dates |
| 6 | `fix-data-correctness` | ✅ 2026-10-06 | Backend: quietly wrong numbers/orders |
| 7 | `ci-coverage` + polish | 📝 split into 5 | CI gaps, test mocks, drift, light-mode, a11y, Docker |
| 8 | found during `frontend-polish` | ⏳ not yet proposed | Notification popup off-screen, no Filters button on phones, unused `web-vitals`, React-logo icons |

Suggested order: **0 → commit → 1 → 2 → 3 → 4 → 6 → 7**. Do 5 once its design question is settled.

---

## 0. `fix-session-followups` (✅ archived 2026-10-05)

See `openspec/changes/archive/2026-10-05-fix-session-followups/` for the full proposal, design and tasks. Live verification found that Chromium's cross-tab `localStorage` lag can let a second tab send one extra (rejected) refresh. That's handled by a 1.5s grace wait, and the spec was amended to match. In short:
- Recommendations/Search unmount saves rewrite the previous user's cache after logout (`RecommendationsPage.tsx:241-250`, `SearchPage.tsx:104-111`).
- Two tabs refreshing at once log each other out (`userApi.ts:98-123`).
- A logout racing an in-flight refresh re-stores tokens.
- Recommendation slot stuck "pending" after a DB error (`recommendations.py:464-470`).
- Revoke-all runs 2 queries per token, expired ones included (`auth_views.py:59-60`).
- `DatabaseCache` keeps only 300 entries, so throttle counters get culled.
- TMDB proxy worst case is ~100s against gunicorn's 30s (`tmdb_proxy_views.py:23,37`).
- Needs `pytest>=8.4`.
- Settings tests break when `backend/.env` has `DEBUG=True`.
- `docker-entrypoint.sh` has CRLF line endings; needs `.gitattributes`.
- **Manual:** `.env.docker` still has `ALLOWED_HOSTS=*`, so `docker compose up` fails until real hosts are listed.

## 1. `harden-input-validation` (backend) (✅ archived 2026-10-05)

See `openspec/changes/archive/2026-10-05-harden-input-validation/`. All items below are fixed. Fuzzing also found a PNG with no `IDAT` chunk 500ing the avatar upload via `IndexError`, which is fixed too.

One rule: any malformed input gets a `400`, never a `500` and never stored data that breaks reads.
- **NaN/Infinity floats are accepted** (`serializers.py:104,117,147,160`; `watched_views.py:90`). `"NaN"` passes `min/max_value`, Postgres stores it, and then every GET of watchlist/watched/ratings/lists/stats 500s for that account permanently. Fix: reject non-finite values with `math.isfinite`.
- Hand-declared `CharField`s drop the model's `max_length`, so long values cause a DataError 500 (`posterPath`, `platform`, `originalLanguage`; `serializers.py:103,116,119,124,159`).
- Unbounded `IntegerField`s overflow Postgres `integer` (`mediaId`, `releaseYear`, `runtimeMinutes`; episode `season`/`episode` in `social_views.py:32-33`). Negative `runtimeMinutes` is accepted.
- `mediaType` `CharField` accepts any string, bypassing the model choices (`serializers.py:102,115,146,158`).
- Watchlist/rating PATCH can change `mediaId`/`mediaType`, which can collide with `unique_together` → IntegrityError 500 (`watchlist_views.py:53-55`, `ratings_views.py:70-72`).
- `bulk_watched`/follow 500 on a list body, non-dict entries or non-int ids (`watched_views.py:62,78-91`, `social_views.py:60-70`).
- Password-reset endpoints 500 on non-string JSON values (`auth_views.py:85,139-156`).
- A decompression-bomb avatar 500s instead of returning 400; `DecompressionBombError` isn't an `OSError` (`auth_views.py:286-292`).
- Profile PATCH skips `UnicodeUsernameValidator`. Two concurrent renames to the same name → IntegrityError 500 (`serializers.py:56,61-65`; `auth_views.py:227`).
- Ratings aren't forced to 0.5 steps, and TMDB silently rejects such a value (`serializers.py:147`).

## 2. `fix-backup-roundtrip` (✅ archived 2026-10-05)

See `openspec/changes/archive/2026-10-05-fix-backup-roundtrip/`. All items below are fixed. It introduced backup format v2 (additive: `manifest.json`, `ratings.csv`, extra watched columns), and it also took the pagination `-id` tiebreaker from item 6.

- **Import All crashes** when the backup has a list that doesn't exist yet. `res.data.find` is called on the paginated `/lists/` response, by which point the watchlist/watched data is already written and an empty list created. Re-running duplicates lists (`CSVImportAllModal.tsx:151-156`).
- Export omits ratings, runtime and platform, and import drops `watched_at`, so a restore wipes stats history and all ratings and reviews (`utils/export.ts:34-38`, `CSVImportAllModal.tsx:136-139`). **Format decision needed:** add ratings to the export while keeping old backups importable.
- `addToWatchlist` is called in a loop without `await` or catch, so the success toast reports the parsed count instead of what was added (`CSVImportAllModal.tsx:126-128`).
- Raw `fetch('/api/tmdb/...')` bypasses the API base URL, so it fails in dev, and `res.ok` is never checked (`CSVImportAllModal.tsx:64`).
- CSV parsing:
  - the `;` delimiter isn't supported (`csvParse.ts:30`)
  - media type is chosen separately from the file and applied to every row (`CSVUploadModal.tsx`, `CSVListImportModal.tsx`)
  - the file input isn't reset after an error, so re-selecting the same file does nothing
- `bulk_watched` uses `bulk_create`, which sends no `post_save`, so recommendations never refresh after an import (`watched_views.py:100`).
- `bulk_watched`'s pre-check runs outside the transaction (`watched_views.py`). The mixed int/str id miscount was fixed in `harden-input-validation`, which dedupes on the validated int id.

## 3. `surface-failures` (frontend) (✅ archived 2026-10-06)

Possibly split into read-path and write-path changes.
- **Reads:**
  - Library hooks have no `.catch`, so a failed load looks like an empty library (`useWatched.ts:24-43`, `useWatchlist.ts:24-41`, `useRatings.ts:24-43`, `useLists.ts:30-43`).
  - `usePaginatedFetch`: a failed page 1 keeps the previous category's items with no error state (`:87-92`); a stale `loadMore` gets appended after the query changes (`:109-127`).
  - Stats page shows "Start watching…" when the request actually failed. Users with zero watched titles see only the empty state (`StatsPage.tsx:311-325`).
  - Library pages show the empty-state CTA while still loading (`WatchlistPage.tsx:164`, `WatchedPage.tsx:163`, `ListDetailPage.tsx:84-101`; `useLists.isLoading` starts `false`).
  - Detail pages use `Promise.all`, so one failed sub-request = the whole page errors, with no 404 state (`MovieDetailPage.tsx:36-42`, `TVDetailPage.tsx:36-43`).
  - `PersonPage` with an invalid id shows a blank page and has no cancellation (`:53-80`). `MediaCardGrid` gets duplicate keys for repeated credits (`:31`).
  - `EpisodeGuide`'s skeleton gets stuck when switching back to a cached season, and there's no catch (`:31-46`).
  - `useEpisodeProgress` has no cancel and no reset on `showId` change (`:10-17`).
- **Writes:**
  - `RatingModal` closes before the save resolves, so the review text is lost on failure. No UI can delete a rating (`RatingModal.tsx:17-21`).
  - `WatchlistPage`'s `toggleWatched` isn't awaited, so a success toast shows even on failure (`:299-303`).
  - `TVShowDetails` episode-progress writes have no try/catch (`:257-259,275-277,301-305`).
  - Follow/unfollow have no try/catch (`PersonPage.tsx:184-192`, `PersonCard.tsx:71-80`).
  - Double-clicking any toggle sends 2 POSTs/DELETEs; there's no in-flight guard anywhere.
  - Context types declare Promise-returning functions as `void`, which hides missing `await`s (`types/context.ts:31,35,44`).
- **Other:**
  - `useFollowedPeople` is instantiated per `PersonCard`, so a grid makes N fetches with unshared state. It should be a context.
  - `NotificationBell`: unread items are never shown bold, because `markSeen` runs in the same batch. The bell is mounted twice, giving 2 pollers whose badges disagree (`NotificationBell.tsx:30-33`, `useNotifications.ts:42-44`).
  - `ProfileModal`'s Danger Zone password survives close/reopen (`:47,344-361`).

## 4. `fix-browse-filters` (frontend) (✅ archived 2026-10-06)

See `openspec/changes/archive/2026-10-06-fix-browse-filters/`. All items below are fixed. Verification also found a dev-only double restore fetch; it already happens on `main` and is tracked under item 7.

- **Genres:**
  - Movie genre IDs are sent to TV discover, so Action/Sci-Fi/etc. return zero TV results (`constants/genres.ts`, `HomePage.tsx:95-124`, `AnimePage.tsx:92-96`).
  - `with_genres` is sent to category endpoints that ignore it.
- `hasFilters` is always true after any Apply, because the `includeAdult: false` boolean passes `!== ""`. Category buttons then stop working (`HomePage.tsx:80-82`, `AnimePage.tsx:99-101`).
- A runtime filter set on Movies carries over to TV, where it's hidden and can't be cleared. `original_title.asc` is sent to TV discover (`App.tsx:41-42`, `FilterPanel.tsx:155-180`, `tmdb.ts:264-265`).
- Browser Back/swipe-back loses browse state; only the in-app Back button sets `isReturn` (`HomePage.tsx:53-70`, `AnimePage.tsx:54-78`).
- Search tab scroll position bleeds across tabs (`SearchPage.tsx:104-120`).
- `ListDetailPage` `keyPrefix: "listdetail"` is shared by every list, so filters leak between lists (`:46`).
- `WatchedPage` doesn't clamp the page after unmarking the last item, leaving a blank grid (`:48,68,226`).
- `useLibraryFilters` tests the trimmed search but matches the untrimmed one (`:52`).
- Login redirect drops the query string (`LoginPage.tsx:14`).
- Home "Recently Watched" doesn't show newly watched titles: they're appended instead of prepended (`useWatched.ts:61`).
- For You cache saved mid-computation suppresses polling for 5 minutes (`RecommendationsPage.tsx:181-199`).
- Anime "Airing Today" sorts by `first_air_date.desc` and shows unaired shows (`AnimePage.tsx:38`).

## 5. `user-local-dates`

**Design decision first:** either the backend learns the user's timezone, or it returns raw timestamps and the frontend does the bucketing.
- `CalendarPage.tsx:73,130,140-141` uses `toISOString().slice(0,10)` (UTC).
- `stats_views.py:60,131` buckets `watched_at.date()` in UTC, so the heatmap and monthly charts are off by one day.
- Notifications compare same-day releases with a strict `>`, so a release on the day of the last check is never unread (`notifications_views.py:32,60`).

## 6. `fix-data-correctness` (backend) (✅ archived 2026-10-06)

See `openspec/changes/archive/2026-10-06-fix-data-correctness/`. All items below are fixed.

- ~~Pagination orders by a non-unique timestamp with no tiebreaker.~~ Fixed in `fix-backup-roundtrip` (`-id` tiebreaker on all five list endpoints).
- Notifications only check the 10 most recently followed people (`notifications_views.py:29` → `social_views.py:88,93`).
- Genre stats are always empty with fewer than 3 watched titles, because `genre_ids` is only filled inside `_compute_personalized` (`stats_views.py:69,149`; `recommendations.py:341,350`).
- A failed TMDB fetch is cached as empty for 7 days and overwrites good data (`recommendations.py:78-88`).
- Stats backfill starts a 20-worker pool on every `/stats` request with nothing to dedupe it; failed rows retry forever (`stats_views.py:86-106`).
- `watched` POST drops `originalLanguage`/`releaseYear` (`watched_views.py:30-36`; the frontend also omits them).
- Ratings PATCH doesn't sync to TMDB (`ratings_views.py:70-73`).
- Re-rating keeps the original `rated_at` (`auto_now_add`).
- List items have no ordering (`lists_views.py:16`).
- Duplicate recommendation section keys: `because-{id}` has no media type, `actor-{name}`, `follow-{name}`; KMeans can produce duplicate labels.
- `tmdb_proxy` collapses repeated query params via `request.GET.dict()` (`tmdb_proxy_views.py:35`).

## 7. `ci-coverage` + polish (📝 proposed as 5 changes)

Split by theme. Each change lives in `openspec/changes/<name>/`. Suggested apply order: **7a → 7b → 7c → 7d → 7e**. 7b and 7e both edit the Dockerfiles, and 7c and 7d both touch the detail pages and `App.tsx`.

| # | Change | Status | Covers |
|---|---|---|---|
| 7a | `ci-coverage` | ✅ 2026-10-06 | CI steps (TS Playwright, tsc, eslint, `makemigrations --check`, Node 22), e2e mocks, stale TS tests, missing tests, dev-only double fetch |
| 7b | `fix-dependency-drift` | ✅ 2026-10-07 | Python pins + constraints file, Django 5.2 LTS, Docker base images, stale Express docs |
| 7c | `frontend-polish` | ✅ 2026-10-07 | Stats light mode, shared colors/helpers, TMDB URLs, fixed widths, CRA leftovers, `any`s, in-place For You Retry |
| 7d | `a11y-routing` | 📝 | Keyboard-reachable cards (`CardLink`), aria-labels, 404 page, signed-in users kept off auth pages |
| 7e | `harden-docker` | 📝 | `.dockerignore` media, non-root, image-only migrations, CSP/HSTS in nginx, `STATIC_ROOT` |


- **CI:**
  - The TS Playwright suite never runs in CI, and `playwright.config.ts` hardcodes `G:/Anaconda` and `kill-port`.
  - No `makemigrations --check`, eslint or tsc step.
  - Nothing is pinned; Node 18 is EOL; there's a dead `TMDB_API_KEY` in the frontend build env.
- **Test mocks:**
  - e2e mocks return a bare `[]` where the real API returns paginated `{results}`.
  - TS specs' notifications route lacks a trailing `**`, mark-seen is unmocked, and 3 specs have no catch-all route.
- **Dev-only double restore fetch** (found 2026-10-06 while verifying `fix-browse-filters`; also on `main`): returning to a browse page (in-app or browser Back) under `npm run dev` fetches each restored page twice, and HeroBanner's trending twice. That's the StrictMode double mount; production builds are unaffected and the result is correct. Check whether `usePaginatedFetch`'s replay guard should also cover the restore path.
- **Missing tests:** profile, lists, recommendations, episode-progress, followed-people. (`usePaginatedFetch` unit tests and a stats error/retry e2e test landed with `surface-failures`.)
- **Stale TS e2e tests** (fail locally against current UI; found while verifying `surface-failures`):
  - `e2e/auth.spec.ts:103,112`: `getByLabel("Password")` now also matches "Confirm Password" (strict-mode violation), and the short-password message text has changed.
  - `e2e/movies.spec.ts:120` (mobile-chrome only): fills the sidebar search box, which is hidden below 768px.
- **Drift:**
  - `requirements.txt` pins `django<5.0` but the env has 5.2.17; migrations 0010+ say "Generated by Django 6.0".
  - Stale Express references in `docs/ARCHITECTURE.md`, `.env.docker`, `.env.example` and `e2e/python/conftest.py:4`.
- **Light mode:** `StatsPage` hardcodes `rgba(255,255,255,…)` text (`:129,135,174,199,238,242,296`).
- **Hardcoded values:**
  - ~30 hardcoded `#52c41a`/`#f5c518` instead of the shared constants
  - `voteColor` duplicated 5 times
  - raw TMDB URLs in `EpisodeGuide.tsx:11` and `WatchProviders.tsx:30`
  - fixed widths in FilterPanel/NotificationBell
  - `AddToListModal` inputs missing `id`/`name`
- **CRA leftovers** (found 2026-10-06; frontend is otherwise TS-only, `allowJs: false`, no tracked `.js`):
  - `public/manifest.json` still names the app "React App" / "Create React App Sample", so a PWA install shows the wrong name.
  - `public/index.html` keeps CRA's `meta description` ("Web site created using create-react-app") and template comments.
  - `src/logo.svg` is unused; `reportWebVitals()` is called with no callback (a no-op). Check whether `favicon.ico`/`logo192.png`/`logo512.png` are still the default React icons.
- **Loose types:** 7 explicit `any`s, mostly fields missing from `src/types/tmdb.ts`:
  - `TVShowDetails.tsx:81-82` (`created_by`), `MovieDetails.tsx:82-83` (crew `job`), `MovieDetailPage.tsx:56` (`recommendations`), `CalendarPage.tsx:195` (`first_air_date`)
  - `RegisterPage.tsx:14` `catch (err: any)` → `unknown` + `getApiError()`
  - stale `eslint-disable no-unused-vars` above `TMDBCallbackPage` (`App.tsx:33`); it is used by `/tmdb-callback`
  - `RecommendationsPage.tsx:406` Retry still does `window.location.reload()`; move to an in-place refetch like the `surface-failures` pages
- **Docker:**
  - `.dockerignore` lacks `media/`
  - container runs as root
  - migrations are bind-mounted; `--run-syncdb` is used
  - no CSP/HSTS
  - no `STATIC_ROOT`
- **Accessibility/routing:**
  - `MediaCardGrid` cards aren't keyboard-reachable
  - `TVShowDetails` icon buttons lack `aria-label`
  - the `*` route redirects instead of showing a 404
  - logged-in users can open `/login`

## 8. Found during `frontend-polish` (⏳ not yet proposed)

Found 2026-10-07 while doing the live check for `frontend-polish`. All four were already broken before that change; none of them is in an open proposal.

- **Notification popup renders partly off-screen** (`NotificationBell.tsx:44-48`): at every breakpoint the popup's left edge sits off the viewport (about -230px at 1366px desktop, -290px at 800px tablet, -85px at 375px phone). It measured the same with the original fixed `width: 320`, so the width change in 7c didn't cause it. Cause: the `Dropdown` sets no `placement`, and `getPopupContainer` mounts the popup inside the sidebar footer or bottom nav, where antd's overflow adjustment doesn't keep it on-screen. The sidebar (left edge) and the bottom nav (bell near the center of a 375px bar) likely need different placements. Keep the popup inside the sidebar (CLAUDE.md: no `document.body` popups for sidebar triggers) and re-measure at all 3 tiers.
- **Phones have no Filters button**: the only trigger for `FilterPanel` is in `Sidebar.tsx:152`, and the sidebar is hidden below 768px. `BottomNav.tsx` has no equivalent, so on a phone the browse filters can't be opened at all. The drawer itself fits at 375px since 7c. This fits 7d `a11y-routing`'s theme, but its proposal doesn't cover it yet.
- **`web-vitals` is unused** (`package.json:22`): 7c deleted `src/reportWebVitals.ts`, its only importer, and left the package for 7b. But 7b was archived without removing it. Uninstall it and update the lockfile.
- **App icons are still the React logo**: `public/favicon.ico`, `logo192.png` and `logo512.png` (referenced from `manifest.json` and `index.html`). 7c fixed the name and description only. **Blocked on the user:** supply CINE DB artwork, or approve a simple generated wordmark.

## Deferred / out of scope (noted, not planned)

- A password change racing an in-flight refresh on another device: the rotated token is recorded after the revoke loop and survives.
- TMDB key redaction covers only the `userdata` logger (no live leak path today).
- Migration 0018 renames/deletes files inside a DB transaction, so they aren't rolled back on failure.

## Verified fine (don't re-audit)

- No IDOR: all views filter by `request.user`.
- Migrations are in sync (`makemigrations --check` passes).
- The TMDB proxy host is fixed (no path traversal).
- The watched-toggle convention is followed everywhere.
- Pagination edge cases (out of range, page 0, non-int) → 404.
- Duplicate-create races are handled by `get_or_create`.
- `USE_TZ` is on and there are no naive datetimes.
