# Bug Backlog

The working list of known bugs, grouped into planned OpenSpec changes. Sources:
- the 2026-10-03 full audit (against 0.15.8)
- a 2026-10-05 re-check of that audit, plus a review of the uncommitted diff and fresh frontend and backend bug hunts
- a 2026-10-07 second full audit (items 11–15). It had four read-only passes (backend, frontend, infra, tests+docs), and every finding was re-checked against the code. Follow-up "sibling hunts" searched the code for more instances of each bug's pattern. Their findings are tagged N (round 1), R (round 2: leaks, DB, error text, transactions), S (round 3: untrusted data, route params, pagination, a11y) and T (round 4: multi-worker state, account/credential lifecycle, endpoint fuzz).

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
| 5 | `user-local-dates` | ✅ 2026-10-07 | UTC vs local dates: device time zone for "today", per-entry `watched_tz` for history |
| 6 | `fix-data-correctness` | ✅ 2026-10-06 | Backend: quietly wrong numbers/orders |
| 7 | `ci-coverage` + polish | ✅ 2026-10-07 (split into 7a–7e, all archived) | CI gaps, test mocks, drift, light-mode, a11y, Docker |
| 8 | `fix-nav-polish` | ✅ 2026-10-07 | Notification popup off-screen, no Filters button on phones, unused `web-vitals`, React-logo icons |
| 9 | `harden-logging` | ✅ 2026-10-07 | TMDB key leaks via urllib3 retry logs; prod 500s log nothing |
| 10 | `fix-password-revoke-race` | ✅ 2026-10-07 | Refresh racing a password change survives revoke; password-bound token claim |
| 11 | `fix-session-sync` | ⏳ not yet proposed | Second tab writes to another account; refresh/logout on anon 300/day; rehash flips password claim |
| 12 | `harden-backend-2` | ⏳ not yet proposed | Bad `X-Timezone` → 500; recs worker DB writes; uncapped notifications; avatar leftovers |
| 13 | `surface-failures-2` | ⏳ not yet proposed | Following/Calendar failures look empty; Calendar race; Lists keyboard; dates; Register double-submit |
| 14 | `harden-deploy-2` | ⏳ not yet proposed | axios/react-router advisories; stale index.html blank page; ruff pin; compose secrets/proxy count; unused deps |
| 15 | `honest-tests` | ⏳ not yet proposed | Tests that can't fail, mock shape drift, uncovered spec scenarios, docs drift |

Suggested order: **0 → commit → 1 → 2 → 3 → 4 → 6 → 7 → 5** (all done by 2026-10-07). Only 8 remains.

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

## 5. `user-local-dates` (✅ archived 2026-10-07)

**Decided 2026-10-07:** "today" follows the device's time zone, which every authenticated request sends as an `X-Timezone` header. Each watched entry stores the time zone it was logged in (`watched_tz`), so its day stays the same on every device. The Watched page labels a date whose logged time zone differs from the device's. `tzdata` becomes a direct dependency. See `openspec/changes/archive/2026-10-07-user-local-dates/`. Line numbers below are from 2026-10-05; the current ones are in the change's design.md.
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
- ~~`tmdb_proxy` collapses repeated query params via `request.GET.dict()` (`tmdb_proxy_views.py:35`).~~ Already fixed: the proxy uses `request.GET.lists()` (re-checked 2026-10-07).

## 7. `ci-coverage` + polish (✅ all 5 changes archived 2026-10-07)

Split by theme. Each change lives in `openspec/changes/<name>/`. Suggested apply order: **7a → 7b → 7c → 7d → 7e**. 7b and 7e both edit the Dockerfiles, and 7c and 7d both touch the detail pages and `App.tsx`.

