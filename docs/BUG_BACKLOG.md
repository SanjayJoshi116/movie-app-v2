# Bug Backlog

The working list of known bugs, grouped into planned OpenSpec changes. Sources:
- the 2026-10-03 full audit (against 0.15.8)
- a 2026-10-05 re-check of that audit, plus a review of the uncommitted diff and fresh frontend and backend bug hunts
- a 2026-10-07 second full audit (items 11–15). It had four read-only passes (backend, frontend, infra, tests+docs), and every finding was re-checked against the code. Follow-up "sibling hunts" searched the code for more instances of each bug's pattern. Their findings are tagged N (round 1), R (round 2: leaks, DB, error text, transactions), S (round 3: untrusted data, route params, pagination, a11y) and T (round 4: multi-worker state, account/credential lifecycle, endpoint fuzz).
- a 2026-10-09 third full audit (items 16–21) against 0.20.0 (`b3a5930`). Five read-only passes (backend API, backend upstream/background, frontend state, frontend pages, infra/CI/tests/docs). Items marked ✔ were re-checked against the code by hand; the rest rest on each pass's code trace or repro.
- a 2026-10-09 fourth round (items 22–25, plus additions to 17, 20 and 21), same day, cross-cutting instead of per-layer: a sibling hunt for the third audit's patterns, cross-feature data flows, an adversarial security pass, and a spec-vs-code conformance check of all 29 `openspec/specs`. A live Playwright run of the app was the fifth pass.

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
| 11 | `fix-session-sync` | ✅ 2026-10-08 | Second tab writes to another account; refresh/logout on anon 300/day; rehash flips password claim |
| 12 | `harden-backend-2` | ✅ 2026-10-08 | Bad `X-Timezone` → 500; recs worker DB writes; uncapped notifications; avatar leftovers |
| 13 | `surface-failures-2` | ✅ 2026-10-08 | Following/Calendar failures look empty; Calendar race; Lists keyboard; dates; Register double-submit |
| 14 | `harden-deploy-2` | ✅ 2026-10-08 | axios/react-router advisories; stale index.html blank page; ruff pin; compose secrets/proxy count; unused deps |
| 15 | `honest-tests` | ✅ 2026-10-08 | Tests that can't fail, mock shape drift, uncovered spec scenarios, docs drift |
| 16 | `fix-ci-lint` | ✅ 2026-10-09 | `main` fails CI lint (`no-script-url` in `safeUrl.test.ts`) |
| 17 | `fix-upstream-resilience` | ⏳ | Infinite-scroll retry loop; TMDB 404 freezes recs; missing time budgets; `session_id` in logs |
| 18 | `fix-account-edges` | ⏳ | Blank-email profile 400; year-1 date breaks Stats; logout response race; Profile stale fields/partial export |
| 19 | `fix-detail-and-nav` | ⏳ | Stray `0`; browse cards not links; Following Back target; crew credits; providers/runtime |
| 20 | `fix-stats-math` | ⏳ | Banker's rounding buckets, skipped months, 0-score average, tooltip labels |
| 21 | `harden-ci-2` + polish | ⏳ | Pagination test gap, Playwright retries, gzip/cache, Docker build job, hex sweep, docs drift |
| 22 | `harden-security-3` | ✅ 2026-10-09 | Forgeable TMDB connect; import-driven TMDB amplification; unbounded review/description; reset token in nginx logs |
| 23 | `fix-recs-correctness` | ⏳ | Movie/TV genre ids mixed in For You; ratings never refresh recs; gave-up poll cached as complete |
| 24 | `fix-import-export-2` | ⏳ | Backup omits follows/episode progress; same-name lists merge; Watched CSV loses dates; import posters throttled |
| 25 | `fix-write-guards-2` | ⏳ | Episode progress load error → overwrite; review-only edit syncs TMDB; dialogs closable mid-save; stale panels |

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
- **(13 vs 15)** `SearchPage.tsx:194`, `RecommendationsPage.tsx:49` and `FollowingPage.tsx:101` still use `onClick` cards, against CLAUDE.md's CardLink rule. **Decided 2026-10-08:** convert them in 13; the rule stays global.
- **(14)** Attach the JWT to TMDB proxy calls so `TmdbProxyThrottle` keys per user. The TMDB client must then not force a logout on a 401. **Decided 2026-10-08:** yes, with route-id validation first. **Closed:** implemented in `harden-deploy-2` (`useValidId`, then the token plus a 401 retry without it).
- **(14)** Bump axios 1.7.2 → ^1.20 and react-router-dom 6.24.1 → ^6.30.4, then run the full e2e suites. **Decided 2026-10-08:** yes, both. Also decided: CSV neutralization uses a `'` prefix plus an import strip; Node pinned to 22. **Closed:** implemented in `harden-deploy-2` (axios 1.20.0, react-router-dom 6.30.6). Two react-router advisories remain that are fixed only in v7, recorded as accepted in its tasks.md.

**How the throttle findings connect:** TMDB calls carry no token (F6), compose pins `TRUSTED_PROXY_COUNT` (I5), and refresh falls under the anon throttle (B3). So many users can share one IP bucket. A 429 then empties the Calendar silently (F3), or forces a logout on refresh (B3). The CLAUDE.md note that Calendar's "next 7 days" list is "transiently empty" is probably F3 hiding real 429s.

### 11. `fix-session-sync` (frontend + backend) (✅ archived 2026-10-08)

See `openspec/changes/archive/2026-10-08-fix-session-sync/`. All three items below are fixed. Tabs are bound to the account they show (storage listener + request guard), refresh/logout have their own `token_refresh` throttle and only a 400/401 refresh ends the session, and a rehash during a profile edit reissues tokens. Accepted, not fixed: a login that rehashes ends the user's other sessions once per hasher upgrade (`docs/ARCHITECTURE.md`).

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

### 12. `harden-backend-2` (backend) (✅ archived 2026-10-08)

See `openspec/changes/archive/2026-10-08-harden-backend-2/`. All items below are fixed. Deviations: the refresh thread closes its DB connection in its thread target (`_refresh_thread`), and with no stored row a failed refresh that still produced sections is saved (only an empty failed result writes nothing).

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

### 13. `surface-failures-2` (frontend) (✅ archived 2026-10-08)

See `openspec/changes/archive/2026-10-08-surface-failures-2/`. All items below are fixed, H1 included. The 3 `onClick` cards were converted, so the CardLink rule has no exceptions. List names stay non-unique; only the double-submit is blocked. Side find: 4 Python rating tests matched `name="Edit"` as a substring and broke on the new "Edit profile" button. They now use "Edit rating".

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
  - Fix: an inflight slot in the hook plus `confirmLoading`. **Decided 2026-10-08:** names stay non-unique; only the double-submit is blocked.
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
- **H1 [low] The search term isn't in the URL** (found 2026-10-08 by `honest-tests`): `SearchPage.tsx` reads only `tab` from the URL, and the term lives in app state (`useAppContext().searchTerm`). So a login round trip, a reload or a shared `/search?tab=people` link lands on the empty "Type something" state with no tabs, and `SearchBox.tsx:34` navigates to bare `/search`, dropping `tab`. The `login-page` spec's "lands on `/search?tab=people` with the People tab active" can only be half met: `e2e/auth.spec.ts` asserts the URL and notes the gap. Fix: put the term in the URL (`?q=`), read it on mount, and keep `tab` when searching.

### 14. `harden-deploy-2` (infra + deps) (✅ archived 2026-10-08)

See `openspec/changes/archive/2026-10-08-harden-deploy-2/`. All items below are fixed. Docker checks (`nginx -t`, curls, `docker compose config`) were waived: no Docker here; `test_nginx_conf.py` covers the config statically. Accepted: two react-router advisories fixed only in v7. Operator step pending on this machine: create `.env.db` and remove both password keys from `.env.docker` (README upgrade note). Side find: a `refreshing_since` clear bug from 12 (`lt` vs `lte` on a coarse clock), fixed.

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

### 15. `honest-tests` (tests + docs) (✅ archived 2026-10-08)

See `openspec/changes/archive/2026-10-08-honest-tests/`. All items below are fixed: the guards and sleeps are gone, the mocks match the serializers (checked by `test_e2e_mock_shapes.py`), bare-list mocks fail at teardown, and the missing scenarios have tests. Each new or changed test was shown to fail against a break of its behavior. Found along the way: the profile save/validation tests had never run (the modal has no footer, so their Save button never existed); the login submit button wasn't disabled in flight (fixed); and H1 under item 13 (the search term isn't in the URL). The CardLink rule wording still waits on item 13's decision.

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

## Third audit (2026-10-09): items 16–21

Line numbers are from 2026-10-09 (`b3a5930`); re-check them before fixing. ✔ = re-checked by hand against the code. Suggested order: **16 → 17 → 18 → 19 → 20 → 21**. 16 unblocks CI, so the later changes get a real Jest/build run.

At audit time, typecheck, Jest (220), backend pytest (270), ruff, `manage.py check` and `makemigrations --check` all passed. Only `npm run lint` failed (item 16).

**Open decisions:**
- **(19)** TV runtime in `MarkWatchedModal` is one episode's length (`episode_run_time[0]`), and the input is disabled. Should a whole-series watch count episodes × runtime, let the user edit it, or stay as is (documented)?
- **(19)** Browse grids (`HomePage.tsx:160`, `AnimePage.tsx:167`) hide watched titles, so a card disappears right after it's marked watched. Is that intended? If so, document it.
- **(19)** Person pages: add crew credits (Directing/Writing) as their own tab, or merge them into Movies/TV?

### 16. `fix-ci-lint` (✅ archived 2026-10-09)

See `openspec/changes/archive/2026-10-09-fix-ci-lint/`. Fixed with a line-scoped `eslint-disable-next-line no-script-url` on the test input; the rule stays on for app code.


- **[high] ✔ `main` fails CI.** `src/utils/__tests__/safeUrl.test.ts:10`: the literal `"javascript:alert(1)"` trips `no-script-url`, and `npm run lint` runs with `--max-warnings=0`. The CI `frontend` job stops at lint, so its Jest and build steps never run. Fix: `// eslint-disable-next-line no-script-url`, or build the string.

### 17. `fix-upstream-resilience` (frontend + backend) (⏳)

Two bullets below moved to 22 (`harden-security-3`): the `session_id` log leak and the rating-sync ERROR traceback for users with no TMDB link. The rest stays here.

- **[med] ✔ A failed infinite-scroll page retries in a loop.** `usePaginatedFetch.ts:137-158` + `useInfiniteScroll.ts:26-41`.
  - `loadMore` depends on `loadingMore`, so its identity changes in `finally`. The observer effect then re-`observe()`s the sentinel, and IntersectionObserver always fires once on `observe()`.
  - After a failure no items were added, so the sentinel is still in view and `loadMore` runs again at once. PeoplePage/SearchPage also have `!loadingMore` in `enabled`.
  - Scenario: Movies/TV/Anime/People/Search, next page fails (offline, 429 from `TmdbProxyThrottle`, 502 while TMDB is down). The page re-requests continuously, and while TMDB is down each try holds a gunicorn worker for up to `WORST_CASE_SECONDS`. The comment at `:153` ("the next scroll can try again") is wrong.
  - Fix: stop auto-loading after an error until a user action (a "Load more / Retry" button), or back off.