| # | Change | Status | Covers |
|---|---|---|---|
| 7a | `ci-coverage` | ✅ 2026-10-06 | CI steps (TS Playwright, tsc, eslint, `makemigrations --check`, Node 22), e2e mocks, stale TS tests, missing tests, dev-only double fetch |
| 7b | `fix-dependency-drift` | ✅ 2026-10-07 | Python pins + constraints file, Django 5.2 LTS, Docker base images, stale Express docs |
| 7c | `frontend-polish` | ✅ 2026-10-07 | Stats light mode, shared colors/helpers, TMDB URLs, fixed widths, CRA leftovers, `any`s, in-place For You Retry |
| 7d | `a11y-routing` | ✅ 2026-10-07 | Keyboard-reachable cards (`CardLink`), aria-labels, 404 page, signed-in users kept off auth pages |
| 7e | `harden-docker` | ✅ 2026-10-07 (Docker checks waived) | `.dockerignore` media, non-root, image-only migrations, CSP/HSTS in nginx, `STATIC_ROOT` |


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

## 8. `fix-nav-polish` (✅ archived 2026-10-07)

See `openspec/changes/archive/2026-10-07-fix-nav-polish/`. All items below are fixed. While applying, two more causes turned up: the rail footer's icon row was wider than the 64px rail, which clipped the bell off-screen, and antd flipped the popup when measuring overflow against the sidebar. Both are fixed: the rail footer is now a 2-column icon grid, and the sidebar bell has `autoAdjustOverflow={false}`.

Found 2026-10-07 while doing the live check for `frontend-polish`. All four were already broken before that change; none of them is in an open proposal.

- **Notification popup renders partly off-screen** (`NotificationBell.tsx:44-48`): at every breakpoint the popup's left edge sits off the viewport (about -230px at 1366px desktop, -290px at 800px tablet, -85px at 375px phone). It measured the same with the original fixed `width: 320`, so the width change in 7c didn't cause it. Cause: the `Dropdown` sets no `placement`, and `getPopupContainer` mounts the popup inside the sidebar footer or bottom nav, where antd's overflow adjustment doesn't keep it on-screen. The sidebar (left edge) and the bottom nav (bell near the center of a 375px bar) likely need different placements. Keep the popup inside the sidebar (CLAUDE.md: no `document.body` popups for sidebar triggers) and re-measure at all 3 tiers.
- **Phones have no Filters button**: the only trigger for `FilterPanel` is in `Sidebar.tsx:152`, and the sidebar is hidden below 768px. `BottomNav.tsx` has no equivalent, so on a phone the browse filters can't be opened at all. The drawer itself fits at 375px since 7c. This fits 7d `a11y-routing`'s theme, but its proposal doesn't cover it yet.
- **`web-vitals` is unused** (`package.json:22`): 7c deleted `src/reportWebVitals.ts`, its only importer, and left the package for 7b. But 7b was archived without removing it. Uninstall it and update the lockfile.
- **App icons are still the React logo**: `public/favicon.ico`, `logo192.png` and `logo512.png` (referenced from `manifest.json` and `index.html`). 7c fixed the name and description only. **Decided 2026-10-07:** generated gold "C" monogram on the dark theme color.

## 9. `harden-logging` (backend) (✅ archived 2026-10-07)

See `openspec/changes/archive/2026-10-07-harden-logging/`. Fixed: the redacting handler is now on the root logger, and `django.request` is set to ERROR.

Promoted from Deferred on 2026-10-07. The old note said "no live leak path today", which was wrong:
- **Live TMDB key leak**: `RedactingFormatter` is attached only to `userdata`. urllib3 logs `Retrying (...) after connection broken by ...: /3/...?api_key=<KEY>` at WARNING on every `tmdb_proxy` retry. Python's last-resort handler writes that to stderr unredacted, so the key lands in `docker logs` and the dev terminal. Reproduced, and confirmed in urllib3 2.6.3's `HTTPConnectionPool.urlopen`. Rotate the TMDB key if old logs were ever shared.
- **Production 500s log nothing**: Django's default `console` handler is filtered to `DEBUG=True`, and `mail_admins` needs `ADMINS`, which isn't set. Under `DEBUG`, `django.request` tracebacks print unredacted.