- **[med] A permanent TMDB 404 counts as a failure, which can freeze a user's recommendations.** `recommendations.py:111-114` (`_fetch_media_details`) and `:343-345` (`fetch_similar`) call `health.mark_failed()` on any `RequestException`, 404 included.
  - `_store_media_cache` stores nothing, so the 404 repeats every run. `metadata_backfill.fetch_entry_metadata` (`:196-198`) already treats a 404 as settled, so the two paths disagree.
  - Scenario: one deleted/merged TMDB title in Watched. Every refresh is then "failed", and `save_recommendations` (`:588-597`) discards any result with fewer non-empty sections, e.g. after the user deletes history or KMeans merges clusters. `computed_at` never advances, so every For You visit starts a full recompute and polls 20×3s.
  - Fix: treat a 404 as settled, not failed.
- **[med] ✔ The TMDB `session_id` is written to logs.** `ratings_views.py:28,72` `logger.exception` around `tmdb_client.post_rating`/`delete_rating`, which pass `session_id` as a query param (`tmdb_client.py:123-137`). `raise_for_status` puts the full URL in the message, and `RedactingFormatter` (`logging.py`) only strips `TMDB_API_KEY`.
  - A client-sent `session_id` on `/api/tmdb/...` also reaches `tmdb_proxy`'s `logger.exception` (`tmdb_proxy_views.py:68`).
  - Fix: redact `session_id=` values in `RedactingFormatter`.
- **[low-med] Two endpoints have no time budget and can outlive gunicorn's 30s.** Found independently by two passes.
  - `social_views.py:326` `followed_people_recommendations` calls `_fetch_followed_people_credits(user, limit=10)` without `budget_seconds`. 10 cold fetches on 5 workers with `timeout=10` (connect + read) gives about 40s worst case.
  - `stats_views.py:22-30` makes two sequential `get_genre_names` calls when the per-process genre cache is cold, also about 40s.
  - Notifications got a budget in item 12 (B4); these siblings didn't.
- **[low] Every rating by a user without a TMDB link logs an ERROR traceback.** `ratings_views.py:24-28,68-72`: `user.tmdb_profile` raises `RelatedObjectDoesNotExist` and hits the same `logger.exception`. Floods logs and hides real sync failures.
- **[low] A finishing refresh clears another worker's "refreshing" stamp.** `recommendations.py:560,573`: `_set_refreshing_since(None, only_before=finished_at)` also clears a stamp another gunicorn worker set during this run, against its own comment. The next poll then gets `"ready"` with the older result. Fix: clear only stamps `<=` the one this run set.
- **[low] A metadata-backfill failure inside `_compute_personalized` doesn't mark `FetchHealth`.** `recommendations.py:439` → `backfill_entries` swallows failures, so genre-less entries are clustered and the result is saved as good for 12h.
- **[low] A followed person who always 404s is refetched on every notifications poll.** `social_views.py:131-143`: failures aren't cached, and `to_fetch[:max_fetch]` is in followed order, so enough of them starve the people after them.

### 18. `fix-account-edges` (frontend + backend) (⏳)

- **[med] ✔ Users without an email can't save any profile edit.** `serializers.py:63`: `UserProfileUpdateSerializer.email` is an `EmailField` with the default `allow_blank=False`, but registration allows a blank email and `ProfileModal.tsx` always sends `email: user?.email ?? ""`. Every save, password change included, is a 400 `"This field may not be blank."`. No user can clear their email either. Repro'd against the test DB.
- **[low-med] One imported `watchedAt` near year 1 makes `/api/stats/` 500 permanently.** `BulkWatchedEntrySerializer` (`serializers.py:230,250`) accepts any past timestamp; `entry_local` (`timezones.py:388`) raises `OverflowError` in `astimezone`. Repro: bulk-import `"0001-01-01T00:00:00Z"` with a zone behind UTC → `stats 500`. Fix: a lower bound in `_past_timestamp`, or guard `entry_local`.
- **[low-med] A response that lands after logout puts the previous account's data back.** `useNotifications.ts:14-40` and the library hooks' `reload`/`fetchLists` (`useWatched.ts:20-50`, `useWatchlist.ts:20-47`, `useRatings.ts:18-47`, `useLists.ts:142-156`) have no generation/cancel guard.
  - Scenario: A logs out during the slow first notifications poll, B signs in in the same tab, and B's bell shows A's badge and items (which reveal whom A follows). If B's own library load fails, the hooks keep A's data. `hasError` is also never reset on logout.
  - Fix: a per-auth generation checked before every `set*`, as `FollowedPeopleProvider` does.
- **[med] ProfileModal keeps typed passwords and unsaved edits between openings.** `ProfileModal.tsx:53,214-222`: the `useForm` instance outlives the destroyed modal body, and rc-field-form's `setInitialValues` merges the store over the initial values. Only `deletePassword`/`newPassword` state is reset.
- **[med] "Export All Data (ZIP)" can save an incomplete backup.** `ProfileModal.tsx:326` exports whatever the contexts hold without checking their `error`/`isLoading`, and `downloadAllAsZip` isn't awaited or caught. A failed watched load gives a backup with no watched history and no warning.
- **[low] Smaller items:**
  - `ProfileModal.tsx:120,133`: TMDB connect/disconnect errors use fixed strings instead of `getApiError`.
  - `userApi.ts:97`: `forceLogout`'s hard redirect to `/login` loses the page the user was on.

### 19. `fix-detail-and-nav` (frontend) (⏳)