## 10. `fix-password-revoke-race` (backend) (✅ archived 2026-10-07)

See `openspec/changes/archive/2026-10-07-fix-password-revoke-race/`. Fixed. **Deploying it logs out every existing session once.**

Promoted from Deferred on 2026-10-07.
- **The race**: a password change racing an in-flight refresh on another device. The refresh passes the blacklist check before `_revoke_all_refresh_tokens()` takes its snapshot, and its rotated token is recorded after the snapshot, so it survives and keeps rotating.
- **Fix**: simplejwt's built-in `CHECK_REVOKE_TOKEN` password-hash claim, plus a check of it in `SafeTokenRefreshSerializer` (stock simplejwt checks it only on access tokens). This also ends other sessions' access tokens at once.
- **Decided 2026-10-07**: hard logout of pre-deploy tokens, no grace period.

## Second audit (2026-10-07): items 11–15

Line numbers are from 2026-10-07; re-check them before fixing. Suggested order: **11 → 15 → 13 → 12 → 14**. 11 has the wrong-account writes. 15 makes the tests able to fail before the other fixes lean on them.

**Open decisions (proposed defaults in brackets):**
- **(13 vs 15)** `SearchPage.tsx:194`, `RecommendationsPage.tsx:49` and `FollowingPage.tsx:101` still use `onClick` cards, against CLAUDE.md's CardLink rule. [convert them in 13; don't narrow the rule]
- **(14)** Attach the JWT to TMDB proxy calls so `TmdbProxyThrottle` keys per user. The TMDB client must then not force a logout on a 401. [yes]
- **(14)** Bump axios 1.7.2 → ^1.20 and react-router-dom 6.24.1 → ^6.30.4, then run the full e2e suites. [yes]

**How the throttle findings connect:** TMDB calls carry no token (F6), compose pins `TRUSTED_PROXY_COUNT` (I5), and refresh falls under the anon throttle (B3). So many users can share one IP bucket. A 429 then empties the Calendar silently (F3), or forces a logout on refresh (B3). The CLAUDE.md note that Calendar's "next 7 days" list is "transiently empty" is probably F3 hiding real 429s.

### 11. `fix-session-sync` (frontend + backend) (⏳ not yet proposed)

- **F1 [high] A second tab shows account A but writes go to account B** (`src/context/AuthContext.tsx:41-52`, `src/api/userApi.ts:18-27`):
  - `AuthContext` reads `localStorage` only on mount and has no `storage` listener, but the request interceptor reads `cinedb_access` on every call.
  - Scenario: tab 1 logs out and signs in as B. Tab 2 still renders A's library, and its "mark watched" / "add to watchlist" save to B. Its removes use A's ids and get 404.
  - The `storedUserId()` check covers only the refresh path.
  - Fix: a `storage` listener in `AuthProvider` that adopts the new user, or clears the session, when the user id changes or the keys are removed.
- **B3 [med] Token refresh and logout fall under the default `AnonRateThrottle` (300/day per IP)**:
  - Cause: simplejwt views have `authentication_classes=()` (`urls.py:21,24`).
  - Each device refreshes about 24 times a day, so ~12 users behind one NAT exhaust it.
  - `userApi.ts:216-221` calls `forceLogout()` on any refresh error, 429 and network errors included.
  - Fix: a dedicated scope (e.g. `token_refresh: 60/min`) on `SafeTokenRefreshView` and logout, and force a logout only on 401.
- **B5 [low] Django's automatic password rehash changes the `hash_password` claim**:
  - `check_password()` re-saves the hash when the PBKDF2 iteration count differs. Django 5.2 uses 1.0M iterations, but some hashes were made under 6.0 with 1.2M.
  - Effect: a login after such an upgrade silently ends the user's other sessions.
  - The profile email change calls `check_password(current_password)` but reissues tokens only for `new_password`, so the session that made the change logs itself out.
  - Fix: in `profile`, snapshot the claim value and reissue tokens if it changed. Document the login-on-upgrade behaviour.