- **[med] ✔ A stray `0` renders on detail pages.** `MovieDetails.tsx:193` `{runtime && …}`, `TVShowDetails.tsx:192,197` `{number_of_seasons && …}`/`{number_of_episodes && …}`. TMDB returns `runtime: 0` for many unreleased films.
- **[med] ✔ Browse cards aren't links.** `Movie.tsx:38`, `TVShowCard.tsx:37` are `motion.div onClick` with no poster `CardLink`, on the main grids of /movies, /tv and /anime: no href, no Ctrl/middle-click, no Tab stop. CLAUDE.md says no CardLink exceptions are left. Also `HeroBanner.tsx:98` "View Details" (a `navigate` button) and `NotificationBell.tsx:83` items (`role="button"` divs).
- **[med] Following → detail → Back lands on For You.** `RecommendationsPage.tsx:50,54` (`RecCard`) hardcodes `{ from: "/recommendations" }`, and `FollowingPage.tsx:126` reuses `SectionRow`/`RecCard`.
- **[med] Person pages show only acting credits.** `PersonPage.tsx:126-161` uses only `.cast`, ignoring `.crew`, and keeps TMDB's raw order. A director's page shows cameos or "No credits available". (Open decision above.)
- **[med] TV Hours Watched counts one episode per series.** `MarkWatchedModal.tsx:51-53` uses `episode_run_time?.[0]` (often empty on newer shows), and the runtime input is disabled (`:100`). (Open decision above.)
- **[low-med] A providers failure throws away the runtime.** `MarkWatchedModal.tsx:58-71`: both requests share one `Promise.all` with `.catch(() => {})`.
- **[low-med] "Where to Watch" can be empty or misleading.** `WatchProviders.tsx:12,44-45`: `buy` is never rendered, so a buy-only entry shows a header over nothing. A failed fetch becomes `{}` and says "No watch provider info for your region", but the region is hardcoded to US.
- **[low] Smaller items:**
  - `FollowingPage.tsx:50`: the recs effect depends on `followed.length`, so follow one + unfollow another never refetches.
  - `PersonPage.tsx:222-240`: the Follow button ignores `useFollowedPeople().error`, unlike `PersonCard` (CLAUDE.md requires it).
  - `AddToListModal.tsx:23-24`: search and new-name text survive closing; while lists load or fail it says "No lists yet".
  - `CSVUploadModal.tsx:19-31`: templates advertise `runtime`/`language`/`release_year` columns that the import ignores.
  - `usePaginatedFetch.ts:99`: multi-page Back-restore `flatMap`s pages without the id dedupe `loadMore` does, so a title that moved between pages renders twice (duplicate React keys).
  - `useNotifications.ts:42-50`: a poll already in flight lands after `markSeen` and brings the badge back for up to 3 min.
  - `useRecentSearches`: the Sidebar and BottomNav `SearchBox` copies keep separate in-memory lists (`storage` events don't fire in the writing tab), so one overwrites the other's recents.
  - `WatchlistPage.tsx:62-71,197`: the saved scroll position is restored on any later visit, not only on Back. (Plausible.)
  - `HeroBanner.tsx:36-38`: Anime hero filters on genre 16 (Animation), so a Pixar film can show, and it falls back to `results[0]`. The hero `<img>` is `loading="lazy"`.
  - `TMDBCallbackPage.tsx:39`: antd 5 ignores `<Spin tip>` unless nested/fullscreen, so the text never shows.
  - `export.ts:240-249`: CSVs have no UTF-8 BOM, so Excel on Windows garbles non-ASCII titles. `parseCSV` already strips a BOM, so adding one round-trips safely.

### 20. `fix-stats-math` (backend + frontend) (⏳)

- **[low] Half-step ratings fall into uneven buckets.** `stats_views.py:50-52` uses `round(r)` (banker's rounding): 6.5 → 6 but 7.5 → 8, and 1.5 and 2.5 both → 2.
- **[low] The monthly chart skips months with no watches.** `stats_views.py:55-64` emits only months with entries, and `StatsPage.tsx:515` plots them on a category axis, so Jan and Jun look adjacent.
- **[low] Average TMDB rating counts unknown scores as 0.** `stats_views.py:77-79` averages every `vote_average`, including the `0` stored for a null CSV value or an unreleased title.
- **[low] Followed-people sections drop a TV show that shares an id with a movie.** `social_views.py:343-347` dedupes on the bare id, while notifications key on `(id, type)`.
- **[low] Stats page labels:** the Rating-by-Genre tooltip reads "7.3 avgRating" (`StatsPage.tsx:571`, raw dataKey); the heatmap tooltip shows raw `yyyy-mm-dd` instead of `formatDateDMY` (`:225`); heatmap cells are mouse-only; the Top Genres empty text (`:556-557`) still says to visit For You, though `stats_views.py` backfills itself.
- **[low] A backup restore loses list dates and order.** `UserListItem.added_at`/`UserList.created_at` are `auto_now_add` (`models.py:71,84`), and `CSVImportAllModal.tsx:115-118` restores items one POST at a time in parallel batches of 20, so items get restore-time dates and a scrambled newest-first order. With one request per item, a few thousand list items in a day also use up the `5000/day` user throttle for the whole app.

### 21. `harden-ci-2` + polish (⏳)

- **[low-med] Nothing tests `fetchAllPages` past page 1.** `src/utils/fetchAllPages.ts` has no unit test, and every `paginated()` mock hardcodes `next: null` (`e2e/fixtures.ts:24`, `e2e/python/conftest.py:275-281`). A page-following regression would silently cut every library over 100 items.
- **[low-med] CI Playwright retries hide flaky tests.** `playwright.config.ts:9` `retries: process.env.CI ? 2 : 0`, against `openspec/specs/ci-pipeline` ("CI SHALL fail when any test … fails"). The Python e2e job has none.
- **[low] nginx sends uncompressed responses.** `nginx.conf` has no `gzip`, so the 1.5MB `main.*.js` goes raw. Hashed `/static/` assets also get no long-lived `Cache-Control`.
- **[low] CI gaps:** no job builds the Docker images; `eslint src` skips `e2e/*.ts`; Jest runs with `--passWithNoTests`; Playwright browsers aren't cached; no `concurrency` cancel group; ruff `target-version = "py311"` while everything runs 3.12.
- **[low] Flaky wait:** `e2e/responsive.spec.ts:113` asserts the popup position after a fixed `waitForTimeout(200)`.
- **[low] Hardcoded colors** (CLAUDE.md "Shared UI constants"):
  - `"#000000"` light-theme icons: `Movie.tsx:73,95`, `TVShowCard.tsx:72,94`, `MovieDetails.tsx:167`, `TVShowDetails.tsx:166`, `SearchPage.tsx:233,358`, `WatchlistPage.tsx:226`, `RecommendationsPage.tsx:84,106`.
  - `"#1677ff"` in Movie/TVShowCard/RecommendationsPage.
  - `"#aaa"` in Movies.tsx, TVShows.tsx, `CalendarPage:286`, `RecommendationsPage:402,420`, `SearchPage:481`, `WatchlistPage.tsx:283` (low contrast in light mode).
  - `PosterPlaceholder.tsx:19-20` uses the same dark colors in both themes; `StatsPage.tsx:179-182` `heatColor` greens.
  - Also `BottomNav.tsx:264` `fontSize: 10` on avatar initials.
- **[low] Docs drift:**
  - `docs/ARCHITECTURE.md:62` says RecommendationsPage persists sort (it has none) and ListsPage persists the selected list id (it persists `useLibraryFilters` filters under `keyPrefix: "lists"`).
  - CLAUDE.md says `playwright-core` is a devDependency; it's only transitive via `@playwright/test`.
  - `CORS_ALLOWED_ORIGINS` (`settings.py:140`) is missing from `backend/.env.example` and README's env table.
  - `start.py:19` reads only `DB_PASSWORD`, while `settings.py:106` also falls back to `POSTGRES_PASSWORD`.
  - Mojibake (`â€”`) in `settings.py:21,170` comments.
- **[info] Dependencies:** `npm audit --omit=dev` shows 72 advisories, almost all `react-scripts` build tooling. The only runtime one (react-router 6.30.6 backslash open redirect) isn't reachable: `navigate()` targets come only from `location.state`. The local Anaconda env again drifts from `constraints.txt` (pyjwt, urllib3, tzdata, …); `test_dependency_versions.py` checks only Django and ruff.

## Fourth round (2026-10-09): items 22–25 and additions to 17/20/21

Same-day follow-up to the third audit, cross-cutting rather than per-layer (see Sources). ✔ = re-checked by hand. "2×" = found independently by two passes. Suggested order: **22 → 23 → 24 → 25**, slotting 22 right after 16. The live-run pass's findings are under "Live run" below (they belong with 25).

**Open decisions:**
- **(22)** Hide whether an email has an account? Registration says "An account with this email already exists", while password reset deliberately doesn't. Either accept the leak (document it) or give a generic signup error / email confirmation.
- **(24)** Backup format v3: add `followed.csv` and `episode_progress.csv` (needs a list endpoint for progress), or keep v2 and say in the export UI what's not included. The `data-backup` spec ("A backup contains the whole library") must match whichever is chosen.
- **(23)** Should a rating change trigger a recommendations refresh (it weights seeds, loved genres and KMeans), or is the 12h TTL acceptable?

### 22. `harden-security-3` (backend + nginx) (✅ archived 2026-10-09)

See `openspec/changes/archive/2026-10-09-harden-security-3/`. All items below are fixed (specs synced into account-security, api-hardening, title-metadata, input-validation, avatar-upload, container-deployment and data-backup). Adds migration 0022 (`WatchedEntry.metadata_settled`). Unverified until the first Docker deploy: `nginx -t` on the new `log_format`/`map`s. Proposed 2026-10-09. Also takes two bullets from 17: `session_id` in logs and the rating-sync ERROR traceback for users with no TMDB link. Decided: keep the registration "email exists" message (accepted, documented); add a per-username login failure limit; no library-size caps, cap backfill runs only.

- **[med] ✔ The TMDB connect callback can be forged (login CSRF).** `tmdb_views.py:18-53`, `TMDBCallbackPage.tsx:17-26`. `tmdb_request_token` doesn't record which user asked for the token, and `tmdb_create_session` accepts any `request_token` from any signed-in user; there is no state/nonce.
  - Attack: the attacker gets a token from `/api/tmdb-auth/request-token/`, approves it on themoviedb.org in their own TMDB account, and sends a signed-in victim `/tmdb-callback?request_token=<T>&approved=true`. The victim's profile now holds the attacker's TMDB session, and `_sync_rating_to_tmdb` sends every later rating to an account the attacker reads.
  - `create_session` also overwrites an existing `session_id` without revoking it (sibling of T2), so the victim's real session stays live on TMDB.
  - Fix: store the issued token per user with a short TTL, accept it only once, and revoke the previous session before replacing it.
- **[med] Bulk imports of fake ids amplify into TMDB calls and unbounded memory.** `bulk_watched` (500 entries/request, any `mediaId` up to 2³¹) → `stats_views.py:88` `request_backfill` → `metadata_backfill.py:98-132` fetches every genre-less entry with no per-user cap, on the server's API key and outside `TmdbProxyThrottle`. Every 404 adds a pk to the module-level `_settled` set and every failure to `_failed_at` (`:33-37`); neither is ever trimmed.
  - Scenario: one account imports random ids and opens Stats; each 500-row request costs about 500 TMDB calls, pushing the server's single IP toward TMDB's rate limit (then every user's proxy calls 429), and each worker's sets grow without bound. `stats_views.py:38` also loads all rows into memory.
  - The `title-metadata` spec says an unfillable title "SHALL NOT be fetched again", but `_settled` is per process, so every worker and every restart refetches it. Persisting a settled marker fixes both.
  - Fix: cap entries per backfill run and per user; bound or persist `_settled`/`_failed_at`.
- **[low-med] Reviews and list descriptions have no length limit.** `RatingEntry.review` and `UserList.description` are `TextField` (`models.py:57,70`), and `RatingEntrySerializer` (`serializers.py:197`), `BulkRatingEntrySerializer.review` (`:265`) and `UserListSerializer` restate no `max_length`; only nginx's 8 MB body cap applies. About 100 reviews of 8 MB make one `GET /ratings/` page load ~800 MB into a sync worker; `GET /lists/` nests every item. A crafted backup ZIP can do this to the victim's own account. Fix: e.g. 10k for reviews, 2k for descriptions, on the models or serializers and the bulk serializer.
- **[low-med] The password-reset token ends up in nginx access logs.** The link is the GET path `/reset-password/<uid>/<token>` (`auth_views.py:153`), and `nginx.conf` sets no `access_log`, so the `nginx:alpine` default logs the full URI to `docker logs`; the token stays valid for an hour. Same for `/tmdb-callback?request_token=…` (lower risk). Related: `EMAIL_BACKEND` defaults to the console backend (`settings.py:212`), so a deploy that forgets it prints live reset links to stdout. Fix: a `log_format` without the path for `/reset-password/` (no `add_header` in that location), or move the token into the URL fragment.
- **[low] Avatars keep their EXIF data (GPS, camera serial).** `auth_views.py:370-400` only `verify()`s and saves the original bytes, and `/media/` is public. Fix: re-encode or strip EXIF.
- **[low] Registration reveals whether an email has an account** (`RegisterSerializer.validate_email`), which undoes the care in password reset. `password_reset_request` also calls `send_mail` synchronously only for registered emails, a timing oracle. (Open decision above.)
- **[low] Login is limited per IP only.** `LoginThrottle` is 10/min by IP, with no per-username failure counter, so distributed guessing against one account is unlimited.
- **[info] The client-side backup import has no ZIP size cap** (`CSVImportAllModal.tsx:84`, `backup.ts:110-112`). A zip bomb only crashes the importing tab.
- **Design note (not a defect):** `/api/tmdb/<path>` is `AllowAny` with 3 sync gunicorn workers, so a few anonymous IPs at 120/min each can keep every worker busy and use up the server's TMDB per-IP limit. It's the accepted public-proxy design, but it's the main unauthenticated availability risk.

### 23. `fix-recs-correctness` (backend + frontend) (⏳)

- **[med] ✔ For You mixes movie and TV genre ids.** `recommendations.py:287-297` (`discover_mixed`) sends one genre id to both `/discover/movie` and `/discover/tv`, and `genre_count`, `loved_genre_count` and the KMeans vocabulary (`:437-491`) pool movie and TV genres in one id space. TMDB genre ids are type-specific (Action 28 is movie-only; Action & Adventure 10759 is TV-only).
  - "More like what you love" / "Based on your taste" lose half of each mixed section.
  - `tmdb_client.discover` joins ids with `,` (`tmdb_client.py:46`), which TMDB treats as AND, so a KMeans cluster like `[28, 10759]` returns nothing from either endpoint and the section is dropped.
  - Stats (`stats_views.py:66-75`) shows "Action" and "Action & Adventure" as separate top genres.
  - This is the backend version of item 4's frontend fix. Fix: map ids per media type (as `genresFor()` does) or keep separate vocabularies.
- **[med] ✔ A For You poll that gives up is cached as complete.** `RecommendationsPage.tsx:271-292`: after `MAX_POLLS = 20` with status still `"pending"`, the `else` branch calls `setComputingFlag(false)`, so the unmount save stores `complete: true`, and `hasFetched` (`:234`) skips fetching on return. Partial groups are shown as final, against `view-state-restore` "Incomplete recommendations are not cached as final". Also when returning to an incomplete snapshot and leaving before the first response.
- **[low-med] Ratings never trigger a recommendations refresh.** `signals.py:130-141` covers only `WatchedEntry`, and `ratings_views.py` doesn't call `schedule_refresh`. Ratings drive "More like what you love" (≥7), the "Because you watched" seed order and KMeans weights, so a change waits up to 12h. On a backup restore, watched is imported first and its refresh reads `RatingEntry` (`recommendations.py:207`) before the ratings bulk request commits, so a restored account has no "loved" section for 12h. `by_recency` (`:256-261`) can also seed "Because you watched X" from a title rated 1/10. (Open decision above.)
- **[low-med] Every watched toggle on For You re-runs the whole fetch and poll.** `RecommendationsPage.tsx:261-310` depends on `watchedList.length`, and its cleanup resets `hasFetched.current`. Marking a card refetches all three groups (including the TMDB-heavy followed-people call) and restarts polling; sections reshuffle. On a cache-hit mount the effect returns early, so the same action does nothing there.

### 24. `fix-import-export-2` (frontend + backend) (⏳)

- **[med] 2× "Export All Data" omits followed people and episode progress.** `backup.ts:44-102` writes only watchlist, watched, ratings and lists. There's no list endpoint for episode progress (`social_views.py:22` is per show). Export → delete account → re-register → import loses every follow (so all notifications and followed-people sections) and every SxxEyy position, with no notice. (Open decision above.)
- **[med] ✔ CSV imports hit `TmdbProxyThrottle` and silently drop posters.** `CSVUploadModal.tsx:79-93` and `CSVListImportModal.tsx:72-86` fetch a poster for every row, 20 at a time; `CSVImportAllModal.tsx:25-40` does the same for rows with no poster. The proxy allows `120/min` per user (`settings.py:163`), `tmdb.ts` doesn't retry a 429, and `catch {}` swallows it. A 300-row import saves ~180 rows with `posterPath: null` and `voteAverage` 0 (also dragging the Stats average down), the toast says "Import complete", and other browsing 429s for a minute. Fix: pace to the throttle, or treat a 429 as retry-later.
- **[low-med] 2× Re-importing the Watched page's own CSV loses every date and zone.** `WatchedPage.tsx:84-93` exports `watched_at`/`watched_tz`, but `CSVUploadModal.tsx:94-104` reads it with `parseCSVForImport` (`csvParse.ts:120-162`), which keeps only id, title and type. Every row becomes "now", so Monthly, heatmap, Recently watched and the Watched sort all show the history as watched today. Breaks `data-backup` "Watched exports keep the logged time zone". Fix: read `watched_at`/`watched_tz` when present, as `parseBackupCSV` does.
- **[low-med] Lists that share a name merge on restore.** `CSVImportAllModal.tsx:98-109`: `idByName` finds the first list (already created in this run), so the second "Favorites" list's items go into it and its description is dropped. Duplicate React key at `:270` (`key={l.name}`). Fix: match by name only against lists that existed before the import.
- **[low-med] A reload failure after a successful import is reported as an import failure.** `CSVUploadModal.tsx:105` awaits `reloadWatched()` inside the same `try` as `bulkImport`, so the user sees "Failed to import" without the added/skipped counts, though the rows were saved. `CSVImportAllModal.tsx:190` instead discards its reload `allSettled` result and says "Import complete". (`load-states` "Background refresh fails after a successful load" is silent app-wide.)
- **[low] `bulk_import` counts rows lost to a concurrent create as added** (`bulk_import.py:74-76`, `added = len(to_create)` under `ignore_conflicts=True`). Known race, acknowledged in a comment; the `data-backup` spec says counts match what was created.

### 25. `fix-write-guards-2` (frontend + backend) (⏳)

- **[low-med] A failed episode-progress load looks like "no progress", and saving then overwrites the real progress.** `useEpisodeProgress.ts:18-20` (`.catch(() => setProgress(null))`) → `TVShowDetails.tsx:322-335` shows "Track episode progress", the editor starts at S1E1, and Save `update_or_create`s over the stored position. Breaks the `surface-failures` rule. Fix: an `error` state with Retry, and hide "Track" while it's set.
- **[low-med] Episode progress has no in-flight guard.** `useEpisodeProgress.ts:27-38` has no `createInflight` slot, and "Next Episode →" (`TVShowDetails.tsx:258-266`) and Save (`:309-321`) stay enabled, so a double-click sends two PUTs (`write-feedback` "At most one in-flight write per item", CLAUDE.md).
- **[low-med] A review-only edit still pushes the rating to TMDB.** `useRatings.set` always POSTs `/ratings/` (`useRatings.ts:68`), which runs `update_or_create` plus `_sync_rating_to_tmdb` unconditionally (`ratings_views.py:41-53`) and re-stamps `rated_at`. The backend PATCH conforms to `ratings` "Edit only the review", but the frontend never uses it.
- **[low-med] Detail-page Back does nothing in a tab opened from a card link.** `MovieDetails.tsx:113`, `TVShowDetails.tsx:112` and `PersonPage.tsx` use `from ? navigate(from) : navigate(-1)`; in a new tab (`CardLink` Ctrl/middle-click, no `from`) `history.go(-1)` is a no-op, and from an external referrer Back leaves the app. Fix: fall back to a default route when `window.history.state?.idx === 0`.
- **[low] The rating dialog can be closed mid-save.** `RatingModal.tsx:45` `onCancel={onClose}` ignores `busy`, so Cancel/X/mask click closes it and the save result is never shown (`write-feedback` "dialog stays open while saving").
- **[low] FilterPanel shows unapplied edits as active.** `FilterPanel.tsx:72-73` seeds the draft `filters`/`sortBy` only on mount or scope change, so change year/sort, close with X, reopen: the drawer shows the unapplied values while the grid uses the old ones. Genre chips apply immediately while other fields wait for Apply.
- **[low] Follow/unfollow doesn't refresh notifications, and notifications include watched titles.** `useNotifications.ts:31-40` polls every 3 min, and `FollowedPeopleContext.follow`/`unfollow` don't trigger it. `notifications_views.py:44-71` doesn't exclude watched titles, while followed-people recommendations do (`social_views.py:175-188`).
- **[low] Local order disagrees with the server after a create/follow.** `useLists.ts:62` appends a new list (API: `-created_at`), and `FollowedPeopleContext.tsx:84` appends a new follow (API: `-followed_at`), so the new item lands last until a reload.
- **[low] Email uniqueness is only a serializer check** (`serializers.py:72-81`), with no DB constraint, and `update_profile` catches `IntegrityError` only for usernames, so two concurrent email changes can race (same pattern item 1 fixed for usernames). Medium confidence, not reproduced.
- **[low] Smaller items:**
  - `WatchProviders.tsx:16,25`: TMDB's `us.link` is used as an `href` without `safeHttpUrl` (`untrusted-content`). Low real risk: TMDB-generated, and the CSP blocks script URLs.
  - `BottomNav.tsx:236-278`: the phone drawer's profile button has no `aria-label`, so it's announced as the initials plus the name, not "Edit profile" (`accessibility`).
  - `LoginPage.tsx:34`: the password refocus runs in `setTimeout(0)` while the field may still be `disabled={loading}`. Low confidence, not reproduced.

### Live run (fourth round, fifth pass)

First live check of the app in this audit series: `npm run dev` + headless Chromium via Python Playwright, two throwaway accounts (both deleted afterwards). It confirmed in the running app several items already listed (18 blank-email profile 400, 18 ProfileModal stale edits, 18 re-login lands on /movies, 17 rating-sync traceback, 24 backup omits follows/progress, 19 TV runtime empty, 19 browse cards not links). New:

- **[med] ✔ People page: browser Back loses the loaded pages and scroll.** `PeoplePage.tsx:46-55` `handlePersonClick` calls `navigate(...)` with restore state but never `stashReturnState(...)` first (only `HomePage.tsx:148` and `AnimePage.tsx:158` do), against CLAUDE.md's browse-filters rule. Observed: 80 cards at `scrollY` 1200 → person → browser Back → 20 cards at `scrollY` 0; the in-app Back button restores correctly. Also affects phone swipe-back and Alt+Left. Belongs with 25.
- **[low] Applying a genre filter fetches the same discover page twice**, about 340 ms apart (not StrictMode, whose replays are synchronous). The chip applies at once, then Apply sets a new `activeFilters` object, which changes `HomePage`'s `fetchPage` identity and makes `usePaginatedFetch` reload an unchanged query: one wasted TMDB call against `TmdbProxyThrottle` and a second grid clear. Fold into 25's FilterPanel bullet.
- **[low] An open Tooltip covers the Popconfirm's OK button on library cards.** `WatchedPage.tsx:217-240` (and likely `ListDetailPage.tsx:243-265`, `WatchlistPage.tsx:255-278`): while the pointer stays on the "Mark unwatched" icon, its Tooltip sits over the Popconfirm's "Mark Unwatched" button and intercepts clicks. Mostly visual for a mouse, but it can block touch flows. Fix: hide the tooltip while the Popconfirm is open. Belongs with 25.

Checked clean in the live run: no horizontal overflow on 18 routes at 375/820/1366 in both themes, including the phone drawers and modals; sidebar `scrollHeight == clientHeight` at 1366×768 and in the 820 rail; no app console errors; Movies/TV/Anime/Search/Calendar restore on both kinds of Back; every detail-page write, list, follow, notifications, Stats, iCal and ZIP export flow works; token-refresh recovery and auth redirects behave; every other duplicate request was a StrictMode dev-only pair.

### Additions to earlier items (fourth round)

- **17 (`fix-upstream-resilience`):**
  - **[low-med] A person-credits 404 also freezes recommendations.** `recommendations.py:382-394` (`fetch_actor_credits`) calls `health.mark_failed()` on any `RequestException`. Actor ids come from `TMDBMediaCache.top_cast` (up to 7 days old), so a merged/deleted person keeps 404ing. The item-17 404 fix must cover this site too.
  - **[low-med, plausible] urllib3 applies the connect timeout per resolved IP**, and `api.tmdb.org` resolves to 4 addresses. If TMDB drops SYNs, one proxy attempt is about 4×3.05s and three attempts about 37s, above gunicorn's 30s, while `WORST_CASE_SECONDS` (21.65s, `tmdb_proxy_views.py:31-45`) doesn't model it. One `tmdb_client` call (`timeout=10`) can take ~50s, so the rating views (`ratings_views.py:26,70`), `tmdb_views.py:25,45,75` and `delete_account` (`auth_views.py:269`) can be killed. With no `ATOMIC_REQUESTS`, a rating is saved but the client gets a 502; `delete_account` revokes the TMDB session before `user.delete()`, so the account isn't deleted. Fix: a wall-clock deadline around the whole call, and move rating sync and session revoke out of the request path.
- **20 (`fix-stats-math`):**
  - **[low] More banker's rounding.** `stats_views.py:47` (`avgUserRating`) and `:136` (`avgRating`) use `round(x, 1)` on half-step averages (7.25 → 7.2). Fixing with `Decimal`/`ROUND_HALF_UP` covers all three sites.
  - **[low-med] `CSVListImportModal` also adds list items one POST each** (`CSVListImportModal.tsx:89-101`, 20 in parallel), with the same `auto_now_add` order scrambling and `5000/day` throttle use as the backup restore.
- **21 (`harden-ci-2` + polish):**
  - **Test gaps from the spec conformance check:** no import modal has a UI test (nothing in `e2e/` calls `setInputFiles`; add `e2e/import.spec.ts` with a ZIP fixture for "One section fails", "New list in backup", "Import twice", "Re-select same file", the mixed-file preview); "Leave mid-computation" (`view-state-restore`); rating remove / "Unrated title has no remove"; "Mark as watched fails"; episode-progress save fails; a background-reload failure notice; library-filters "Two lists" and "Unmark the last item on the last page"; password focus after failed login; phone-drawer account controls; fail-closed on the default `SECRET_KEY`; key redaction with DEBUG on; Anime "Airing Today" date params; media-type switch drops `with_genres`; all four `theme-readability` scenarios; `service-health` warm-up hang/non-zero exit; `container-deployment` static checks (HSTS only over HTTPS, db gets only `.env.db`, `backend/.dockerignore`); `app-identity` manifest/meta; a signed-out unknown path that lands on not-found after sign-in.
  - **`e2e/python/test_ratings.py:115,124`** still branch on `rate_btn.count() == 0` (non-waiting); the assertion still runs, but it violates the `e2e-fixtures` rule.
  - **`api-hardening` says the proxy forwards params "in the same order"**, but `tmdb_proxy_views.py:62` iterates `request.GET.lists()` (grouped by key). TMDB doesn't care: relax the wording or forward the raw query string.
  - **Docs drift:** ~~CLAUDE.md says `TRUSTED_PROXY_COUNT` "defaults to 1", but `settings.py:173` defaults to 0 and only `docker-compose.yml:36` sets 1.~~ (fixed in 0.21.0) The `browseFilters.ts:37-40` comment says genres reset "in an effect" as the general reset; `App.tsx:46-63` resets filters and sort during render. `public/index.html:14` `<title>CineDB</title>` vs "CINE DB" in the manifest and `app-identity`.

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