### 12. `harden-backend-2` (backend) (⏳ not yet proposed)

- **B1 [med] Some `X-Timezone` / `watchedTz` values cause a 500** (`timezones.py:21-28`):
  - Values that are tzdata directories (`America`, `Etc`, `America/Argentina`) make `ZoneInfo()` raise an `OSError` (`PermissionError` on Windows, `IsADirectoryError` on Linux). It isn't caught. Reproduced 2026-10-07.
  - Affects `/stats/`, `/notifications/new-releases/`, `POST /watched/`, and the whole `bulk_watched` import, against the "bad zones fall back to UTC, never 500" rule.
  - Fix: add `OSError` to the except in `valid_tz_name`.
- **B2 [med] Recommendation refresh writes to the DB from worker threads**:
  - `recommendations.py:138` maps `_ensure_cached` (`update_or_create` at `:89`, plus a fallback query) over a 10-worker pool, so a refresh opens up to 10 extra Postgres connections. CLAUDE.md forbids this.
  - `_refresh_cache`'s thread also never closes its own connection, unlike `metadata_backfill._run_backfill`.
  - Fix: workers only fetch; do the upserts on the calling thread; close the connection in `finally`.
- **B4 [med] Notifications fetch credits for every followed person in one request, with no cap** (`social_views.py:115-138` via `notifications_views.py:28`):
  - With a cold cache, every followed person is fetched 5 at a time, each with a 10s timeout. About 500 follows can exceed gunicorn's 30s.
  - `cache.set_many` runs only after all fetches finish, so a killed worker caches nothing, and every later poll times out again.
  - Fix: cap the people per request and the time spent, and cache each batch as it arrives.
- **B6 [low] Deleting an account leaves the avatar file reachable** at its guessable `/media/avatars/user_<id>.<ext>` URL: `delete_account` doesn't delete the `FileField` file. Fix: delete the avatar before `user.delete()`, or add a `post_delete` receiver.
- **B7 [low] Re-uploading an avatar in the same format shows the cached old photo**: the file name and `avatar_url` don't change (`models.py:134`, `auth_views.py:368-371`). Fix: add a version to the URL (e.g. `?v=<timestamp>`).
- **R2 [low] Replacing an avatar deletes the old file before saving the new one** (`auth_views.py:370-373`): if `profile.save()` fails (disk full, a media-volume permission problem in Docker), the old photo is already gone and the DB row still points to it, so the avatar shows as broken. Fix it together with B7: save under a new versioned name first, then delete the old file once the save has committed.
- **T1 [low] For You can report "ready" while another worker is still refreshing** (`recommendations.py:518,531`):
  - `status` comes from `_computing_users`, which only exists inside one process.
  - With a stale cache, a poll that lands on a gunicorn worker that isn't computing returns `ready`. The page stops polling and shows the old recommendations until a reload, even though another worker finishes the refresh seconds later.
  - Duplicate refreshes across the 3 workers are already accepted (ARCHITECTURE.md "Recommendation refresh coalescing"); this wrong status isn't.
  - Fix: keep a `refreshing_since` timestamp on `UserRecommendationCache`, or have the client keep polling until `computed_at` changes.
- **T2 [low-med] Disconnecting TMDB doesn't revoke the TMDB session**:
  - `tmdb_disconnect` (`tmdb_views.py:68`) only blanks `session_id` locally, and `delete_account` removes it by cascade.
  - Neither calls TMDB's `DELETE /authentication/session`, so the session that gives this app write access to the user's TMDB ratings stays valid on TMDB's side.
  - Any DB backup taken before the disconnect still holds a working write credential.
  - Fix: a best-effort revoke call (logged on failure, never blocking the disconnect or delete) before clearing it.
- **N1 [med] A TMDB outage during a recommendations refresh replaces good recommendations with empty ones** (found by the sibling hunt):
  - Each section's fetch turns a failure into `[]` (`recommendations.py:294,408`), and `_refresh_cache` then calls `update_or_create` unconditionally (`:487`).
  - So For You stays empty or thin for up to `RECOMMENDATIONS_TTL_HOURS` (12h). This is CLAUDE.md's "never write a placeholder on upstream failure" rule, broken at the cache level.
  - Fix: have the compute report whether its TMDB calls failed, and skip the save (keeping the old row) when the result is empty or has lost most of its sections compared to what's cached.

### 13. `surface-failures-2` (frontend) (⏳ not yet proposed)

- **F2 [med] A failed Following load looks like "not following anyone" and never retries** (`FollowedPeopleContext.tsx:48-51`):
  - The `.catch` sets `followed=[]` and `loaded=true`, so FollowingPage shows its empty state and every person card shows "Follow".
  - `requested` stays true, so it never refetches.
  - Fix: expose `error` and `retry()`; FollowingPage shows `<LoadError>`.
- **F3 [med] A failed Calendar load shows "no releases"** (`CalendarPage.tsx:215-220`): the catch only logs, so `groups` stays `[]`. Likely the real cause of the "transiently empty" note in CLAUDE.md. Fix: an error state plus `<LoadError onRetry>`.
- **F4 [med] Calendar filter race** (`CalendarPage.tsx:126-224`): `fetchCalendar` has no cancel or request id. The slower "All" response, which fetches movies then TV, overwrites "TV Shows". Fix: a cancelled flag or request-id ref.
- **F5 [low-med] List cards on the Lists page can't be opened from the keyboard** (`ListsPage.tsx:134-139`): `<Card onClick={navigate}>`, so no Tab stop and no Ctrl-click. Fix: the cover or name becomes a `CardLink`. Also convert the other `onClick` cards (see Open decisions).
- **F7 [low] Two dates break the date convention**:
  - `ListsPage.tsx:186` shows `formatDateDMY(list.createdAt)` on a UTC timestamp, so it shows the UTC day. Use `formatDateInTz`.
  - `StatsPage.tsx:685` shows a raw `yyyy-mm-dd`. Use `formatDateDMY`.
- **F8 [low] Register double-submit** (`RegisterPage.tsx:63`): the submit button has no `loading` state, so a double-click POSTs twice and shows "username exists" over a successful signup.
- **N2 [low-med] Creating a list can produce duplicates**:
  - `createList` (`useLists.ts:55`) has no `createInflight` slot, the create modal has no `confirmLoading` (`ListsPage.tsx:199`), and `UserList` has no unique constraint on `(user, name)`.
  - A double-click on OK, or a double Enter, creates two identical lists, and Import All (which matches lists by exact name) is then ambiguous.
  - `AddToListModal`'s inline create calls the same function.
  - Fix: an inflight slot in the hook plus `confirmLoading`. Whether names should be unique per user is a product call.
- **N3 [low] The list edit modal double-submits** (`ListDetailPage.tsx:272`, `updateList` at `useLists.ts:69`): no guard, so a double-click sends two PATCHes and shows two toasts. Fix: same as N2.
- **N4 [low] HeroBanner race** (`HeroBanner.tsx:24`): the fetch has no cancel. On `/anime` the movies/TV toggle changes `mediaType` on the same instance, so a slow earlier response can show a movie as the TV hero, and clicking it opens `/tv/<movieId>`. (`/movies` ↔ `/tv` is safe: the route remounts.) Fix: a `cancelled` flag in the effect.
- **R1 [med] Error toasts show a single character when the server returns an HTML error page** (`src/utils/apiError.ts:14`):
  - `getApiError` runs `Object.values(data)[0]` on a string body, which returns its first character.
  - Reproduced 2026-10-07: an nginx 502 page shows as `"<"`, and Django's production 500 page (HTML, outside DRF's JSON renderer) shows as `"\n"`, an empty toast.
  - This affects all 53 callers whenever the backend restarts, a worker times out (nginx returns 502), or an exception isn't handled.
  - Network and timeout failures also show axios's raw English (`"Network Error"`, `"timeout of 10000ms exceeded"`).
  - Fix: use only object bodies (otherwise fall back by status: 5xx/502/504 → "The server had a problem. Try again."), and map network errors and timeouts to the "Can't reach the server" wording LoginPage already uses.
- **S1 [med] On desktop, the profile dialog can't be opened from the keyboard**: the sidebar Avatar (`Sidebar.tsx:193`) is a `<span onClick>` with no `tabIndex`, `role` or key handler. So password change, email change and account delete are mouse-only above 768px. The phone layout uses a real `<button>`. Fix: wrap it in a `<button aria-label="Edit profile">`.
- **S2 [low] The sidebar Sign Out icon button has no accessible name** (`Sidebar.tsx:212`): the Tooltip doesn't supply one, so screen readers announce "button". Fix: `aria-label="Sign out"`. Related dead code: the sidebar's "Sign In" branch (`:225`) is unreachable, because `App.tsx` renders the Sidebar only when signed in.
- **S4 [low] The calendar `.ics` export breaks RFC 5545** (`CalendarPage.tsx:64-97`):
  - no `DTSTAMP`, which every `VEVENT` must have (Outlook warns or rejects the file)
  - `SUMMARY` doesn't escape `,` `;` `\` or newlines
  - lines longer than 75 octets aren't folded
  - so a title containing a newline corrupts the file
  - Fix: a small `icsText()` escape helper, plus `DTSTAMP` and line folding.
- **S6 [low] Browse infinite scroll can run past TMDB's 500-page cap**: `HomePage.tsx:132` and `AnimePage.tsx:131` don't apply `Math.min(total_pages, 500)` the way Search and People do. TMDB rejects page 501, so a very long scroll ends in an error instead of a clean end.
- **N5 [low] Two more failures that look like "nothing"**:
  - `FollowingPage.tsx:41` hides the "from people you follow" recommendations on failure, and that effect has no cancel either.
  - `ProfileModal.tsx:55` swallows a failed TMDB-status check, so it shows "Connect TMDB" to an already-connected user.
  - Fix: an error line with Retry, or at least an "unknown" state instead of `false`.

### 14. `harden-deploy-2` (infra + deps) (⏳ not yet proposed)

- **I1 [med] Vulnerable runtime deps**:
  - axios 1.7.2 has about 30 advisories (prototype-pollution gadgets, header injection, ReDoS, unbounded-size DoS).
  - react-router-dom 6.24.1 / `@remix-run/router` 1.17.1 have open-redirect advisories.
  - Fix: bump axios to ^1.20 and react-router-dom to ^6.30.4.
- **I2 [med] A redeploy can leave users on a blank page** (`nginx.conf:30-32`):
  - `index.html` has no `Cache-Control`, so a cached old one requests old hashed chunks.
  - `try_files … /index.html` answers those with HTML and a 200, which `nosniff` blocks.
  - Fix: `location /static/ { try_files $uri =404; }`, plus `no-cache` for `index.html` via a `map` and a server-level `add_header`, so the security headers stay inherited.
- **I3 [low-med] ruff isn't pinned in CI** (`ci.yml:55`). New releases add RUF/UP/B rules, so CI can fail on unchanged code. Fix: pin it in `requirements-test.txt` or the constraints.
- **I5 [low] `TRUSTED_PROXY_COUNT` is hardcoded** in compose `environment:` (`docker-compose.yml:29`), which overrides `env_file`. Behind a TLS terminator, every user then shares one throttle bucket. Fix: `"${TRUSTED_PROXY_COUNT:-1}"`.
- **F6 [low] TMDB proxy calls carry no JWT** (`src/api/tmdb.ts`), so `TmdbProxyThrottle(UserRateThrottle)` always keys by IP and everyone behind one NAT shares 120/min. Fix: attach the token, and don't force a logout on 401 for public data (see Open decisions).
  - **Precondition (found in round 3):** the detail pages pass the raw, decoded `:id` into the proxy path. `/movie/..%2F..%2Fwatchlist` resolves to `/api/watchlist/`. That's harmless today because TMDB calls carry no token, but once F6 adds it, those become authenticated GETs to the app's own endpoints. Check that route ids are positive integers (and render the not-found page otherwise) before adding the header.
- **S3 [low-med] CSV exports don't neutralize formulas** (`src/utils/export.ts:5-7`):
  - A title, review or list name starting with `=`, `+`, `-` or `@` runs as a formula when the export is opened in Excel.
  - Titles come from TMDB, which anyone can edit, so it's not only self-injection.
  - Trade-off: the usual `'` prefix changes what backup import reads back, so `parseBackupCSV` needs a matching strip, and the backup format must stay additive.
- **S5 [low] TMDB `homepage` is rendered as a raw `href`** (`PersonPage.tsx:258`): React 18.3 only warns about `javascript:` URLs and still renders them. Production's CSP (`script-src 'self'`) blocks them, but dev and any deploy without that CSP don't. Fix: render the link only for `http:`/`https:` URLs.
- **I6 [low] The db container gets every app secret**: `env_file: .env.docker` on db (`docker-compose.yml:4`). Fix: pass db only `POSTGRES_PASSWORD`.
- **I7 [low] `backend/.dockerignore` excludes only `.env` and `.env.docker`**, so copies like `.env.local` or `.env.bak` would be baked into the image. Fix: add `.env.*`, `!.env.example` and `*.env.bak`.
- **I8 [low] Unused or misplaced npm deps**:
  - Nothing imports `json2csv`, `file-saver` (+ `@types/file-saver`) or `@testing-library/user-event`.
  - `concurrently` (critical `shell-quote` advisory) and `@testing-library/*` sit in `dependencies`.
- **Notes**:
  - Node is 24 locally but 22 in CI and Docker; there's no `engines` or `.nvmrc`.
  - CI's `npm run build` doesn't set `INLINE_RUNTIME_CHUNK=false`, so CI never builds the CSP bundle that ships.
  - The local Anaconda env drifts from `constraints.txt` in 13 indirect packages, including tzdata, PyJWT and urllib3. One command, not a code change: `pip install -r backend/requirements-test.txt -c backend/constraints.txt`.

### 15. `honest-tests` (tests + docs) (⏳ not yet proposed)

- **[high] Tests that pass without testing anything**:
  - Everything is wrapped in `if locator.count() > 0:` (`count()` doesn't wait):
    - `e2e/python/test_profile.py:34,44,71,74,89,102,106,119,123`, covering profile save success/error and the username/password validation tests
    - `test_detail.py:41,60,162`
  - The "network error" tests assert only that `body` is visible (`test_detail.py:81-86,166-170`).
- **[high] Bare-array list mocks are still there** (the 7a fix was incomplete): `test_watchlist.py:73,88,117`, `test_watched.py:73,100,120`. Wrap them in `paginated()`.
- **[med] Mocks don't match the API**:
  - `MOCK_RATING` sends `createdAt`; the serializer sends `ratedAt`.
  - `MOCK_WATCHLIST_ITEM` still has `"watched": False`.
  - `MOCK_WATCHED_ITEM` lacks `watchedTz`, `platform`, `runtimeMinutes`, `originalLanguage` and `releaseYear`.
  - `MOCK_STATS` sends month `"2024-01"` where the backend sends `"%b %Y"`, and lacks `totalRuntimeMinutes`. `StatsPage.tsx:417` then renders NaN and the test still passes.
  - `MOCK_USER` (Python and TS) lacks `is_staff` and `avatar_url`.
- **[med] Assertions before the page loads, and fixed sleeps**:
  - `test_browse.py:51`, `test_detail.py:150` and `test_search.py:95` assert "0 items" after a fixed 2s wait, which is also true while loading.
  - There are about 25 `wait_for_timeout` waits; the theme tests read attributes after a 300ms sleep.
  - `test_stats.py:27` sleeps inside a route handler.
- **[med] Spec scenarios with no test**:
  - notifications: every frontend scenario except popup position
  - write-feedback: clear-watchlist fail, follow fail/double-click, episode-progress fail, rating fail keeps the dialog's input, toast dedupe, unfollow from Following
  - login-page: the 429 message, username trim, autofocus, inputs disabled in flight, the `/search?tab=people` round trip
  - accessibility: Ctrl-click opens a new tab, focus outline in light theme, episode-stepper labels
- **[med] Docs drift** (fixed in 0.19.0 except the CardLink rule, which waits on the open decision):
  - README test counts: pytest says 217 (actually 226), TS Playwright says 27 (actually 38 per project).
  - CLAUDE.md "Library item cards" lists `ListsPage` (it's actually `ListDetailPage`).
  - "Failed-login UX" omits the 429 branch.
  - The CardLink rule is stated as global but has 3 exceptions in code.
  - `PersonCard` users are missing `FollowingPage`.
  - The FilterPanel path is `src/components/layout/`.

## Deferred / out of scope (noted, not planned)

Nothing open.

## Won't fix

- **Migration 0018 renames/deletes avatar files inside a DB transaction**, so a mid-loop DB error would roll back the rows but not the files. Closed 2026-10-07:
  - it shipped in 0.16.0, so every existing DB has already applied it, and only fresh (avatar-less) DBs run it again
  - the loop already catches decode errors, so only a DB error could trigger the rollback
  - the worst case is a broken avatar link
  - the only fix (`atomic = False`) would edit an already-applied migration
## Verified fine (don't re-audit)

- No IDOR: all views filter by `request.user`.
- Migrations are in sync (`makemigrations --check` passes).
- The TMDB proxy host is fixed (no path traversal).
- The watched-toggle convention is followed everywhere.
- Pagination edge cases (out of range, page 0, non-int) → 404.
- Duplicate-create races are handled by `get_or_create`.
- `USE_TZ` is on and there are no naive datetimes.
- 2026-10-07 audit, backend:
  - every token is issued via `RefreshToken.for_user` (password claim present); logout works with stale-claim tokens
  - no `print()`, all logs reach the redacting root handler
  - `bulk_import`, `FiniteFloatField` and the `-id` tiebreakers are complete
  - `request_refresh` early exits call `_finish_refresh`; the `/media/` serve uses `safe_join`; migrations 0019/0020 are additive
- 2026-10-07 audit, frontend:
  - library hooks: inflight slots, errors, reset on logout
  - `usePaginatedFetch` guard; Search/For You unmount caches
  - detail pages' `allSettled` + `LoadError`; MarkWatchedModal everywhere
  - `user-local-dates` helpers, with no `toISOString().slice` left
  - today's nav changes; search input ids
- 2026-10-07 sibling hunts (rounds 2–4):
  - every timer, listener and object URL is cleaned up; the backend module caches are bounded
  - per-user filters are covered by unique indexes that start with `user`; there are no N+1 queries
  - no `str(e)` reaches API responses; every `<img>` has `alt`; external links have `rel="noopener noreferrer"`; no `innerHTML`
  - per-user singleton tables are `OneToOneField`, so worker races can't duplicate them
  - endpoint fuzz: 39 routes × hostile query params, headers and JSON bodies (arrays, `NaN`, `2**63`, NUL bytes, bad dates) with TMDB stubbed to fail gave no 500 except B1
- 2026-10-07 audit, infra:
  - the CSP covers every external origin, and no `location` block drops the security headers
  - gunicorn 30s is under nginx's 60s timeout; non-root uid and media chown; no published db/backend ports
  - `.env.docker` is ignored by git and Docker
  - the icon files match the manifest
