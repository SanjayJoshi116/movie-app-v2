# Bug Backlog

The working list of known bugs, grouped into planned OpenSpec changes. Sources:
- the 2026-10-03 full audit (against 0.15.8)
- a 2026-10-05 re-check of that audit, plus a review of the uncommitted diff and fresh frontend and backend bug hunts
- a 2026-10-07 second full audit (items 11–15). It had four read-only passes (backend, frontend, infra, tests+docs), and every finding was re-checked against the code. Follow-up "sibling hunts" searched the code for more instances of each bug's pattern. Their findings are tagged N (round 1), R (round 2: leaks, DB, error text, transactions), S (round 3: untrusted data, route params, pagination, a11y) and T (round 4: multi-worker state, account/credential lifecycle, endpoint fuzz).
- a 2026-10-09 third full audit (items 16–21) against 0.20.0 (`b3a5930`). Five read-only passes (backend API, backend upstream/background, frontend state, frontend pages, infra/CI/tests/docs). Items marked ✔ were re-checked against the code by hand; the rest rest on each pass's code trace or repro.
- a 2026-10-09 fourth round (items 22–25, plus additions to 17, 20 and 21), same day, cross-cutting instead of per-layer: a sibling hunt for the third audit's patterns, cross-feature data flows, an adversarial security pass, and a spec-vs-code conformance check of all 29 `openspec/specs`. A live Playwright run of the app was the fifth pass.
- a 2026-10-13 fifth audit (items 27–34) against 0.24.0 (`11b8c84`)
- a 2026-10-15 sixth audit (items 35–41) against 0.26.0 (`5155a4d`). One read-only pass over the whole tree, backend, infra, frontend and tests/docs, with three findings checked against live TMDB responses (marked "✔ live").
- a 2026-10-26 `/security-review` of the whole tree at 0.30.0 (`36e590a`): one read-only pass, no findings (see "Twelfth review" below)
- a 2026-10-28 `/code-review` of the database layer (models, migrations, and the code that reads and writes them) at 0.30.0 plus uncommitted `merge-media-cards`: item 48 (see "Thirteenth review" below)
- a 2026-10-30 look at CI's run history (the last three pushes cancelled) and a full local TypeScript e2e run: item 49 (see "CI check" below)

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
| 17 | `fix-upstream-resilience` | ✅ 2026-10-12 | Infinite-scroll retry loop; TMDB 404 freezes recs; missing time budgets; refresh stamp race; unmarked backfill failures |
| 18 | `fix-account-edges` | ✅ 2026-10-12 | Blank-email profile 400; year-1 date breaks Stats; logout response race; Profile stale fields/partial export |
| 19 | `fix-detail-and-nav` | ✅ 2026-10-12 | Stray `0`; browse cards not links; Following Back target; crew credits; providers/runtime |
| 20 | `fix-stats-math` | ✅ 2026-10-13 | Banker's rounding buckets, skipped months, 0-score average, tooltip labels |
| 21a | `harden-ci-2` | ✅ 2026-10-13 | Playwright retries, e2e lint, Jest no-tests pass, Docker build + nginx smoke job, gzip/cache, flaky waits, app-level pagination test |
| 21b | `polish-colors-docs` | ✅ 2026-10-13 | Hex sweep, docs drift, proxy param-order wording |
| 21c | `spec-test-gaps` | ✅ 2026-10-13 | Missing tests from the spec conformance check (import modals, theme-readability, container checks, …) |
| 22 | `harden-security-3` | ✅ 2026-10-09 | Forgeable TMDB connect; import-driven TMDB amplification; unbounded review/description; reset token in nginx logs |
| 23 | `fix-recs-correctness` | ✅ 2026-10-13 | Movie/TV genre ids mixed in For You; ratings never refresh recs; gave-up poll cached as complete |
| 24 | `fix-import-export-2` | ✅ 2026-10-13 | Backup omits follows/episode progress; same-name lists merge; Watched CSV loses dates; import posters throttled |
| 25 | `fix-write-guards-2` | ✅ 2026-10-13 | Episode progress load error → overwrite; review-only edit syncs TMDB; dialogs closable mid-save; stale panels |
| 26 | `speed-up-pages` | ✅ 2026-10-10 | Every page slow: `localhost` IPv6 fallback (~300 ms/connection in dev), preflight on every call, sequential library pages, per-request DB connect, uncached TMDB proxy, 5–6 calls per detail page, `original` backdrops, eager trailers |
| 27 | `bound-tmdb-calls` | ✅ 2026-10-14 | TMDB calls have no wall-clock deadline (per-IP connect timeout breaks the proxy budget); rating sync and TMDB session revoke still run in the request (leftover from 17); TMDB connect can take ~40s and store a revoked session |
| 28a | `bound-rec-refresh` | ✅ 2026-10-14 | Recommendations under load: refused refresh retried on every poll; uncapped media-cache fill; backfill cap bypass (no per-user budget); warm-up order; unbounded refresh threads; thread-start failure leaves "pending" |
| 28b | `rec-quality-fixes` | ✅ 2026-10-14 | Recommendation quality: KMeans fits genre-less and disliked titles; cross-type cluster yields nothing; genre-less TMDB answer settled forever; rated-but-unwatched titles recommended; `family_of` one type only; older recompute can overwrite newer |
| 29 | `notifications-cache-hygiene` | ✅ 2026-10-14 | Follow credits in the `default` cache (culling evicts throttle/login counters); notifications load every follow's credits; `guest_session_id` not redacted in logs |
| 30 | `harden-account-input` | ✅ 2026-10-14 | Backend account/input hardening: login lockout lasts 5 min not 1 h in prod; unbounded `voteAverage` 500s Stats; password-gated actions unthrottled; avatar decompression RAM; no `EMAIL_TIMEOUT` |
| 31 | `fix-import-followups` | ✅ 2026-10-14 | 0.24.0 follow-ups: imports keep writing after close/sign-out (next account); episode Remove can report success for an update; 429 doesn't pause the shared lookup schedule; non-ISO `watched_at` fails a chunk |
| 32 | `honest-states-a11y` | ✅ 2026-10-14 | Frontend honest states and a11y: Lists Delete confirm opens the list; failures shown as empty (watched, partial For You, person credits, reset link); unvalidated Watched URL params; unlabelled controls |
| 33 | `fix-frontend-state` | ✅ 2026-10-14 | Frontend state: a failed first page starts an infinite-scroll request loop (Home/Anime); browse UI state carries to the next account; follow during the lazy load is undone |
| 34a | `harden-ci-3` | ✅ 2026-10-14 | CI/tests/images: unpinned `wait-on`, e2e Python deps and actions; no `permissions:`; vacuous list-name test; no TS DTO vs API check; no Python e2e traces; floating base images; tests in the backend image; docs drift and nits |
| 34b | `tidy-app-config` | ✅ 2026-10-14 | App config and dev setup: prod reset links default to localhost; `.env.example` gaps; Django admin mounted; bulk upload size limit; `package.json` hardcodes the dev interpreter path |
| 35 | `fix-browse-results` | ✅ 2026-10-15 | Calendar shows only today's movies; Rating/Release/Title sorts return junk; search term leaks between Search, People and Movies |
| 36 | `follow-crew-credits` | ✅ 2026-10-15 | Following a director/writer never notifies; "New from X" shows old titles; late-added credits never unread |
| 37 | `a11y-motion-titles` | ✅ 2026-10-15 | No reduced-motion support; every route titled "CINE DB"; unnamed library card buttons; nav items aren't links; light-theme contrast |
| 38 | `bound-background-load` | ✅ 2026-10-15 | Unbounded concurrent metadata backfills; 3 sync gunicorn workers stall on slow TMDB; `OutstandingToken` never flushed |
| 39 | `harden-account-input-2` | ✅ 2026-10-15 | Username change needs no password; no password-similarity check |
| 40 | `polish-library-docs` | ✅ 2026-10-15 | Watchlist unpaginated; US-only region; misleading For You tooltip; CSV/import small gaps; README endpoint count; dependency bumps |
| 41 | `live-tmdb-smoke` | ✅ 2026-10-15 | Every test mocks TMDB; opt-in live shape checks for every TMDB-reading feature, fix items add query checks |
| 42 | `fix-a11y-import-followups` | ✅ 2026-10-15 | 0.28.0 follow-ups: certification crash on a malformed country entry; route announcer stale/generic titles and StrictMode first-load announce; Watchlist page clamp before watched data; region change resets typed runtime; unbounded CSV `poster_path`; Recharts and page-change scroll ignore reduced motion; own-export re-import still looks up every row |
| 43 | `fix-titles-import-rules` | ✅ 2026-10-16 | 0.28.1 follow-ups: wrong page title for a bad id and on a failed load; Watchlist clamp stuck while watched data errors; backup `poster_path` unbounded; list import and null-score rows ignore the lookup-skip rule; stale platform after a region change; nested `usePageTitle` unmount clears the parent's title |
| 44 | `fix-library-backup-edges` | ✅ 2026-10-16 | Item 43 follow-ups: Watchlist filter error on a background reload and no loading state; backup restore unbounded runtime/platform/zone/rating/date/title; backup missing score never looked up; empty name titled as failure; stale title on id change |
| 45 | `fix-restore-text-edges` | ✅ 2026-10-16 | Items 43+44 follow-ups: backup restore drops looked-up scores; title cut splits emoji (chunk fails); length checks count UTF-16 units; Watchlist clamp during watched reload and Retry without feedback; duplicate lookups and counts across backup sections; restore drops near-future timestamps; person tab title vs heading; lookup merge rule; set-state after sign-out |
| 46 | `spoiler-shield` (feature; fix folded in) | ✅ 2026-10-21 | Found while building the spoiler shield: `useEpisodeProgress` reported `loading: false` on the render before its request started, so a child (the Episode Guide, whose effects run first) read "not started" as "no progress" |
| 47 | `spoiler-shield` review follow-ups | ✅ 2026-10-21 (fixed directly; 2 product questions moved to `ideas.md`) | Review of the uncommitted 0.30.0: guide waits a round trip for progress; progress Retry blanks the guide; dead `enabled` param; unscoped e2e switch |
| 48 | `fix-db-layer`; session-id encryption split out as `encrypt-tmdb-session` | ✅ 2026-10-28 (both changes archived) | Database review: per-user date indexes dropped by migration 0009; first recommendations save races; password reset not atomic; `LoginFailure` row outlives a deleted account; TMDB `session_id` in plain text; `TMDBMediaCache` never pruned; two stale comments (backfill-placeholder finding was a false positive) |
| 49 | CI shards (fixed directly) | ✅ 2026-10-30 | TS e2e job cancelled at its 15-minute cap on 0.28.2, 0.29.0 and 0.30.0 (412 tests, one worker), with no report uploaded on cancel; both e2e jobs then failed at browser install once `ubuntu-latest` became 26.04 |

Items 0–34 are done (0.26.0); 35, 36, 39 and 41 in 0.27.0; 37, 38 and 40 in 0.28.0. 42 in 0.28.1; 43, 44 and 45 in 0.28.2; 46 in 0.30.0. 47 in 0.30.0 too (fixed directly, no OpenSpec change; its two product questions moved to `ideas.md` item 1). 48 in 0.31.0 (`fix-db-layer` and `encrypt-tmdb-session`); 49 in 0.31.0 too (fixed directly, no OpenSpec change). No open items.

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
- ~~**(19)** TV runtime in `MarkWatchedModal`~~ **Decided 2026-10-12:** editable, prefilled with episodes × episode runtime (falling back to the latest episode's runtime), blank when unknown.
- ~~**(19)** Browse grids hide watched titles~~ **Decided 2026-10-12:** intended. Specified in `browse-filters` and documented in `docs/ARCHITECTURE.md`.
- ~~**(19)** Person pages crew credits~~ **Decided 2026-10-12:** a separate Crew tab (jobs joined per title). Non-actors open on it.

### 16. `fix-ci-lint` (✅ archived 2026-10-09)

See `openspec/changes/archive/2026-10-09-fix-ci-lint/`. Fixed with a line-scoped `eslint-disable-next-line no-script-url` on the test input; the rule stays on for app code.


- **[high] ✔ `main` fails CI.** `src/utils/__tests__/safeUrl.test.ts:10`: the literal `"javascript:alert(1)"` trips `no-script-url`, and `npm run lint` runs with `--max-warnings=0`. The CI `frontend` job stops at lint, so its Jest and build steps never run. Fix: `// eslint-disable-next-line no-script-url`, or build the string.

### 17. `fix-upstream-resilience` (frontend + backend) (✅ archived 2026-10-12, `openspec/changes/archive/2026-10-12-fix-upstream-resilience`)

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

### 18. `fix-account-edges` (frontend + backend) (✅ archived 2026-10-12, `openspec/changes/archive/2026-10-12-fix-account-edges`)

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

### 19. `fix-detail-and-nav` (frontend) (✅ archived 2026-10-12, `openspec/changes/archive/2026-10-12-fix-detail-and-nav`)

Every bullet below is fixed in that change. Already fixed by 26 before this change: the HeroBanner `<img>` `loading="lazy"`. Found during implementation: `useNavigationType()` reports POP for every in-route navigation because `App.tsx` passes `location` to `<Routes>`, so Watchlist's scroll restore uses `stashReturnState` instead.

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

### 20. `fix-stats-math` (backend + frontend) (✅ archived 2026-10-13, `openspec/changes/archive/2026-10-13-fix-stats-math`)

- **[low] Half-step ratings fall into uneven buckets.** `stats_views.py:50-52` uses `round(r)` (banker's rounding): 6.5 → 6 but 7.5 → 8, and 1.5 and 2.5 both → 2.
- **[low] The monthly chart skips months with no watches.** `stats_views.py:55-64` emits only months with entries, and `StatsPage.tsx:515` plots them on a category axis, so Jan and Jun look adjacent.
- **[low] Average TMDB rating counts unknown scores as 0.** `stats_views.py:77-79` averages every `vote_average`, including the `0` stored for a null CSV value or an unreleased title.
- **[low] Followed-people sections drop a TV show that shares an id with a movie.** `social_views.py:343-347` dedupes on the bare id, while notifications key on `(id, type)`.
- **[low] Stats page labels:** the Rating-by-Genre tooltip reads "7.3 avgRating" (`StatsPage.tsx:571`, raw dataKey); the heatmap tooltip shows raw `yyyy-mm-dd` instead of `formatDateDMY` (`:225`); heatmap cells are mouse-only; the Top Genres empty text (`:556-557`) still says to visit For You, though `stats_views.py` backfills itself.
- **[low] A backup restore loses list dates and order.** `UserListItem.added_at`/`UserList.created_at` are `auto_now_add` (`models.py:71,84`), and `CSVImportAllModal.tsx:115-118` restores items one POST at a time in parallel batches of 20, so items get restore-time dates and a scrambled newest-first order. With one request per item, a few thousand list items in a day also use up the `5000/day` user throttle for the whole app.

### 21. `harden-ci-2` + polish (split 2026-10-13: 21a ✅, 21b ✅, 21c ✅)

Split by theme, like item 7:
- **21a `harden-ci-2`** (✅ archived 2026-10-13, `openspec/changes/archive/2026-10-13-harden-ci-2`) covers the CI, nginx and test-hygiene findings: retries, the CI gaps, gzip/cache, the flaky wait, and the `test_ratings.py` guard.
- **21b `polish-colors-docs`** (✅ archived 2026-10-13, `openspec/changes/archive/2026-10-13-polish-colors-docs`) covers the hardcoded colors, both docs-drift lists and the `api-hardening` param-order wording. Two findings were dropped on re-check: the `browseFilters.ts` comment is accurate (it's about genres, which are cleared in an effect), and the Stats chart palette and heat scale stay fixed on purpose (now noted in CLAUDE.md).
- **21c `spec-test-gaps`** (✅ archived 2026-10-13, `openspec/changes/archive/2026-10-13-spec-test-gaps`) covers the conformance-check test list under "Additions to earlier items (fourth round)".
- **Found while writing 21c's tests (2026-10-13):**
  - **[low] Light-theme secondary text is below WCAG AA.** `colorTextSecondary` `#8c8168` (`antdTheme.ts`) measures 3.79:1 on `#fffdf8` and 3.48:1 on `#f8f3e8`. AA needs 4.5:1 for small text, and the Stats labels and other captions are 12px. `colorTextTertiary` is lighter still. `e2e/theme-readability.spec.ts` asserts 3:1 (the white-on-white regression it guards is about 1:1). Raise it to 4.5 once the palette is darkened.
  - The Tooltip-over-Popconfirm bug under the live run below also blocks taps, not just mouse clicks (see that bullet).
  - Fixed in 21c (trivial): the Anime TV↔Movies toggle sent one grid request with the previous media type's `with_genres` before the reset landed (`AnimePage.tsx`).
  - Fixed in 21c: a failed library refresh after an import was silent (backup) or reported as a failed import (CSV dialogs); the phone drawer's account buttons weren't named "Edit profile"/"Sign out".
- The `fetchAllPages` unit test below already exists (`src/utils/__tests__/fetchAllPages.test.ts`, from `speed-up-pages`). 21a adds the app-level two-page test.
- The dependency note stays info-only.

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
- **(24)** Backup format v3: add `followed.csv` and `episode_progress.csv` (needs a list endpoint for progress), or keep v2 and say in the export UI what's not included. The `data-backup` spec ("A backup contains the whole library") must match whichever is chosen. **Decided 2026-10-13:** backup v3 with `followed.csv` and `episode_progress.csv`. Separately, CSV poster lookups are paced and retried in the browser rather than filled on the server.
- **(23)** Should a rating change trigger a recommendations refresh (it weights seeds, loved genres and KMeans), or is the 12h TTL acceptable? **Decided 2026-10-13:** yes, on create, score change, delete and a bulk import that adds ratings (not on review-only edits). Also, titles rated 4 or below no longer seed "Because you watched".

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

### 23. `fix-recs-correctness` (backend + frontend) (✅ archived 2026-10-13, `openspec/changes/archive/2026-10-13-fix-recs-correctness`; specs synced into recommendation-refresh, recommendation-sections, view-state-restore and watch-stats)

- **[med] ✔ For You mixes movie and TV genre ids.** `recommendations.py:287-297` (`discover_mixed`) sends one genre id to both `/discover/movie` and `/discover/tv`, and `genre_count`, `loved_genre_count` and the KMeans vocabulary (`:437-491`) pool movie and TV genres in one id space. TMDB genre ids are type-specific (Action 28 is movie-only; Action & Adventure 10759 is TV-only).
  - "More like what you love" / "Based on your taste" lose half of each mixed section.
  - `tmdb_client.discover` joins ids with `,` (`tmdb_client.py:46`), which TMDB treats as AND, so a KMeans cluster like `[28, 10759]` returns nothing from either endpoint and the section is dropped.
  - Stats (`stats_views.py:66-75`) shows "Action" and "Action & Adventure" as separate top genres.
  - This is the backend version of item 4's frontend fix. Fix: map ids per media type (as `genresFor()` does) or keep separate vocabularies.
- **[med] ✔ A For You poll that gives up is cached as complete.** `RecommendationsPage.tsx:271-292`: after `MAX_POLLS = 20` with status still `"pending"`, the `else` branch calls `setComputingFlag(false)`, so the unmount save stores `complete: true`, and `hasFetched` (`:234`) skips fetching on return. Partial groups are shown as final, against `view-state-restore` "Incomplete recommendations are not cached as final". Also when returning to an incomplete snapshot and leaving before the first response.
- **[low-med] Ratings never trigger a recommendations refresh.** `signals.py:130-141` covers only `WatchedEntry`, and `ratings_views.py` doesn't call `schedule_refresh`. Ratings drive "More like what you love" (≥7), the "Because you watched" seed order and KMeans weights, so a change waits up to 12h. On a backup restore, watched is imported first and its refresh reads `RatingEntry` (`recommendations.py:207`) before the ratings bulk request commits, so a restored account has no "loved" section for 12h. `by_recency` (`:256-261`) can also seed "Because you watched X" from a title rated 1/10. (Open decision above.)
- **[low-med] Every watched toggle on For You re-runs the whole fetch and poll.** `RecommendationsPage.tsx:261-310` depends on `watchedList.length`, and its cleanup resets `hasFetched.current`. Marking a card refetches all three groups (including the TMDB-heavy followed-people call) and restarts polling; sections reshuffle. On a cache-hit mount the effect returns early, so the same action does nothing there.

### 24. `fix-import-export-2` (frontend + backend) (✅ archived 2026-10-13, `openspec/changes/archive/2026-10-13-fix-import-export-2`, specs synced into data-backup, adds migration 0024; the reload-failure bullet was already fixed in 21c)

- **[med] 2× "Export All Data" omits followed people and episode progress.** `backup.ts:44-102` writes only watchlist, watched, ratings and lists. There's no list endpoint for episode progress (`social_views.py:22` is per show). Export → delete account → re-register → import loses every follow (so all notifications and followed-people sections) and every SxxEyy position, with no notice. (Open decision above.)
- **[med] ✔ CSV imports hit `TmdbProxyThrottle` and silently drop posters.** `CSVUploadModal.tsx:79-93` and `CSVListImportModal.tsx:72-86` fetch a poster for every row, 20 at a time; `CSVImportAllModal.tsx:25-40` does the same for rows with no poster. The proxy allows `120/min` per user (`settings.py:163`), `tmdb.ts` doesn't retry a 429, and `catch {}` swallows it. A 300-row import saves ~180 rows with `posterPath: null` and `voteAverage` 0 (also dragging the Stats average down), the toast says "Import complete", and other browsing 429s for a minute. Fix: pace to the throttle, or treat a 429 as retry-later.
- **[low-med] 2× Re-importing the Watched page's own CSV loses every date and zone.** `WatchedPage.tsx:84-93` exports `watched_at`/`watched_tz`, but `CSVUploadModal.tsx:94-104` reads it with `parseCSVForImport` (`csvParse.ts:120-162`), which keeps only id, title and type. Every row becomes "now", so Monthly, heatmap, Recently watched and the Watched sort all show the history as watched today. Breaks `data-backup` "Watched exports keep the logged time zone". Fix: read `watched_at`/`watched_tz` when present, as `parseBackupCSV` does.
- **[low-med] Lists that share a name merge on restore.** `CSVImportAllModal.tsx:98-109`: `idByName` finds the first list (already created in this run), so the second "Favorites" list's items go into it and its description is dropped. Duplicate React key at `:270` (`key={l.name}`). Fix: match by name only against lists that existed before the import.
- **[low-med] A reload failure after a successful import is reported as an import failure.** `CSVUploadModal.tsx:105` awaits `reloadWatched()` inside the same `try` as `bulkImport`, so the user sees "Failed to import" without the added/skipped counts, though the rows were saved. `CSVImportAllModal.tsx:190` instead discards its reload `allSettled` result and says "Import complete". (`load-states` "Background refresh fails after a successful load" is silent app-wide.)
- **[low] `bulk_import` counts rows lost to a concurrent create as added** (`bulk_import.py:74-76`, `added = len(to_create)` under `ignore_conflicts=True`). Known race, acknowledged in a comment; the `data-backup` spec says counts match what was created.

### 25. `fix-write-guards-2` (frontend + backend) (✅ archived 2026-10-13, `openspec/changes/archive/2026-10-13-fix-write-guards-2`, specs synced into account-security, browse-filters, load-states, notifications, routing, view-state-restore and write-feedback; also takes the live run's People Back, double genre fetch and Tooltip-over-Popconfirm; the BottomNav label and the password refocus were already fixed in 21c)

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
- **[low] An open Tooltip covers the Popconfirm's OK button on library cards.** `WatchedPage.tsx:217-240` (and likely `ListDetailPage.tsx:243-265`, `WatchlistPage.tsx:255-278`): while the pointer stays on the "Mark unwatched" icon, its Tooltip sits over the Popconfirm's "Mark Unwatched" button and intercepts clicks. Mostly visual for a mouse, but it can block touch flows. Fix: hide the tooltip while the Popconfirm is open. Belongs with 25. **Confirmed on touch (2026-10-13, `spec-test-gaps`):** in Playwright's Pixel 5 emulation the tooltip stays open after the tap, so the OK button can't be tapped at all. ~~`e2e/library-filters.spec.ts` confirms from the keyboard until this is fixed.~~ Fixed in 25 (`ConfirmIconButton`); the test now uses a plain click.

Checked clean in the live run: no horizontal overflow on 18 routes at 375/820/1366 in both themes, including the phone drawers and modals; sidebar `scrollHeight == clientHeight` at 1366×768 and in the 820 rail; no app console errors; Movies/TV/Anime/Search/Calendar restore on both kinds of Back; every detail-page write, list, follow, notifications, Stats, iCal and ZIP export flow works; token-refresh recovery and auth redirects behave; every other duplicate request was a StrictMode dev-only pair.

### Additions to earlier items (fourth round)

Re-checked against 0.24.0 (`11b8c84`) on 2026-10-13: every bullet below is fixed except the per-IP connect timeout (now item 27), the `browseFilters.ts` comment and the light-theme contrast (both listed under "Fifth audit"). Struck-through or marked ✅ where fixed.

- **17 (`fix-upstream-resilience`):**
  - ✅ (fixed: `fetch_actor_credits` skips `mark_failed()` when `is_not_found(e)`) **[low-med] A person-credits 404 also freezes recommendations.** `recommendations.py:382-394` (`fetch_actor_credits`) calls `health.mark_failed()` on any `RequestException`. Actor ids come from `TMDBMediaCache.top_cast` (up to 7 days old), so a merged/deleted person keeps 404ing. The item-17 404 fix must cover this site too.
  - ✅ (fixed in item 27, `bound-tmdb-calls`: wall-clock deadline per call) **[low-med, plausible] urllib3 applies the connect timeout per resolved IP**, and `api.tmdb.org` resolves to 4 addresses. If TMDB drops SYNs, one proxy attempt is about 4×3.05s and three attempts about 37s, above gunicorn's 30s, while `WORST_CASE_SECONDS` (21.65s, `tmdb_proxy_views.py:31-45`) doesn't model it. One `tmdb_client` call (`timeout=10`) can take ~50s, so the rating views (`ratings_views.py:26,70`), `tmdb_views.py:25,45,75` and `delete_account` (`auth_views.py:269`) can be killed. With no `ATOMIC_REQUESTS`, a rating is saved but the client gets a 502; `delete_account` revokes the TMDB session before `user.delete()`, so the account isn't deleted. Fix: a wall-clock deadline around the whole call, and move rating sync and session revoke out of the request path.
- **20 (`fix-stats-math`):**
  - ✅ (fixed: `round_half_up()` at every average) **[low] More banker's rounding.** `stats_views.py:47` (`avgUserRating`) and `:136` (`avgRating`) use `round(x, 1)` on half-step averages (7.25 → 7.2). Fixing with `Decimal`/`ROUND_HALF_UP` covers all three sites.
  - ✅ (fixed: uses `bulkAddListItems`) **[low-med] `CSVListImportModal` also adds list items one POST each** (`CSVListImportModal.tsx:89-101`, 20 in parallel), with the same `auto_now_add` order scrambling and `5000/day` throttle use as the backup restore.
- **21 (`harden-ci-2` + polish):**
  - ✅ (fixed in 21c `spec-test-gaps`) **Test gaps from the spec conformance check:** no import modal has a UI test (nothing in `e2e/` calls `setInputFiles`; add `e2e/import.spec.ts` with a ZIP fixture for "One section fails", "New list in backup", "Import twice", "Re-select same file", the mixed-file preview); "Leave mid-computation" (`view-state-restore`); rating remove / "Unrated title has no remove"; "Mark as watched fails"; episode-progress save fails; a background-reload failure notice; library-filters "Two lists" and "Unmark the last item on the last page"; password focus after failed login; phone-drawer account controls; fail-closed on the default `SECRET_KEY`; key redaction with DEBUG on; Anime "Airing Today" date params; media-type switch drops `with_genres`; all four `theme-readability` scenarios; `service-health` warm-up hang/non-zero exit; `container-deployment` static checks (HSTS only over HTTPS, db gets only `.env.db`, `backend/.dockerignore`); `app-identity` manifest/meta; a signed-out unknown path that lands on not-found after sign-in.
  - ✅ (fixed: `expect(rate_btn).to_be_visible()`) **`e2e/python/test_ratings.py:115,124`** still branch on `rate_btn.count() == 0` (non-waiting); the assertion still runs, but it violates the `e2e-fixtures` rule.
  - ✅ (fixed: spec now allows grouping by name) **`api-hardening` says the proxy forwards params "in the same order"**, but `tmdb_proxy_views.py:62` iterates `request.GET.lists()` (grouped by key). TMDB doesn't care: relax the wording or forward the raw query string.
  - **Docs drift:** ~~CLAUDE.md says `TRUSTED_PROXY_COUNT` "defaults to 1", but `settings.py:173` defaults to 0 and only `docker-compose.yml:36` sets 1.~~ (fixed in 0.21.0) ~~The `browseFilters.ts:37-40` comment says genres reset "in an effect" as the general reset; `App.tsx:46-63` resets filters and sort during render.~~ (fixed in item 40: the comment now says only genres clear in an effect, and applied filters reset during render) ~~`public/index.html:14` `<title>CineDB</title>` vs "CINE DB" in the manifest and `app-identity`.~~ (fixed in 0.23.0)

## Fifth audit (2026-10-13): items 27–34 and open findings

Against 0.24.0 (`11b8c84`), after items 0–26 were all archived. Seven read-only passes: a re-check of the known-open notes above, the 0.24.0 diff, backend API/data, backend TMDB/background, frontend state, frontend pages/UX, infra/CI/tests/docs. Logged so far: the known-open re-check, backend TMDB/background, backend API/data, frontend pages/UX, and the 0.24.0 diff review. Also frontend state and infra/CI/tests/docs: all seven passes are in. Duplicates across passes are merged ("2×"). Suggested order: **30 → 31 → 33 → 27 → 32 → 29 → 28 → 34** (security and wrong-account writes first, then request loops and timeouts, then UX, then ops/CI).

### 27. TMDB deadline and request-path TMDB calls (✅ `bound-tmdb-calls`, archived 2026-10-14)

- **[med, plausible] No wall-clock deadline on TMDB calls.** `tmdb_proxy_views.py`'s `_worst_case_seconds` (about 22s from `CONNECT_TIMEOUT` 3.05 / `READ_TIMEOUT` 6 / `Retry` total 2) doesn't model urllib3 retrying the connect on each resolved address. `api.tmdb.org` has 4, so three connect attempts alone can take about 37s, over gunicorn's `--timeout 30` (`docker-entrypoint.sh:13`). `tmdb_client.py`'s `_get`/`_post`/`_delete` are bare `requests` calls with `timeout=10` and no overall limit. The only wall-clock deadline in the backend is `social_views.py`'s. Not reproduced.
- **[med] Rating sync runs in the request.** `ratings_views.py` POST, PATCH and DELETE call TMDB synchronously. With no `ATOMIC_REQUESTS`, a killed worker leaves the rating saved while the client sees a 502.
- **[med] Account deletion revokes TMDB first.** `delete_account` (`auth_views.py`) revokes the TMDB session before `request.user.delete()`, so a worker killed during the TMDB call leaves the account undeleted.
- **[med] ✔ Connecting a TMDB account can take ~40s and leave a revoked session stored.** `tmdb_views.py:65-72` calls `tmdb_client.create_session` then `revoke_tmdb_session`. `tmdb_client`'s `_get`/`_post`/`_delete` pass a scalar `timeout=10`, which `requests` applies to connect and read separately, so each call can take ~20s. If gunicorn kills the worker (or `profile.save()` raises `DBError`) after the old session's revoke, the profile keeps the revoked `session_id`, `tmdb_auth_status` says `connected: True`, and every later rating sync fails with a WARNING. Ratings POST/PATCH/DELETE, `tmdb_disconnect`, `tmdb_request_token` and `delete_account` have the same ~20s-per-call shape with no budget constant or test pin, which CLAUDE.md requires for endpoints that wait on TMDB.
- **Fix:** a deadline around each whole TMDB call (or a budget that models per-address connects), with a tuple timeout like `GENRE_LOOKUP_TIMEOUT`, a budget constant and a pin test. Move rating sync and the session revoke out of the request path (after commit, best-effort). Save the new TMDB session before revoking the old one.

### 28. Recommendations under failure and load (✅ split: 28a ✅ `bound-rec-refresh`, archived 2026-10-14; 28b ✅ `rec-quality-fixes`, archived 2026-10-14)

**Split 2026-10-14.** 28a (`bound-rec-refresh`): the stale-retry loop, the fill cap, the backfill-budget bypass (moved here from item 30), the warm-up order, refresh thread limits and the thread-start failure. 28b: the KMeans input, the cross-type cluster fallback, genre-less rechecks, rated-but-unwatched titles, `family_of`, and the save ordering between workers.

From the backend TMDB/background pass. ✔ = re-checked by hand.

- **[med] ✔ During a TMDB failure, every poll starts another full recompute.** When `save_recommendations()` refuses a result (a TMDB call failed and sections were lost), `computed_at` (`auto_now`, `models.py:116`) doesn't move, so the row stays stale. `recommendations_for_you`/`personalized_recommendations` call `_start_refresh_if_needed` on every GET of a stale row. The page polls both endpoints every 3s for 60s, so one visit chains back-to-back recomputes of hundreds of TMDB calls each, polls on other workers start their own, and the page ends in "gaveUp". Item 17 fixed the 404 cause but added no backoff for transient failures. Fix: a `last_attempt_at` (treat "stale but attempted less than N minutes ago" as fresh), or decide status before triggering.
- **[med] ✔ `_fill_media_cache` has no per-run cap** (`recommendations.py:174-188`), the uncapped sibling of item 22's import amplification. Every watched title missing from `TMDBMediaCache` or older than 7 days is fetched in one refresh (10 workers, one OR'd `Q` per entry). 50k imported ids → ~50k TMDB calls on the server's key (429s for every user's proxy calls), a 50k-term `WHERE`, and 50k permanent empty cache rows. A real 3,000-title library refetches everything in one burst every 7 days. Fix: cap per run like `metadata_backfill.MAX_PER_RUN`, newest first, and don't count the cap as a failure. Docs: makes `features.txt`'s "can't flood TMDB" true (with item 30's backfill-bypass fix).
- **[low-med] Personalized KMeans fits genre-less rows and disliked titles** (`recommendations.py:481-491`, `:509`). Rows with no families (settled without genres, in backoff, or past the backfill cap) are zero vectors that pull centroids toward the origin, and the result is saved as good for 12h. Ratings ≤4 still get positive weight (0.05–0.4), so many horror films rated 1–2 can produce "Your Taste: Horror", though item 23 stopped them seeding "Because you watched". Fix: drop zero rows from `X`; exclude ratings ≤4 or weight them negatively.
- **[low] A personalized cluster whose top two families split across media types disappears** (`recommendations.py:519-522`, `genre_families.with_genres`). Horror (movie-only) + Reality (TV-only) gives `None` for both types, so no candidates. Fix: fall back to the top family alone.
- **[low] The startup warm-up recomputes fresh users, in arbitrary order, and stops at 30s** (`compute_recommendations.py:12-29`). Every restart spends TMDB calls on the same leading users, and later users are never warmed. Fix: skip rows newer than `RECOMMENDATIONS_TTL_HOURS`, oldest `computed_at` first.
- **[low] A title TMDB answers with no genres is settled forever** (`metadata_backfill.py:96`, `entry_needs_metadata` `:46-49`). New/unreleased titles often have no genres yet, and `release_year = -1` never updates after release. Fix: a re-check age for a 200 with no genres; keep permanent settling for 404s.
- **Plausible, not reproduced:**
  - Titles rated but never marked watched can be recommended: `filter_new` (`:284-295`) and the personalized `watched_set` (`:500`) exclude only `WatchedEntry`. Fix: exclude every rated pair too.
  - An older recompute on one worker can overwrite a newer one from another (B starts, a watch on A triggers A's refresh, B saves last). Fix: save only if a watched/ratings version taken at start is still current.
  - No process-wide cap on refresh threads (`_spawn_refresh`, `:52-53`): each holds a DB connection for minutes plus 10 HTTP workers, so a burst of stale users could exhaust Postgres `max_connections`. Fix: a global semaphore or bounded executor.
  - If `Thread.start()` raises (thread exhaustion), the user stays in `_computing_users` and reads "pending" for the life of the process (`request_refresh` `:90-93`). Fix: release the slot on error.
  - `genre_families.family_of` (`:47-50`) registers an unknown id only for the type it was first seen on, so the same new id on the other type is never queried there.
  - (moved from item 30) Item 22's backfill cap can be bypassed: `DELETE /watched/clear/` then a 500-row import of fake ids resets `metadata_settled`, and each `/stats/` call backfills 100 more (~350k server-key TMDB calls/account/day within 5000/day). Fix: a per-user daily backfill budget, or remember 404'd `(type, id)` pairs globally. Docs: `features.txt` says "Imports of unknown titles can't flood TMDB"; that holds only after this and item 28's fill cap.

### 29. Cache placement, notifications load, log redaction (✅ `notifications-cache-hygiene`, archived 2026-10-14)

- **[low-med] ✔ Followed people's cached credits sit in the `default` cache** (`social_views.py:221`, `from django.core.cache import cache`). `default` is a `DatabaseCache` with `MAX_ENTRIES` 50k, and its cull deletes the alphabetically first third of keys: `:1:login_fail:…` and `:1:throttle_…` sort before `:1:tmdb:person_credits:…`. Past 50k keys, each cull wipes per-username login-failure limits and throttle counters and keeps the bulky credits, the harm CLAUDE.md cites for keeping the proxy cache out of `default`. Fix: move them to the `tmdb` alias or their own.
- **[low-med] Each notifications poll loads every followed person's cached credits** (`social_views.py:194`, `get_many` over all follows). `NOTIFICATIONS_MAX_FETCH` caps only TMDB fetches, and follows bulk-import 500 per request with no total limit, so 5,000 follows × 20–50 kB is 100–250 MB unpickled per poll in a sync worker. Fix: limit to the N most recent follows, or cache a per-person recent-releases summary.
- **Attack path (backend-data pass):** one account can push `default` past 50k on purpose: bulk-follow 500 arbitrary ids per request, then poll notifications (40 fetches per poll, 30 polls/min, 404s cached as `[]`, 6h TTL), ~1,200 keys/min. From then on every cache set culls the login-failure and throttle counters.
- **[low] ✔ `RedactingFormatter` doesn't redact `guest_session_id`** (`logging.py:8`). `\b(session_id|request_token)=` can't match inside `guest_session_id=` (`_` and `s` are both word characters), and the proxy treats `guest_session_id` as a credential. Fix: `(?<![A-Za-z0-9])((?:guest_)?session_id|request_token)=`, and the same in `_CREDENTIAL_JSON`.
- (moved from item 30, plausible) A release dated the same day as "mark seen" never shows as unread (`notifications_views.py:73`, day-granular `>`).
- **Implemented in `notifications-cache-hygiene` (2026-10-14).** The login-failure half of the cull risk was already gone (item 30 moved those counters to a table); throttle counters were the remaining victims. The same-day plausible was fixed with a server-side seen list (`NotificationCheckpoint.seen_same_day`).

### 30. Backend account and input hardening (✅ `harden-account-input`, archived 2026-10-14)

From the backend API/data pass. ✔ = re-checked by hand.

- **[med] ✔ In production the per-username login lockout lasts 5 minutes, not 1 hour, and parallel failures undercount.** `_record_login_failure` (`auth_views.py:67-72`) does `cache.add(key, 0, 3600)` then `cache.incr(key)`. `DatabaseCache` doesn't override `incr`, so `BaseCache.incr` does `get` + `set(key, new)` with the default timeout (300s, no `TIMEOUT` in `CACHES`). Each failure resets expiry to 5 min, and once at 20 the 429 path records nothing, so it lapses 5 min later: ~20 guesses per 5 min per username (~5,760/day, not 480) while `Retry-After` says 3600. get+set isn't atomic, so a parallel burst from many IPs counts as ~1. Tests run under DEBUG's `LocMemCache`, whose `incr` keeps the expiry under a lock, so they can't see it. Fix: store `(count, first_failure_ts)` and `set` it with the remaining window, or an atomic `F()` update on a small model. Docs: `features.txt` ("pause sign-in … for up to an hour") and CHANGELOG 0.21.0 describe the intended 1-hour window, true again once this is fixed.
- **[med] ✔ An unbounded `voteAverage` makes `/api/stats/` 500 permanently for that account.** `voteAverage` is `FiniteFloatField` with no min/max (`serializers.py:159,170,226,272`: watchlist, watched, list items, bulk). `1e27` reaches `stats_views.py` `round_half_up(sum/len)`, where `Decimal.quantize` raises `InvalidOperation` (verified for 1e27–1e308), uncaught. A crafted backup/CSV does it to the victim's own account (item 22's accepted vector). Negatives are accepted and shown as rating tags. Fix: `min_value=0, max_value=10` everywhere.
- **[med-low] Password-gated actions allow unlimited guessing with a stolen token.** `profile` PATCH `current_password` (`serializers.py:90-94`) and `delete_account` (`auth_views.py:329-336`) have only the default `user` 5000/day bucket, and a wrong password there doesn't touch the per-username counter. A stolen refresh token (7 days) gets ~5,000 guesses/day; a hit changes email and password, a full takeover. Fix: a `UserRateThrottle` scope (e.g. 10/hour) on both, and count wrong `current_password` in `_record_login_failure`.
- **[med-low] An avatar upload can use ~0.4–0.7 GB of RAM** (`auth_views.py:419-437,472`). The pixel cap is Pillow's `MAX_IMAGE_PIXELS` (89.5M). A 9,400² single-colour PNG is a few hundred KB (passes the 5 MB check); `_reencode_avatar` decodes it and `exif_transpose` returns `image.copy()` even without EXIF (Pillow 12.1.1), ~2×268–358 MB. A few parallel uploads can OOM the container, and the avatar keeps that resolution. Fix: reject over ~16M px, or `thumbnail((1024, 1024))` before re-encoding.
- **[low-med] No `EMAIL_TIMEOUT`, and the email-change notice is sent in the request** (`settings.py:237-249`, `auth_views.py:380-387`). A stalled SMTP server blocks until gunicorn kills the worker at 30s: the email/password change is committed, but `_revoke_all_refresh_tokens` and the token reissue never run and the client gets a 502, so the session is logged out by the password claim though the change succeeded. Reset-mail threads can also hang forever, one per request. Fix: `EMAIL_TIMEOUT` (e.g. 10) and send the notice via `transaction.on_commit` + `_in_background`.
- **[low] Reset request and confirm share one 5/hour per-IP bucket** (`PasswordResetThrottle` on both, `auth_views.py:158,221`). Two requests plus three validation rejections on confirm = 429 for up to the link's whole lifetime; NAT users share it. Fix: a separate scope for confirm.
- **[low] A password reset doesn't clear the per-username lockout** (`password_reset_confirm`, `auth_views.py:252-257`), so a user locked out by someone else's guessing still gets 429 right after resetting. Fix: `cache.delete(_login_failure_key(user.username))`.
- **[low] Episode-progress PATCH resets omitted fields to 1** (`EpisodeProgressInputSerializer` `default=1`, `serializers.py:341-342`; PATCH accepted at `social_views.py:59`). `PATCH {"episode": 5}` stores S1E5. Latent: the frontend sends both fields. Fix: drop PATCH, or `partial=True`.
- **[low] No `UserAttributeSimilarityValidator`** (`settings.py:121-125`), and `RegisterSerializer.validate_password` passes no `user`, so a password equal to the username or email is accepted. CHANGELOG 0.15.3 removed it on purpose ("by design"); revisit only as a decision.
- **Plausible, not reproduced:**
  - Two avatar uploads at once orphan a file (both read the same `old_name`, `auth_views.py:500`); it stays served after account deletion. Fix: `select_for_update()` on Profile.
  - Adding a list item while the list is deleted gives a 500 (FK `IntegrityError` in `list_items_create`/`list_items_bulk`, `lists_views.py:48-96`, and `insert_ignoring_conflicts`). Fix: lock the list or map `IntegrityError` to 404.
  - `followed_people_recommendations` (up to 10 TMDB fetches per call) has no TMDB-cost throttle scope, against CLAUDE.md's per-endpoint rule.
  - The email advisory lock keys on `hashtext(lower(email))` but the check uses `email__iexact` (`UPPER()`); for Unicode where the two folds differ (`ß`/`SS`), racing requests take different locks (0.24.0 pass, low confidence). Fix: key on `upper(%s)`.

### 31. 0.24.0 follow-ups (✅ `fix-import-followups`, archived 2026-10-14)

From the review of `46877e6..11b8c84`. ✔ = re-checked by hand.

- **[med] ✔ Imports keep running after the dialog closes or the user signs out, and can write into the next account.** `CSVImportAllModal`, `CSVUploadModal`, `CSVListImportModal`: paced lookups make a 500-row import ~5.5 min, the modals stay closable (`onCancel={handleClose}`, no busy guard), and nothing captures `currentSessionGeneration()`. Sign out and in as B mid-import → the later `bulkImport`/`bulkImportFollowed`/`createList` go out with B's token, so A's backup lands in B's account. Closing and re-running reads `/lists/` before either run creates anything, so every list is created twice. Fix: capture `gen` at submit and stop before each write unless `isCurrentSession(gen)`; block closing while busy.
- **[med] ✔ Episode-progress Remove can report success when it advanced instead.** `useEpisodeProgress` `update` and `clear` share one in-flight key, `progress-${showId}`, so a second call gets the first call's promise. Open the Remove confirm, click "Next Episode →", then confirm Remove: `clear()` resolves with update's promise and the toast says "Episode progress removed." while progress advanced. Fix: per-operation keys, or reject a different operation while busy.
- **[med] ✔ A 429 doesn't pause the shared lookup schedule** (`pacedLookup.ts:43-60`; the frontend-state pass called this fine, but `lookupOne` only `sleep`s its own loop). Only the worker that got the 429 sleeps; `nextSlotAt` isn't pushed, so the other 3 keep firing into the same window and burn their tries, leaving rows without posters, the opposite of "wait out a 429". Fix: on a 429, `nextSlotAt = max(nextSlotAt, now + retryAfter)`.
- **[med] A non-ISO `watched_at` fails a whole 500-row chunk** (`csvParse.ts` ~180-185). The client accepts anything `Date.parse` reads; DRF accepts ISO 8601 only, so `05/01/2024` or `May 1, 2024` → 400 for the chunk, the case the code comment says it prevents. A date-only `2024-05-01` is stored as UTC midnight with a blank zone, so it shows as Apr 30 in western zones (`user-local-dates`). Fix: accept only an ISO date-time with an offset; drop others for that row.
- **[low-med] 2× Follow-triggered notification refreshes have no superseded-response guard or debounce** (`useNotifications.ts:23-67`). The frontend-state pass found the same with an interval poll in flight when a follow triggers a second one. Follow A then B quickly: if A's response lands last, it overwrites the newer one. Following many people on People can hit `NotificationsThrottle` (30/min) and show the bell's error. Fix: a request-id ref plus a debounce.
- **[low] The import dialog makes the lazy followed-people fetch eager** (`CSVImportAllModal.tsx:76` calls `useFollowedPeople()`; `ProfileModal` always renders it), so every Profile open fetches `/followed-people/`. The comment at ~237 is wrong for the same reason. Fix: read `useContext(FollowedPeopleContext)?.retry` directly, as `useNotifications` does.
- **[low] Episode-progress writes have no session-generation check** (`useEpisodeProgress.ts:55-70`): a write in flight at sign-out still runs `setProgress(res.data)` after teardown.
- **[low] Restored follows don't refresh notifications:** the restore calls `retry()`, which doesn't bump `changes`.
- **[low] A followed restore accepts a blank name** (`BulkFollowedPersonSerializer.name` `allow_blank=True`, `readFollowed` `name ?? ""`), so cards and notifications show an empty name. Fix: skip the row, or show "Person {id}".
- **[low, low confidence] The filter drawer can seed the previous scope's genres** if it remounts open on a scope change: its effect runs before `App`'s `clearGenres`. Fix: seed through `genresFor(mediaType, selectedGenres)`.

### 32. Frontend honest states and accessibility (✅ `honest-states-a11y`, archived 2026-10-14)

From the frontend pages pass, plus overlaps from the 0.24.0 pass. ✔ = re-checked by hand.

- **[med-high] ✔ On the Lists page, either button in a card's Delete confirm also opens the list** (`ListsPage.tsx:144` card `onClick` navigates; the `Popconfirm` at `:163` sits in the card's `actions`). React events bubble through antd's portal, and the trigger's `stopPropagation` covers only the trigger, not OK/Cancel. Cancel opens the list; Delete deletes it and lands on "List not found". `e2e/python/test_lists.py:135` expects "No custom lists yet" after confirming, so check why it passes. Part of the answer is in item 34: its DELETE mock is shadowed and nothing checks that a DELETE or a navigation happened. Fix: wrap the Popconfirm in a `stopPropagation` span, or drop the card `onClick`.
- **Failures shown as empty (breaks `load-states`):**
  - **[med]** For You reads `watchedList`/`isDataLoading` but never `watchedError` (`RecommendationsPage.tsx:214,390-412`), so a failed watched load shows "No watched titles yet".
  - **[med] 2×** A failed group (or a later poll) after other groups loaded is silent: `fetchError` renders only when `totalItems === 0` (`RecommendationsPage.tsx:417-449`), and a followed-people failure also hides the "Crunching…" spinner. Fix: an inline Alert with Retry when `fetchError && totalItems > 0`.
  - **[med]** Person credit requests failing shows "No credits available" (`PersonPage.tsx:99-101,287-293`). Fix: `LoadError` with Retry.
  - **[med]** `ResetPasswordPage.tsx:25-31` reads `response.data` itself, so a network error or 502 says "Invalid or expired reset link." Same `getApiError` breach in `ForgotPasswordPage.tsx:16-21` (developer wording "Make sure the backend is running") and `RegisterPage.tsx:25-29` (`[object Object]` for nested bodies).
  - **[low]** The Lists page blanks its grid during a background reload (`ListsPage.tsx:118`, `isLoading` without `lists.length === 0`), if `ListsContext` sets `isLoading` on reload.
- **[med] The Watched page doesn't validate `?page`/`?pageSize`** (`WatchedPage.tsx:51-52,87`): `page=-2` shows items from the end, `1.5` a shifted slice, `pageSize=-5` everything but the last 5. Fix: integers, `page ≥ 1`, `pageSize ∈ [12, 24, 48, 96]`.
- **[med] The People page has no empty state** (`PeoplePage.tsx:96-113`): a search with no matches is a blank grid.
- **[med] Profile shows "Connect TMDB Account" before the status check answers** (`ProfileModal.tsx:66`, starts `false`), so a connected user can start a second connect. Fix: `undefined` + loading.
- **[low-med] Movies/TV/Anime category buttons stay clickable but do nothing while search or filters are active** (`HomePage.tsx:213-223`): a click highlights the button and resends the identical request. Fix: disable them, or drop `activeCategory` from the deps then.
- **[low] The Anime TV/Movies toggle still sends two grid requests** (`AnimePage.tsx:97-104,225-235`): the category is corrected in an effect, so the first request is a movie discover with TV "airing" params. Same pattern as 21c's genre fix; set the category in the same handler.
- **Accessibility:**
  - **[low-med]** The filter drawer's "Include Adult Content" switch applies immediately (outside the draft) and has no accessible name (`FilterPanel.tsx:245-251`).
  - **[low-med]** The drawer's Year/Rating/Runtime inputs aren't linked to their labels (`FilterPanel.tsx:144-216`, `Form.Item` without `name`/`htmlFor`).
  - **[low-med]** Add to List's checkboxes have no name and the row is a clickable `List.Item` div (`AddToListModal.tsx:119-136`).
  - **[low]** Two inputs with `id="global-search"` once the phone Search drawer has opened (`BottomNav.tsx:163-172`, `Sidebar.tsx:131`).
  - **[low]** Search's Movies/TV cards are hand-rolled (`SearchPage.tsx:191-397`) instead of `Movie`/`TVShowCard`: no watchlist button, and "Details" buttons don't name the title.
- **Theme and conventions:**
  - **[low]** The detail-page watchlist icon is always `RATING_GOLD` (`MovieDetails.tsx:146`, `TVShowDetails.tsx:144`), not `IN_WATCHLIST_BLUE`/`useActionIconColor()`.
  - **[low]** `.detail-backdrop-gradient` (`App.css` ~386-395) is dark-navy with no light sibling; `.glass-card`'s shadow is unscoped.
  - **[low]** `ProfileModal.tsx:260`'s fallback avatar uses `colorPrimary` and `slice(0,2)`, not `avatarColor()`/`getInitials()`.
  - **[low]** `StatsPage.tsx:85-90` has its own `ratingColor` copy, and `PALETTE` has inline hex literals.
  - **[low]** An unknown `?tab=` leaves Stats and Search with no tab and a blank panel (`StatsPage.tsx:357,676`, `SearchPage.tsx:461,494`); `PersonPage.tsx:290` already falls back.
  - **[low]** Budget/revenue use locale-dependent `toLocaleString()` (`MovieDetails.tsx:204,215`).
- **Plausible / minor:** Search and People skeletons wrap `SkeletonCard`'s `<Row>` in another `<Row>`, which may squash it; `MovieDetails.tsx:290` `key={actor.id}` can repeat for a person with two roles; SearchBox doesn't sync with `?q=` or a picked recent search; FilterPanel's year caps at 2030 with no from ≤ to check; the 10-star `StarRating` (~300px) may wrap at 320px; `NotFoundPage.tsx:13` re-implements `isPlainClick`.
- **Implemented in `honest-states-a11y` (2026-10-14).** Plausibles checked: SearchBox not following `?q=`/a picked recent search reproduced (the box kept its own value) and is fixed; the 10-star `StarRating` did wrap at 320 px (8 + 2 stars) and now shrinks to fit; the nested skeleton `Row`, repeated cast `key`, 2030 year cap without a from ≤ to check and `NotFoundPage`'s own `isPlainClick` were fixed as written.

### 33. Frontend state (✅ `fix-frontend-state`, archived 2026-10-14)

From the frontend state pass. ✔ = re-checked by hand.

- **[med] ✔ A failed first page starts an infinite-scroll request loop on Home and Anime.** `usePaginatedFetch.ts:171-174` `loadMore` checks `loading`, `loadingMore`, `hasMore` and `loadMoreError`, but not `error`. `HomePage.tsx`/`AnimePage.tsx` pass `enabled = hasMore && !loading && !loadMoreError` and keep the sentinel mounted under `<LoadError>`. Page 1 fails → the visible sentinel calls `loadMore` for `currentPage + 1` (after a category change that's the old category's page, e.g. 6 of the new one) → on success `loadMore` changes identity, the observer rebuilds, and it fetches again, until a page fails or `tmdb_proxy` answers 429. The user sees only LoadError. People and Search render the sentinel only on success. Fix: `error` in the guard and `!error` in `enabled`.
- **[low-med] Browse UI state carries over to the next account in the tab** (`UIContext.tsx:23-25`: `searchTerm`, `includeAdult`, `selectedGenres`; also `App.tsx`'s `activeFilters`/`activeSortBy`). A turns on "include adult" and signs out; B signs in and gets adult results. Fix: reset on signed-in → signed-out, like `useRecentSearches`.
- **[low-med] Following someone during the lazy followed-people load can be undone by that load** (`FollowedPeopleContext.tsx`: `setFollowed(data)` replaces the list; `PersonCard` disables Follow only on `error`). Already-followed people also show "Follow" while loading. Fix: disable Follow while `loading`, or merge follows made during the load.
- **Plausible:**
  - Library reloads have no ordering against writes (`useWatched`, `useWatchlist`, `useRatings`, `useLists`): a reload that started before an add and lands after it drops the item and its `dbIdMap` key, so Unmark is a no-op until the next reload. Fix: drop a reload result if a write finished after it started.
  - Library hooks report "not loading" for one render after sign-in (`isLoading` set from an effect), so `WatchedPage`'s page clamp can reset `/watched?page=3` to 1 and the empty CTA can flash. Fix: derive `isLoading` from `isAuthenticated && !loadedForThisSession`.
  - Mark-seen can be undone by a poll that starts after the epoch bump but before the POST commits (`useNotifications.ts` markSeen). Fix: bump the epoch again after it resolves.
  - `useRatings` has no `createInflight` slot (CLAUDE.md requires one); only `RatingModal`'s `busy` protects it.
  - An add racing a list clear (`useLists` slots `list-${id}` vs item keys) or `useWatched.clearAll` can put the item back in the UI.
  - `export.ts` and `CalendarPage` revoke the object URL synchronously after `a.click()` on a detached anchor, which can cancel the download on some Safari/older Firefox. Fix: revoke in a timeout.
  - Requests replayed from the refresh queue lack `_retry = true` (`userApi.ts:226-232`), so a second 401 starts another refresh and spends the `token_refresh` throttle.
  - After another tab signs out (or after delete-account), the next login in this tab returns to the previous account's URL (`AuthContext.tsx:67-71`, `postLoginPath`). Fix: navigate to a neutral path before `setUser(null)` there.

### 34. Infra, CI and tests (split: 34a ✅ `harden-ci-3`, archived 2026-10-14, specs `ci-pipeline`, `container-deployment`, `e2e-fixtures` synced; 34b ✅ `tidy-app-config`, archived 2026-10-14, specs `api-hardening`, `data-backup`, `dev-environment` synced)

**Split 2026-10-14.** 34a (`harden-ci-3`): CI pins and permissions, Python e2e constraints and traces, the list-name test, the TS DTO check, pinned and slimmer images, `server_tokens`, `@types/node` and the docs nits. The Lists DELETE-mock item was already fixed in `honest-states-a11y`. 34b: `FRONTEND_URL` fail-closed and `.env.example`, the admin route, `DATA_UPLOAD_MAX_MEMORY_SIZE`, and the interpreter path in `package.json`.

From the infra/CI/tests/docs pass. ✔ = re-checked by hand.

- **[med] ✔ The `e2e-python` job downloads an unpinned `wait-on` on every run** (`ci.yml:134`, `npx wait-on …`; not in `package.json`/lockfile), so npx fetches the latest from the registry each run: supply-chain and breakage risk against `ci-pipeline`'s pinned tools. Fix: a pinned devDependency, or a `curl` retry loop like the docker job's.
- **[low-med] Python e2e dependencies are only partly pinned** (`ci.yml:120`, `pip install -r e2e/python/requirements.txt`, no constraints): greenlet, pyee, pytest-base-url and requests float. pip `playwright==1.60.0` and npm `@playwright/test ^1.60.0` match only by a comment. Fix: `e2e/python/constraints.txt` plus a check that both Playwright versions match.
- **[low-med] ✔ `test_delete_confirmed_removes_list` never exercises its DELETE mock** (`e2e/python/test_lists.py:137-146`): the later `**/api/lists/**` route shadows the `**/api/lists/1/` 204 (last registered wins), and nothing asserts a DELETE was sent. Fix: one handler branching on `r.request.method` that records the DELETE, then assert it.
- **[low] ✔ `test_list_name_too_long_truncated_in_input` can't fail** (`test_lists.py:150-160`): fills 100 chars and asserts `len(val) <= 100`, but `maxLength` is 60 (`ListsPage.tsx:220`). Fix: assert `== 60`.
- **[low-med] Nothing checks TS mock types against the API.** The `e2e-fixtures` spec requires an automated check, but the TS side only `satisfies` the hand-written DTOs (`src/types/domain.ts`, `userApi.ts`), and `test_e2e_mock_shapes.py` reads only the Python `MOCK_*` dicts. A serializer change leaves the DTOs and every TS mock agreeing with each other but wrong. Fix: extend `test_e2e_mock_shapes` to read the DTO field lists, or generate them from a schema.
- **[low] ✔ `ci.yml` has no `permissions:` block, and actions are pinned by tag** (`actions/*@v4`, `docker/*@v3/v6`), so `GITHUB_TOKEN` gets the repo-default scopes. Fix: top-level `permissions: contents: read`; pin actions to SHAs.
- **[low] ✔ Production reset emails link to localhost if `FRONTEND_URL` is unset** (`settings.py:250` defaults to `http://localhost:3000` even with `DEBUG` off, unlike the other fail-closed settings). `backend/.env.example` also omits `FRONTEND_URL`, `JWT_SIGNING_KEY`, `CONN_MAX_AGE` and `DEFAULT_FROM_EMAIL`. Fix: list them, and fail closed on an unset `FRONTEND_URL` when `DEBUG` is off.
- **[low] ✔ Django admin is mounted** (`cinedb/urls.py:7`) but undocumented, unreachable through nginx (only `/api/` and `/media/` are proxied, no `collectstatic`), and in dev `:8000/admin/` is an unthrottled password form. Fix: remove it, or document, route and throttle it on purpose.
- **[low] Docker images:** floating base tags (`node:22-alpine`, `nginx:alpine`, `python:3.12-slim`, `postgres:15-alpine`), though the backend Dockerfile says it "installs exactly what the tests run on". The backend image ships tests and dev-only files (`COPY . .`; `backend/.dockerignore` misses `userdata/tests/`, `conftest.py`, `pytest.ini`, `pytest_dev_env.py`, `requirements-test.txt`, `start.py`). The root `.dockerignore` doesn't exclude `.git`, `.claude`, `openspec`, `docs` or the lint/test caches, so the frontend build context uploads the whole repo (speed only).
- **[low] The `e2e-python` job uploads nothing on failure**, while `e2e-ts` uploads report and traces (`ci.yml:175-182`). Fix: `--tracing=retain-on-failure --output=…` plus an `if: failure()` upload step.
- **[low] Docs drift:** `docs/ARCHITECTURE.md:79` names `fetchTVReviews`, which no longer exists (reviews come in the one `append_to_response` request). The `mock_base_django_routes` docstring (`e2e/python/conftest.py` ~296-304) still says unmatched calls fall through to a 401 block (now the 501 catch-all) and that `lists/` isn't paginated (it is).
- **[nit]** `src/App.tsx:168` has the `/stats` and `/following` `<Route>`s on one line. `nginx.conf` has no `server_tokens off;`. A few TS e2e TMDB-shaped literals (`watchlist.spec.ts` `MOCK_MOVIE`, `movies.spec.ts`, `write-feedback.spec.ts` `PERSON`, `accessibility.spec.ts` `UPCOMING`) could `satisfies` the `TMDB*` types.
- **Plausible:**
  - A backup restore of long reviews can fail a whole ratings chunk: Django's default `DATA_UPLOAD_MAX_MEMORY_SIZE` (2.5 MB) isn't overridden, and 500 ratings with reviews near 5000 chars (~15 KB each in CJK UTF-8) exceed it, so the chunk gets a 400 and none of its 500 rows import (nginx allows 8 MB). Fix: chunk by byte size in `bulkImport()`, or raise the limit for bulk views.
  - `@types/node ^25` against a Node 22 runtime lets e2e specs and `playwright.config.ts` use Node 23–25-only APIs that fail on CI. Fix: `^22`.
- **[low] ✔ `package.json` hardcodes a machine-specific interpreter path.** The `start`, `django` and `dev` scripts call `G:/Anaconda/envs/django/python.exe backend/start.py`, so `npm run dev` works only on the original dev machine, and the repo carries a personal path. Fix: read the interpreter from an env var (e.g. `DJANGO_PYTHON`, set in the untracked root `.env`, falling back to `python`) through a small launcher script, and document it in `.env.example` and README's setup. CLAUDE.md and README no longer name the path (2026-10-13 docs cleanup); the user's own memory keeps it.
- **Operator step (not a code change):** the local, untracked `.env.docker` still has `DJANGO_API_URL=http://backend:8000/api`, left from the removed Express layer. Delete it alongside the known `ALLOWED_HOSTS` step.

Checked clean in this pass: the CSP covers every external origin in `src`; no `add_header` in a `location`; the `redacted` log format covers both token-in-URL routes; `.sh` files are LF; CI runs every listed check, both Playwright projects with `retries: 0`, and the Docker smoke job; Node/Python versions match `.nvmrc`, `engines` and the images; `.eslintcache` isn't cached in CI; README lists every test file and `/api/` route; the 0.24.0 CHANGELOG claims match the code; the sampled data-backup, watch-stats, recommendation-refresh and account-security scenarios hold; no remaining `waitForTimeout` is a sleep before a positive assertion, and no paginated endpoint is mocked with a bare `[]`.

### Open, not yet grouped

- **[low] (→ item 37, fixed in `a11y-motion-titles`)** **Light-theme secondary and tertiary text are below WCAG AA.** Re-measured: `colorTextSecondary` `#8c8168` is 3.79:1 on `#fffdf8`, 3.48:1 on `#f8f3e8` and 3.82:1 on `#fffefb`. Light mode doesn't set `colorTextTertiary`, so antd derives `rgba(0,0,0,0.45)`, about 3.3:1. `e2e/theme-readability.spec.ts` still asserts `TEXT_MIN = 3`. Same finding as item 21's polish note. Fixed in item 37 (both tokens now reach 4.5:1, and the spec checks text at 4.5).
- **[low] (→ item 40)** **Docs drift:** the `genresFor` doc comment in `src/utils/browseFilters.ts` still says genres reset "in an effect, after the newly mounted page's first fetch". `App.tsx` resets them during render.
- **Open decision:** README shows the owner's GitHub handle in the CI badge, the contributors image and the license line. It's public and the badges need it; remove only if the README must carry no personal identifiers.
- **Docs cleanup done (2026-10-13, uncommitted):** CLAUDE.md and README no longer contain the interpreter's machine path, loopback or LAN IP literals (now "the IPv4 loopback address" and `<host-lan-ip>`), or "this machine" wording. README's Python e2e counts were stale (`test_detail.py` 19 → 25, `test_profile.py` 11 → 17; total 192). Every file path in both docs exists, and the quoted numbers (throttle rates, page sizes, gunicorn timeout, `CONN_MAX_AGE`, login limit, backfill cap, notification budget, 43 endpoints) match the code. Neither file holds secrets or open-bug details. Same pass over `features.txt` and `CHANGELOG.md`: the IP literals in CHANGELOG (0.22.0 proxy target, 0.15.x LAN example) became "Django on port 8000 over IPv4" and `<host-lan-ip>`. Accepted-weakness details were reworded to point at `docs/ARCHITECTURE.md` and item 14: the signup email reveal and username lockout (0.21.0), and the react-router advisory ids and preconditions (0.20.0). Rate-limit numbers stay, since they're public in `settings.py`. Every number in `features.txt` matches the code, and every file the 0.24.0 entry names exists. Two `features.txt` claims are wrong only because of open bugs (lockout window, item 30; TMDB flood, items 28 and 30); they're noted there.
- **Open decision:** registration still answers "An account with this email already exists." (`RegisterSerializer.validate_email`), which reveals that an address has an account. Accepted and documented in 22. The password-reset timing leak is fixed (the mail is sent in the background).

Checked clean in this pass: no TODO, FIXME, xfail, `pytest.mark.skip`, `test.fixme` or `it.todo` markers. The `test.skip(isMobile, …)` calls in `accessibility`, `browse-restore`, `load-failures` and `theme-readability` are deliberate viewport scoping. `/api/tmdb/` is still `AllowAny` with 3 sync workers and `120/min` per user or IP (accepted design, see 22).

## Sixth audit (2026-10-15): items 35–41

Against 0.26.0 (`5155a4d`), after items 0–34 were all archived. One read-only pass over backend, infra, frontend, imports, nav, e2e coverage and docs. Baseline green: `tsc`, eslint, backend pytest (559 passed, 1 POSIX-only skip), Jest (400 passed). ✔ = re-checked by hand; ✔ live = confirmed against live TMDB responses on 2026-10-15. Suggested order: **41 → 35 → 36 → 39 → 37 → 38 → 40** 41 goes first: its shape checks pass now, and 35 and 36 add their checks to its file. Then visibly broken features, account, a11y, capacity and polish.

### 35. `fix-browse-results` (frontend) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-fix-browse-results`; specs synced into browse-filters, calendar-export, routing, tmdb-live-checks, new release-calendar)

- **[high] ✔ live Release Calendar shows only today's movies.** `CalendarPage.tsx:120-151` asks discover for the 7-day window sorted `primary_release_date.asc` and stops after 3 pages (60 titles). TMDB had 815 movies in the window; page 3 ended on today's date, so days 2–7 never show. TV (99 results) was cut off at day 5 of 7. No region, popularity or vote floor, so what does show is mostly obscure, posterless titles. Fix: filter to titles that matter (e.g. `region` + `with_release_type`, a popularity/vote floor) and/or fetch per day; say when the list is capped. No e2e test covers the Calendar's contents.
- **[med] ✔ live "Rating (High to Low)" returns junk.** `FilterPanel.tsx:47` → `filtersToTMDBParams` (`tmdb.ts:210-235`) sends `vote_average.desc` with no `vote_count.gte`; the top results are 10.0 titles with 1 vote. Fix: add a vote-count floor whenever sorting by rating (recommendations' `discover` already uses 100/50).
- **[med] ✔ live "Release Date (Newest)" starts in the future.** `primary_release_date.desc` with no upper bound: first results were "100 Years" (2099), "Avatar 5" (2031), other 2030s placeholders. "Oldest" and "Title A–Z" have the same kind of problem (1870s shorts, punctuation-led titles). Fix: cap `.lte` at today for Newest, and a vote/popularity floor for Oldest and A–Z.
- **[med] ✔ Search term leaks between Search, People and Movies.** `UIContext.searchTerm` is shared. `PeoplePage.tsx:21-39` reads it without a reset on mount: a sidebar search for "batman" makes People show "People results for batman". A People search writes it back, so the sidebar box shows it. Home/Anime clear it only when not returning (`HomePage.tsx:70-76`), so Movies → detail → sidebar search → Back twice lands Movies in search mode (categories disabled, "Filters are disabled during search") with no search box on that page to clear it. `/search` without `?q=` also shows "Results for" the stale term. Fix: give People its own term (or the URL, like Search), and make Home/Anime ignore a term they didn't set.
- **[low] Calendar's "Export iCal" exports every loaded title**, ignoring the search filter on screen (`CalendarPage.tsx:230`).
- **[test] Live query-sanity checks for this item's fixes**, added to item 41's live smoke file: using the frontend's actual params, the Calendar covers every day of its window, the rating sort has a vote floor, and "newest" isn't in the future. They fail today and land with the fixes.
- **[low] Sidebar highlights nothing on detail and sub-pages.** `Sidebar.tsx:128` `selectedKeys={[location.pathname]}`: `/lists/3` doesn't light "My Lists", `/movie/550` lights nothing.

### 36. `follow-crew-credits` (backend + frontend) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-follow-crew-credits`, specs synced into notifications, recommendation-sections, tmdb-live-checks; migration 0029; decided: all crew jobs, "New from" = last 2 years + upcoming, unread = not seen at last mark-seen)

- **[med] ✔ Following a director, writer or composer never produces anything.** `social_views.py:217-218` (`_fetch_person_credits`) keeps only `combined_credits.cast`. The person page has a Crew tab (item 19) and Follow works for everyone, but notifications and "New from X" read acting credits only, so following e.g. a director gives an empty bell and no section. Fix: merge crew (dedupe by `(id, media_type)`, maybe limit to key jobs), in both the full and recent summaries; the cache rows grow, so recheck the `person_credits` sizing.
- **[low] "New from {name}" isn't new.** `followed_people_recommendations` (`social_views.py:309-334`) drops anything under 6.0 votes (so every new or upcoming release) and sorts by score: the section is the person's best-rated titles, often decades old. Fix: rename ("Best of {name}") or sort/filter by date.
- **[low] Unread is decided by release date, not by when a title appeared.** `notifications_views.py:414-416`: a credit TMDB adds late with a past date (common: data entry lags release), or one that enters the cache after mark-seen, is never unread. Same for a newly followed person's recent releases, which may be intended. Decide, then either document or track first-seen per item.
- **[test]** Add a live check to item 41's smoke file that a crew-only person (e.g. a director) yields recent crew credits through the notifications path.
- **[nit] Follow and unfollow share an in-flight slot without action names** (`FollowedPeopleContext.tsx:94-117`), against the `run(key, fn, action)` convention: an unfollow issued while a follow is pending would resolve with the follow. Unreachable from today's UI (the button keeps its label until the write settles), so convention only.
- Also: talk-show and award-show appearances ("Self" credits) feed "Because you like {actor}" (`recommendations.py:478-494`) and followed-people sections; consider skipping Talk/News/Reality genres there.

### 37. `a11y-motion-titles` (frontend) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-a11y-motion-titles`, specs synced into accessibility, mark-watched, theme-readability; light secondary #706753 / tertiary #776e58, dark tertiary #9090a8)

- **[med] ✔ No reduced-motion support anywhere.** No `prefers-reduced-motion`, `useReducedMotion` or `MotionConfig` in `src`: page transitions (`pageVariants`), card hover scale/lift, the sidebar spring, the Stats count-up (`StatsPage.tsx` `useCountUp`) and `MarqueeTitle` scrolling all run regardless. Fix: one `<MotionConfig reducedMotion="user">` at the root plus a CSS media query, and skip the count-up.
- **[med] ✔ Every route is titled "CINE DB".** Nothing sets `document.title` (`public/index.html:14` only), so tabs, history and bookmarks are indistinguishable, and screen readers get no page-change announcement (WCAG 2.4.2). Fix: a small `usePageTitle` per route (detail pages use the title's name), plus moving focus to the page heading on navigation.
- **[low] ✔ Library card buttons don't name their title**, against CLAUDE.md's card rule: `WatchlistPage.tsx:249,261,278` ("Mark watched", "Rate", "Remove from watchlist"), `ListDetailPage.tsx:257`, `WatchedPage.tsx:236`. A screen reader hears the same label on every card.
- **[low] Sidebar and bottom-nav entries aren't links.** `Sidebar.tsx:126-135` navigates in `Menu.onSelect`, `BottomNav` uses buttons + `navigate()`: no Ctrl/middle-click new tab, no link semantics, and clicking the current item does nothing (antd fires no `onSelect` for the selected key).
- **[low] Profile dialog password fields have no `autoComplete`** (`ProfileModal.tsx` current/new/confirm and the Danger Zone password), unlike the auth pages, so password managers fill or save the wrong field.
- **[low] Mark-as-watched dialog can be closed mid-save.** `MarkWatchedModal` has no busy state; callers (`RecommendationsPage.tsx:144-152`, etc.) await the write with the dialog still cancellable and close it even on failure, losing the typed runtime/platform. Same rule as `RatingModal`.
- **[low] Long card titles are readable only by mouse hover.** `MarqueeTitle.tsx` clips without an ellipsis or `title`, and scrolls only on `mouseenter`; touch and keyboard users never see the rest. It also measures once per title, not on resize.
- Moved here: **light-theme secondary/tertiary text below AA** (see "Open, not yet grouped" under the fifth audit).

### 38. `bound-background-load` (backend + infra) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-bound-background-load`, specs synced into service-health, title-metadata; gunicorn gthread 3×8, verified statically only until a Docker deploy)

- **[med] ✔ Background metadata backfills have no global concurrency cap.** `metadata_backfill.request_backfill` (`metadata_backfill.py:166-172`) is single-flight per user only. Each `/stats/` visit by a user with unfilled titles starts a thread with a 5-worker TMDB pool and its own DB connection. Many users at once → unbounded threads and connections (Postgres default `max_connections` 100). Recommendation refreshes have `MAX_CONCURRENT_REFRESHES`; this path doesn't. Fix: a process-wide semaphore like `_refresh_slots`.
- **[med] 3 sync gunicorn workers each wait on TMDB for up to 15–20 s.** `docker-entrypoint.sh:13` (`--workers 3`, sync). The proxy (`PROXY_DEADLINE_SECONDS` 20), notifications and followed-people recommendations (15 s budgets) hold a worker for the whole wait. During a TMDB slowdown 3 concurrent waits make the entire API, login and library loads included, unavailable. Item 22 accepted the public proxy; this outage case wasn't considered. Fix options: `gthread` workers (the TMDB code is thread-safe; DB-cache and connection behaviour need checking), or more workers.
- **[low] `OutstandingToken` / `BlacklistedToken` grow without bound.** Every login and hourly refresh adds rows; nothing schedules simplejwt's `flushexpiredtokens`. Documented in `docs/ARCHITECTURE.md` and left out of scope in `fix-session-lifecycle`, never tracked here. Fix: run it from the entrypoint (like `createcachetable`) or a periodic job.

### 39. `harden-account-input-2` (backend) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-harden-account-input-2`, spec account-security synced; `alicealice` stays accepted at Django's default 0.7 similarity, `alice2024` is rejected; `is_staff` left as is)

- **[low-med] ✔ A username can be changed without the password.** `UserProfileUpdateSerializer.validate` (`serializers.py:99-112`) requires `current_password` only for email and password changes. Login is by username, so with a stolen access token someone can rename the account and the owner can no longer sign in (their reset email does carry the new name). Fix: require the password for a username change too, and notify by email like an email change.
- **[low] No password-similarity check.** `AUTH_PASSWORD_VALIDATORS` (`settings.py:121-125`) lacks Django's default `UserAttributeSimilarityValidator`, and `RegisterSerializer.validate_password` (`serializers.py:20-25`) validates without the user, so "alicealice" passes for user "alice". Fix: add the validator and validate against an unsaved `User(username, email)`.
- **[nit]** The login-failure key folds case (`auth_views.py:64-66`) while usernames are case-sensitive, so failures on "alice" also lock "Alice". `UserSerializer` exposes an unused `is_staff`.

### 40. `polish-library-docs` (frontend + docs + deps) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-polish-library-docs`, specs synced; deps went to Pillow 12.3.0, requests 2.34.2, psycopg2-binary 2.9.13; decided: device region + Edit Profile setting with US fallback, patch/minor dep bumps only)

- **[low-med] Watchlist page has no pagination.** `WatchlistPage.tsx` renders every entry as an animated card at once (Watched paginates at 48). Slow with large watchlists.
- **[low-med] Region is always US.** Where-to-watch (`WatchProviders.tsx:13`), certification (`MovieDetails.tsx:61`) and the mark-watched platform list (`MarkWatchedModal.tsx:65`) are fixed to `US` (labelled honestly). No region setting; non-US users get irrelevant providers. Product decision: a region preference (device default via `Intl`) or keep US.
- **[low] For You tooltip claims "patterns from similar viewers"** (`RecommendationsPage.tsx:383`). There's no cross-user signal: personalized sections cluster the user's own genres. Reword.
- **[low] Watched page CSV export drops runtime, platform and poster** (`WatchedPage.tsx:89-99`), and `CSVUploadModal` reads neither back, so the page's own export → import loses them (the backup ZIP keeps them).
- **[low] CSV imports ignore a file-read failure.** `CSVUploadModal`'s `FileReader` (and the list import's) has no `onerror`, so an unreadable file shows nothing.
- **[low] Backup restore loses an empty list silently.** `CSVImportAllModal.tsx:143-151`: a failed create adds `list.entries.length` to `failed`, which is 0 for an empty list, so the result reads as success.
- **[low] List not found isn't the `notFound` LoadError.** `ListDetailPage.tsx` shows a plain `Empty` for a missing list, unlike detail/person pages.
- **[low] Docs drift:** README says "43 REST API endpoints" (`README.md:31`); its API table and `urls.py` have 44. ~~Also the `genresFor` comment (moved here from the fifth audit's open list).~~ Fixed in `fix-browse-results`.
- **[nit]** `App.tsx:30` has two `lazy()` statements on one line. Dependencies: `npm audit --omit=dev` shows only low-severity build-time advisories (`@babel/core`); Django 6.1, DRF 3.18, gunicorn 26, Pillow 12.3, requests 2.34, urllib3 2.8 are out (bump deliberately, with the pins and `test_dependency_versions.py`).

### 41. `live-tmdb-smoke` (tests) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-live-tmdb-smoke`, spec `tmdb-live-checks` synced; live run 18 pass in ~45 s; also checks the genre chips against TMDB's genre lists)

- **[med] ✔ Nothing checks the app's TMDB use against real data.** Every Jest, e2e and pytest test mocks TMDB, so code is verified only against fake answers. The three ✔ live bugs in item 35 pass the whole suite. **Decided 2026-10-15:** one live smoke file in the existing backend pytest suite (e.g. `userdata/tests/test_tmdb_live.py`), opt-in: skipped unless an explicit flag (e.g. `RUN_LIVE_TMDB=1`) and a real `TMDB_API_KEY` are set. The flag matters because the local `backend/.env` already has a key, so plain `pytest` and CI on push must never touch the network.
- **Scope: shape checks only, for every TMDB-reading feature.** Each field or appended part the app reads still exists with the expected type. Passes today, so this lands first, independent of the fix items:
  - Movies/TV/Anime grids: category and discover params (Anime's filters), `total_pages`.
  - Search: movie/TV/person results, `include_adult`.
  - Calendar: discover by date window.
  - Hero banner: `trending` shape, backdrops.
  - Movie/TV detail: every `append_to_response` part (`watch/providers`, `release_dates`, `aggregate_credits`, `videos`, `images`, `reviews`, `similar`, `recommendations`, `external_ids`).
  - Episode guide: `/tv/{id}/season/{n}`, specials (season 0).
  - Mark as watched: `runtime`, `number_of_episodes`, `episode_run_time`, `last_episode_to_air`.
  - Person page: `movie_credits`/`tv_credits` cast and crew, `images`.
  - Backend recommendations: discover by genre-family ids, `/similar`, `/recommendations`, `combined_credits`, `get_details_with_cast`.
  - Backend notifications/follows: `combined_credits`.
  - Backend Stats/backfill: `genres`, `original_language`, release dates, `/genre/{type}/list`.
- **Rule going forward:** each fix item adds its own query-sanity checks to this file (35: Calendar coverage and sorts; 36: crew credits), and any new feature that reads TMDB adds its shape check here. Optional later: a scheduled CI job with a repo secret.

Checked clean in this pass: every view filters by `request.user`; bulk endpoints, input serializers and `FiniteFloatField` cover every write; TMDB calls in requests run under `call_with_deadline`; worker threads do HTTP only; recommendation save/backoff/supersede logic and refresh coalescing hold; session generation guards are in every library hook, provider and import; the import dialogs block closing while busy and stop on sign-out; nginx/CSP/Docker match CLAUDE.md; `build/` and `playwright-report/` are ignored.

## CI check (2026-10-30): item 49

Read from GitHub's public API (job conclusions, step times, check-run annotations; the logs themselves need sign-in), plus one full local run of `npx playwright test`.

### 49. TypeScript e2e job outgrew its time cap (CI) (✅ fixed directly 2026-10-30, small and inside the `ci-pipeline` spec, so no OpenSpec change; YAML parses and typecheck passes, proven only by the next CI run)

- **[high] The job is cancelled, not failed, on every push since 0.28.2.** `e2e-ts` runs 412 tests on one worker (`workers: process.env.CI ? 1`) under `timeout-minutes: 15`. 0.27.0 passed at about 15 min; 0.28.2, 0.29.0 and 0.30.0 hit "The job has exceeded the maximum execution time of 15m0s" during `npx playwright test`. All other jobs passed. **Fixed:** a 3-shard matrix (`--shard=N/3`, `fail-fast: false`), still one worker per runner.
- **[med] A cancelled run uploads no report.** The upload ran on `failure()` only, and a timeout cancels, so CI never showed whether any test was red. **Fixed:** Playwright `globalTimeout` 12 min on CI (fails before the job cap, with its report), and the upload also runs on `cancelled()`, one artifact per shard (`playwright-report-<shard>`).
- **[unknown] 0.28.0 and 0.28.1 failed the same job** (exit code 1, not a timeout). Which tests failed isn't readable without sign-in. 0.28.2 fixed an `import.spec` flake, and the full local run below found nothing failing, so it is likely that flake. Not pursued.
- **Local run (4 workers):** 393 pass, 15 skip, 4 fail in 15.1 min. The 4 (`auth.spec.ts:166` focus on load, `search-scope.spec.ts:31`, `responsive.spec.ts:76` keyboard viewport and `:145` notification popup on the tablet rail) all passed on a rerun at 1 worker, CI's setting: load-induced, not bugs. Why CI stays at one worker per runner.
- **[high] Every e2e job failed at browser install** on the first push after `ubuntu-latest` moved to Ubuntu 26.04 (2026-10-19; earlier runs carried GitHub's notice): "Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.60.0!" / "Playwright does not support chromium on ubuntu26.04-x64". **Fixed:** all five jobs pinned to `runs-on: ubuntu-24.04`, matching the rule that everything CI runs is pinned; move with a Playwright version that supports the newer image.
- **Note:** the job's check name is now `E2E (Playwright TS, shard N/3)`; a branch-protection rule naming the old check needs updating.

## Thirteenth review (2026-10-28): item 48

One `/code-review` pass over the database layer: `backend/userdata/models.py`, every migration, and the views, serializers and helpers that write to or query those tables, at 0.30.0 (`36e590a`). Read-only: no finding was reproduced or run yet, so re-check each before fixing. Checked clean in this pass: bulk import, the `LoginFailure` upsert, the `TmdbTitleBudget` grant, avatar locking, and the guards that stop a title's id and type from changing.

### 48. Database review follow-ups (backend) (✅ `fix-db-layer` archived 2026-10-28, specs synced; pytest 606 pass, migration 0030, `EXPLAIN` on the dev DB shows an index scan with no sort; session-id encryption done separately in `encrypt-tmdb-session`, archived 2026-10-28, specs synced: Fernet `EncryptedSessionField`, `TMDB_SESSION_KEYS` required with DEBUG off, migration 0031, pytest 616 pass. Proposed 2026-10-28; findings checked against the code: indexes, first-save race, reset, deletion and comments confirmed; reset impact is consistency only, since the `hash_password` claim already kills old tokens; session-id encryption left for its own change; backfill placeholders were a false positive)

- **[med] Per-user date indexes are gone.** Migration 0008 added `watched_user_date_idx`, `watched_user_year_idx`, `watchlist_user_date_idx`, `rating_user_date_idx`, `followed_user_date_idx` and `episode_user_date_idx` in a migration only, never in the models' `Meta.indexes`, so a later `makemigrations` read them as drift and 0009 (`0009_remove_episodeprogress_episode_user_date_idx_and_more.py:13`) dropped them all. Every library page (filter by user, order by date then `-id`, up to 500 per page) now uses the unique `(user, media_id, media_type)` index and sorts all of that user's rows on each request; the global single-column `watched_at` index doesn't help a per-user query. Fix: declare them in `Meta.indexes` and generate the migration. Check first with `EXPLAIN` on a large history.
- **[med] First recommendations save can be overwritten by an older compute.** `save_recommendations` (`recommendations.py:736`) decides "superseded" under `select_for_update`, which locks nothing when the user has no row yet. Two computes in different gunicorn processes (a new user importing watched entries, then ratings) can both pass, and `update_or_create` keeps whichever finishes last, even when it started first, with its older `source_started_at`. Fix: create the row first (`get_or_create` then lock), or an advisory lock per user.
- **[med] Password reset isn't all-or-nothing.** `password_reset_confirm` (`auth_views.py:312`) runs `user.save()`, `_revoke_all_refresh_tokens` and `_clear_login_failures` without a shared transaction. If revoking fails (a DB error, a dropped connection), the new password is committed, the old refresh tokens are never blacklisted, and the user gets a 500. The `hash_password` claim check should still refuse those tokens, so check how much this matters before fixing. Fix: `transaction.atomic()` around the three steps.
- **[low-med] A deleted account leaves its `LoginFailure` row.** (`/simplify` on 2026-10-30 found a rename frees the old name the same way; fixed there too.) Account deletion (`auth_views.py:407`) doesn't clear the failure key for the exact username, which becomes free immediately. Whoever registers that name next starts with the old failure count and can get a 429 on their first sign-in or first password-gated profile edit. Fix: clear the key on deletion, as password reset does.
- **[low-med] TMDB `session_id` is stored in plain text** (`models.py:133`). It can write to the user's TMDB account (ratings, lists), and the code already treats it as a secret in logs (`RedactingFormatter`), but anyone with a DB dump, backup or read access gets working sessions for every connected user. [decide] Encrypt at rest with a key from settings, or accept and document. Needs a key-rotation story if encrypted.
- **[false positive] Backfill writes the 404 placeholders for a real but empty answer.** `None` means "never fetched" (`entry_needs_metadata`), so storing it would refetch the title forever; `metadata_settled` and `metadata_checked_at` already tell a 404 apart. Original finding: `metadata_backfill.py:104` stores language `'??'` and year `-1` both for a TMDB 404 and for a real answer that has no language or date. Migrations 0022 and 0028 tell a 404 apart by exactly those values, so a future cleanup written the same way would settle a real title and stop rechecking it. Fix: store `None` for a missing language or year on a real answer (a migration for existing rows is optional, since `metadata_settled` already separates them today).
- **[low] `TMDBMediaCache` is never pruned** (`models.py:101`). Rows are only upserted (404 placeholders included), never deleted, so the table grows with every title any user ever watched, deleted accounts included. Fix: a periodic delete of rows older than `CACHE_TTL_DAYS` that no `WatchedEntry` references, in the same best-effort startup step as `flushexpiredtokens`.
- **[low] Stale comments.** `models.py:213` says the `LoginFailure` key hashes the folded username; `_login_failure_key` hashes the exact username on purpose (`harden-account-input-2`), and "fixing" it to match the comment would bring back the cross-account lockout. `auth_views.py:175` says `OutstandingToken` is never flushed; `start.py` and the Docker entrypoint now run `flushexpiredtokens`.

## Twelfth review (2026-10-26): security, no items

One `/security-review` pass over the whole tree at 0.30.0 (`36e590a`), read-only. Bar: HIGH/MEDIUM, ≥8/10 confidence of real exploitability; DoS, rate limiting and hardening-only items excluded. **No findings**, so no item number and nothing to propose. Coverage is listed under "Verified fine" (2026-10-26).

Noted below the bar: JWTs live in `localStorage`, exploitable only through an XSS, and none was found.

## Eleventh review (2026-10-21): item 47

One `/code-review` pass over the uncommitted 0.30.0 (`spoiler-shield`). Read-only; each finding checked against the code by hand.

### 47. Spoiler shield follow-ups (frontend) (✅ fixed directly 2026-10-21, small and inside the `spoiler-shield` spec, so no new OpenSpec change: the four fixes below are done, Jest 547 pass after /simplify, e2e not rerun (only a locator changed); the two [decide] items are product questions, moved to `ideas.md` item 1)

- **[med] The guide's first season fetch waits for the progress request.** `EpisodeGuide.tsx` starts `fetchTVSeason` only once progress settles, so every TV page shows the guide one round trip later, and a slow progress call keeps it on skeletons for users who don't track. Accepted in the design's Risks, but avoidable: fetch the first regular season in parallel, keep it off screen until progress settles, then switch to the tracked season if it differs. **Fixed:** the first regular season is requested while progress loads; `sharedGet` joins the real load to it.
- **[med] Progress Retry blanks the guide.** `loading || progressLoading` shows skeletons whenever progress reloads, so after a progress error, Retry drops the episode list (and expanded panels) and disables the Select. Only the first load needs the gate. **Fixed:** a one-time `ready` state gates the list; later reloads leave it on screen.
- **[low] `shieldApplies({ enabled })` is always passed `true`.** The switch value is ANDed separately, so the parameter misleads. **Fixed** by `/simplify`: the helper was removed, `shieldOn = canShield && hideSpoilers`. Was: pass `hideSpoilers`, compute the switch's visibility without it.
- **[low] e2e `get_by_role("switch")` is unscoped.** Breaks under strict mode once another switch appears on the TV page. **Fixed:** `name="Hide spoilers"`.
- **[moved to ideas.md] A hidden row still shows its score.** A standout rating can mark the big episode. The spec keeps score, runtime and air date visible; hiding the score is a spec change.
- **[moved to ideas.md] Specials are never hidden.** A post-finale special's title and overview can spoil the ending. The spec and design left specials out because they have no place in the progress order.
- **Later done by `/simplify`:** `PosterPlaceholder` got optional `children` and is reused for the hidden still; `useEpisodeProgress` derives `loading` from a settled `showId:retryToken` key (covers Retry), replacing `startedFor`. Originally won't-fix: reuse `PosterPlaceholder` for the hidden still (it hardcodes "No Image", wrong here); replace `useEpisodeProgress`'s `startedFor` with a `loadedFor` (would read a Retry as not loading).

## Tenth review (2026-10-16): item 45

Two `/code-review` passes over the uncommitted items 43 and 44 (`fix-titles-import-rules`, `fix-library-backup-edges`), asked whether the project is complete. Read-only: no finding was reproduced or run yet, so re-check each before fixing.

### 45. Items 43 and 44 follow-ups (frontend) (✅ archived 2026-10-16, `openspec/changes/archive/2026-10-16-fix-restore-text-edges`, specs synced into accessibility, data-backup, library-filters, load-states; all 11 checked against the code: 9 confirmed, clamp-during-reload and person empty body plausible; decided: a backup row looked up for its poster keeps TMDB's score when the backup's is 0, rows with a poster still never looked up; 5-min future leeway mirrors `BULK_TIMESTAMP_SKEW`; Movie/TV pages get the empty-body fix too; implemented 2026-10-16, 19/19, Jest 517 pass, `import.spec.ts` 26 pass)

- **[high] Backup restore throws away the score it looked up.** `CSVImportAllModal.tsx:93` `enrichPosterPaths` copies back only `posterPath`. A row with no poster and a blank score (parsed to 0) is looked up for its poster, TMDB returns its `vote_average`, and the row still restores with 0. **Decide first:** item 44 decided a blank score is never looked up, for cost; here the call is already paid, so keeping the score costs nothing.
- **[high] `parseTitle` can split an emoji.** `csvParse.ts` (`parseTitle`, ~line 156/421) cuts at 500 UTF-16 units with `slice(0, 500)`. An astral character across 499/500 leaves a lone high surrogate; Python decodes it, the PostgreSQL UTF-8 encode raises, and the whole 500-row chunk fails, which the per-row parsers exist to prevent. Fix: cut by code points (`Array.from(s).slice(0, 500).join("")`).
- **[med] Length checks count UTF-16 units, the server counts code points.** `csvParse.ts` `parseBoundedText` and the review check (~line 433/549) use `.length`, so a review, platform or `watched_tz` within the server's `max_length` but heavy in emoji is dropped on restore. Fix: compare `[...s].length`.
- **[med] Watchlist clamp runs during a watched reload.** `WatchlistPage.tsx:381`: the `!watchedLoading` guard was removed; `hasLoaded` stays true during a reload, so with the Watched/Unwatched filter on, the clamp moves `?page=3` back using the old watched set and doesn't return when the reload lands.
- **[med] Watched-history LoadError's Retry gives no feedback.** `WatchlistPage.tsx:393`: `useWatched.reload` doesn't clear `error` when it starts and the LoadError branch is checked before the skeleton, so Retry shows the same error screen for the whole retry, and each click starts another full `fetchAllPages` of the history. Fix: show the skeleton while the watched hook is loading, LoadError only once settled with an error.
- **[med] `lookupImportPosters` doesn't dedupe by (type, mediaId).** `importPosters.ts:603`: a backup restore passes watchlist + watched + every list together, so a title in several sections gets one paced lookup per section (~90/min); a 300-title library repeated across two sections doubles restore time and `tmdb_proxy` use. Fix: look up each unique key once and fan the result out.
- **[low] "Saved without a poster" counts per section.** `CSVImportAllModal.tsx:94` counts over the combined rows, so one poster-less title in watchlist, watched and two lists reports "4 saved without a poster". Falls out of the dedupe fix.
- **[low] Restore drops `added_at`/`rated_at` later than the device clock.** `csvParse.ts:515` `parseBackupCSV` now runs them through `normalizeWatchedAt`, which rejects future times; with a few minutes of clock skew, the last items before export lose their time and get the restore time, changing their order in a round trip.
- **[low] Person tab title disagrees with the heading on an empty body.** `PersonPage.tsx:302`/`312`: a 200 with a null/empty body leaves `person` null and `error` null; the page renders LoadError "Failed to load this person" (`error || !person`), but `detailPageTitle` sees no error and titles it "Person". Movie/TV render a blank page in the same state.
- **[low] Lookup merge rule rests on undefined vs 0.** `importPosters.ts:617` merges the poster with `||` and the score with `??`; a backup's 0 score counts as given, so a future caller passing 0 to mean "unknown" silently skips the lookup. `ImportRow`'s type doesn't document the contract.
- **[low] `setProgress(null)` after sign-out.** `CSVUploadModal.tsx:54` clears progress after the lookup without checking the session guard (only `bulkImport` checks it), against the no-`set*`-after-sign-out rule. Little visible effect.

## Ninth review (2026-10-16): item 44

A `/code-review` pass after `fix-titles-import-rules` (item 43, uncommitted), asked whether the project is complete. Read-only: no finding was reproduced or run yet, so re-check each before fixing.

### 44. Item 43 follow-ups (frontend) (✅ archived 2026-10-16, `openspec/changes/archive/2026-10-16-fix-library-backup-edges`, specs synced into accessibility, data-backup, load-states; 15/15, Jest 502 pass; all six confirmed against the code; decided: a backup row's blank or bad score stays 0 and is never looked up; the id-change finding turned out not to happen in the app, since `App.tsx` keys `<Routes>` on the pathname, so only a comment and a behavior test were added)

- **[med] Watchlist error branch fires on a failed background reload (regression from 43).** `WatchlistPage.tsx:241` checks only the watched history's `error`. A reload that fails after a successful load sets `error` but keeps the loaded list, so with the Watched/Unwatched filter on, one transient 5xx replaces a correctly filtered grid with "Couldn't load your watched history". Fix: show it only when the watched data never loaded (error and no successful load this session); a failed background reload keeps the grid, as load-states' "Background refresh fails after a successful load" requires.
- **[low-med] Watchlist filter still guesses while the watched history loads.** Same branch: with the filter on and the watched load pending, `isWatched()` is false for every title, so "Watched" shows "No items match your filters." and "Unwatched" lists everything until it arrives. The clamp already treats `watchedLoading` as not ready; the render doesn't. Fix: a loading placeholder in that state.
- **[low-med] Backup restore still fails a whole chunk on other bad cells.** `csvParse.ts` `parseBackupCSV` bounds only poster and score (43). A negative or non-integer `runtime_minutes`, a `platform` over 100 chars, a `watched_tz` over 64, a `user_rating` out of range or off the half-step, a `watched_at` before 1900 or in the future, or a `title` over 500 is sent as is; the serializer rejects it and `bulk_import` drops the whole 500-row chunk. `parseCSVForImport` already bounds runtime, platform and watched time (`MAX_RUNTIME`, `MAX_PLATFORM_LENGTH`, `normalizeWatchedAt`): extract per-column helpers next to `parsePosterPath`/`parseScore` and use them in both readers, dropping a bad value for that row only.
- **[low] A backup row's missing or bad score is never looked up.** `parseBackupCSV` turns a blank, absent or invalid `vote_average` into 0, so `lookupImportPosters` counts the score as given and a row with a poster keeps 0 for good. `enrichPosterPaths`' comment ("A backup row always has a score") holds only because of this. **Decide first:** leaving it undefined sends those rows to TMDB (paced ~90/min, so a 2,000-row v1 backup could take ~22 min), versus keeping 0.
- **[low] An empty TMDB name is announced as a failure.** `detailPageTitle` (`usePageTitle.ts`) returns the error heading whenever `name` is falsy; a record that loaded with `title: ""` renders normally but is titled "Failed to load movie details". Fix: failed heading only on `error`; a loaded record without a name gets the generic title.
- **[low] Stale title and frame when the route id changes on a reused page.** `PersonPage.tsx` (same in Movie/TV detail pages): going from `/person/1` to `/person/2` renders once with the new id, the old record and `loading` false, so the previous name is emitted as settled and the old content flashes until the effect sets `loading`. The announcer's settle delay usually hides it. Was there before 43. Fix: key the page on `id`, or derive loading from a `loadedId !== id` check.
- Checked and dismissed: `missing` counting final null posters (decided in item 42, not a regression); `found[i]!` non-null assertions in the three import dialogs (style; `lookupImportPosters` always returns one entry per row).

## Eighth review (2026-10-16): item 43

A `/code-review` pass over the repo after 0.28.1 (`69aae85`); in practice it covered mostly the 0.28.1 code. Read-only: no finding was reproduced or run yet, so re-check each before fixing.

### 43. 0.28.1 follow-ups (frontend) (✅ archived 2026-10-16, `openspec/changes/archive/2026-10-16-fix-titles-import-rules`, specs synced into accessibility, data-backup, load-states; 16/16, Jest 491 pass; also fixed a pre-existing `import.spec.ts` restore-wait flake; checked against the code: null-score re-lookup is a false positive (`vote_average` non-null, default 0), region-kept platform is intended (mark-watched spec), nested `usePageTitle` unmount has no current trigger)

- **[low-med] A bad id titles the page "Movie", not "Page Not Found".** `MovieDetailPage.tsx:21` (same in `TVDetailPage.tsx`, `PersonPage.tsx`): React runs child effects first, so `NotFoundPage` emits its title, then the parent's own `usePageTitle("Movie", { loading: false })` overwrites it. `/movie/..%2F` gets tab title and announcement "Movie · CINE DB". The 0.28.1 comment "NotFoundPage names itself" assumes the opposite order. Fix: the parent skips its title when `id === null` (or passes the not-found name itself).
- **[low-med] A not-found or failed load announces the generic title.** `MovieDetailPage.tsx:75`: when loading ends with `movie` still null (TMDB 404, error), the final title is "Movie" while the page shows "Movie not found" / the error. Same for TV and Person. Fix: pass the shown state's name ("Movie not found", "Couldn't load movie") once settled without data.
- **[low-med] Watchlist clamp never runs while the watched load has an error.** `WatchlistPage.tsx:554`: `filterReady` stays false while `watchedError` is set, so `/watchlist?page=3` with the watched filter stays on a blank out-of-range page until a retry succeeds (before 0.28.1 the clamp ran). Fix: treat an errored watched load as settled for the clamp (or skip the clamp but show the error).
- **[low] Backup restore: one oversized `poster_path` fails the whole chunk.** `csvParse.ts:271` `parseBackupCSV` has no 500-char (or leading `/`) check, unlike `parseCSVForImport` since 0.28.1; the serializer's `max_length=500` makes `bulk_import` reject the 500-row chunk. Fix: the same per-row drop.
- **[low] List CSV import ignores the file's poster and score.** `CSVListImportModal.tsx:77` looks up every row and writes the lookup over the file's values, against CLAUDE.md's import rule; importing the Watched export into a list costs ~900 paced lookups (~10 min), and a failed lookup replaces the file's values with null/0.
- **[low] Rows with a null score are looked up on every re-import.** `WatchedPage.tsx:98` exports a null `voteAverage` as an empty cell, so `CSVUploadModal` (`row.voteAverage === undefined`) sends those rows to TMDB each round trip. Fix: skip on poster alone when the file has a `vote_average` column, or export a sentinel.
- **[low] Mark as Watched keeps a platform the new region doesn't offer.** `MarkWatchedModal.tsx:130`: a region change while open recomputes options but keeps `platform`, so the Select shows a value outside its options and Confirm saves it. Fix: clear `platform` when it's no longer an option ("Other" text kept).
- **[low] A nested `usePageTitle` unmount clears its parent's title.** `usePageTitle.ts`: the cleanup broadcasts `null` and resets `document.title` for every caller, so when a nested caller (e.g. `NotFoundPage` under a detail page) unmounts, the tab shows plain "CINE DB" and a pending announcement drops; the parent's deps are unchanged, so it never re-emits. Fix: one title owner per route, or a stack the cleanup pops.
- **[structure] Three importers, three lookup rules.** `CSVUploadModal.tsx:45` skips rows with poster+score, `CSVImportAllModal.enrichPosterPaths` skips on poster only, `CSVListImportModal` skips nothing. Move "skip covered rows, file values win" into `lookupImportPosters` (`src/utils/importPosters.ts`) so all three follow it; this fixes the list-import and null-score items with it. Related nit: `vote_average` has two parsers in `csvParse.ts` (`parseCSVForImport` range-checks and leaves it unset; `parseBackupCSV` uses `parseFloat(...) || 0`).

## Seventh review (2026-10-15): item 42

A `/code-review` pass over the 0.28.0 commit (`acc1492`). Read-only: no finding was reproduced or run yet, so re-check each before fixing.

### 42. 0.28.0 follow-ups (frontend) (✅ archived 2026-10-15, `openspec/changes/archive/2026-10-15-fix-a11y-import-followups`, specs synced into accessibility, data-backup, library-filters, load-states, mark-watched; 20/20, Jest 469 pass; all findings confirmed against the code, plus Calendar's jump-to-date smooth scroll)

- **[med] Certification can crash the movie detail page.** `MovieDetails.tsx:65` `renderCertifications` now calls `c.release_dates.find(...)` on every country entry (not only US), and `resultsOf` checks only that `results` is an array. One entry with a missing/null `release_dates` throws during render → ErrorBoundary for the whole page, against the appended-part rule ("a malformed part empties only its section"). Fix: `arrayOr(c?.release_dates, [])`.
- **[low-med] Route announcer can speak a stale or generic title.** `RouteAnnouncer.tsx:41` announces a fixed 1 s after the pathname change, then clears `pending`. A lazy route on a slow connection can announce the previous page's title (the old page's unmount sets `document.title` without notifying); a detail fetch over 1 s announces "Movie · CINE DB" and the real name never. Fix: keep waiting until the new route's page sets its title (or restart the settle timer on each title change).
- **[low] Route announcer announces the first load under StrictMode.** `RouteAnnouncer.tsx:40`: the `first` ref is consumed by the first effect run, so StrictMode's replay sets `pending` and the initial title is announced in dev (spec: "the initial load isn't a navigation"). Production is fine, which hides it from dev-time Playwright checks.
- **[low-med] Watchlist page clamp runs before watched data loads.** `WatchlistPage.tsx:121` waits only for the watchlist, but the watched-status `extraFilter` reads `WatchedContext`. Reloading `/watchlist?page=3` with the "Watched" filter restored: `filtered` is empty until watched data arrives, so the clamp replaces the URL with page 1 for good. Fix: also wait on the watched list's loading state.
- **[low] Region change while Mark as Watched is open resets the runtime.** `MarkWatchedModal.tsx:86`: `userRegion` is a dep of the fetch effect, which also calls `form.setFieldsValue({ runtimeMinutes: prefillRuntime(...) })`. A region change (e.g. another tab writing `cinedb_region`) overwrites the user's edited runtime. Fix: recompute only the platform options on a region change.
- **[low] Oversized CSV `poster_path` fails the whole chunk.** `csvParse.ts:224` accepts any value starting with `/`; the serializer has `max_length=500`, so one long value 400s the batch, unlike runtime/platform which drop per row. Fix: drop values over 500 for that row.
- **[low] Recharts ignores reduced motion.** `StatsPage.tsx:533`: Pie/Bar/Area animate in JS, so neither `MotionConfig` nor the CSS rule reaches them. Fix: `isAnimationActive={!reduceMotion}` on each series.
- **[low] Page change smooth-scrolls under reduced motion.** `WatchlistPage.tsx:344`, `WatchedPage.tsx:264`: `window.scrollTo({ behavior: "smooth" })`; the CSS `scroll-behavior: auto` doesn't override an explicit JS behavior. Fix: `behavior: reduceMotion ? "auto" : "smooth"`.
- **[low] Re-importing the app's own Watched export looks up every row.** `CSVUploadModal.tsx:80` runs the paced poster/score lookup for all rows though the export now carries `poster_path` (and already `vote_average`): ~10 min for 900 rows. Fix: read `vote_average` in `parseCSVForImport` and look up only rows missing both.
- **[nit]** Watchlist and Watched pagination are near copies (`PAGE_SIZES`, param reads, clamp, `buildFromUrl`, `Pagination`) and already differ slightly. CLAUDE.md defers a shared hook to a third caller; fine to leave.

## Performance (2026-10-10): item 26

The user reported that every page had become very slow under `npm start` (dev), on every page, starting recently. There were two read-only passes over the code, plus the user's DevTools Network capture of a Home load (XHR filter only). No timings were taken on the server side. ✔ = seen in the capture.

**Capture, Home after a reload:** `watched/?page=1…13` ran one after another at 92–330 ms each (one 1.28 s outlier on page 6), about 3.3 s in total for about 1,300 entries. lists/ratings/watchlist/new-releases took 205–292 ms. TMDB proxy calls took 355 ms–1.14 s. `trending/movie/week` was fetched twice per mount. There were 212 requests and 28 MB of resources (3.6 MB transferred), plus YouTube `atr` beacons from trailer iframes.

**Open questions:**
- Do the TMDB proxy calls get CORS preflights? 0.20.0 (`harden-deploy-2`, F6) added `Authorization` to them, and dev is cross-origin (:3000 → :8000), so each new URL would need an `OPTIONS` first. The capture was XHR-filtered, which hides preflight rows. Re-check with the **All** filter. If so, this is the "started recently" regression.
- What caused the 1.28 s spike on watched page 6? Possibly a recommendations refresh or metadata backfill in the same `runserver` process.

### 26. `speed-up-pages` (frontend + backend) (✅ archived 2026-10-10, `openspec/changes/archive/2026-10-10-speed-up-pages`)

**Round 1 (from the capture):**
- **[high] ✔ Library loads are sequential pages of 100.** `fetchAllPages.ts:8` awaits each page before asking for the next (`PAGE_SIZE`/`page_size` 100, `max_page_size` 200; `settings.py:175`, `pagination.py:5-6`). A 1,300-title watched history costs 13 round trips (about 3.3 s) on every full reload, before Home's Recently Watched strip and the watched badges are right. Fix: a larger page size for library lists, or page 1 then the rest in parallel from `count`. Keep the `-id` tiebreaker. This touches item 21's `fetchAllPages` test gap.
- **[high] ✔ Each Django API call takes 100–330 ms on localhost.** That's high for 28 kB of JSON from the same machine. `CONN_MAX_AGE` is unset (`settings.py:99-114`), so every request opens a new Postgres connection. On Windows, Postgres starts a new backend *process* per connection, plus SCRAM auth, and `DB_HOST=localhost` may try `::1` first. **Correction from round 2:** `CONN_MAX_AGE` doesn't help under `runserver`, which starts a new thread per request (Django docs: persistent connections are negated in dev). It only helps gunicorn in Docker. For dev, this needs Django 5.1+'s connection pool (`OPTIONS: {"pool": True}`), which requires psycopg 3. The project pins `psycopg2-binary==2.9.9`, so that's a dependency swap (requirements + constraints). Measure first: time one request with `connection.queries` / `django.db.backends` logging, connect vs query.
- **[med] ✔ The TMDB proxy caches nothing.** `tmdb_proxy_views.py:65` forwards every GET. Trending, genres, details and credits are refetched on every visit, at 0.35–1.1 s each. Fix: a server cache keyed by path + params, with a short TTL for lists and trending and a long one for details, genres and credits. Cache only 2xx, on the request thread (the CLAUDE.md worker-thread rule), and mind `DatabaseCache`'s `MAX_ENTRIES` cull (item 0) in Docker.
- **[med] ✔ HeroBanner fetches trending twice under StrictMode.** `HeroBanner.tsx:24-47` has a `cancelled` flag but no replay guard, so dev sends 2 calls for its slowest request. Dev-only (also logged under item 7). It doubles proxy throttle use in dev.
- **[med] ✔ Trailers load eagerly.** `MovieDetails.tsx:336-354`, `TVShowDetails.tsx:~486`: every trailer is a live `youtube-nocookie` `<iframe>` on render, with no `loading="lazy"`. Each loads the YouTube player (about 1 MB of JS plus its own main-thread work) and beacons, even off screen. Fix: a thumbnail (`i.ytimg.com`, which needs a CSP `img-src` entry) that swaps in the iframe on click, or at least `loading="lazy"`.
- **[info] `npm start` is the CRA dev build** (unminified, StrictMode double render and effects). Judge final numbers against `npm run build`.

**Round 2 (code read):**
- **[high] Detail pages make 5–6 TMDB calls and render only after the slowest.** `MovieDetailPage.tsx:39-46` uses `Promise.allSettled` over details, reviews, similar, providers and release_dates. `TVDetailPage.tsx:41-46` does details, credits, aggregate_credits, images, providers and reviews (credits and aggregate_credits overlap). The skeleton stays up until the slowest one, even a non-essential review call, and StrictMode doubles it in dev (10–12 proxy calls). TMDB's `append_to_response` takes up to 20 sub-requests, so `reviews,similar,watch/providers,release_dates` (TV: `aggregate_credits,images,reviews,watch/providers,content_ratings`) can fold into the one details call: 1 round trip, 1 throttle tick, and one cache key once the proxy caches. Fix it together with the proxy cache.
- **[med] Backdrops load at `original` size.** `BACKDROP_URL = .../t/p/original` (`constants/ui.ts:15`) is used for the Home/Anime hero (`HeroBanner.tsx:79`) and the detail hero (`MovieDetails.tsx:99`, `TVShowDetails.tsx:98`). Originals are often 3840×2160 at 1–5 MB, for a box at most about 1400 px wide. The hero `<img>` is also `loading="lazy"` though it's above the fold (also logged under item 19), which delays LCP. Fix: `w1280` for heroes; keep `original` only for the gallery preview (`preview.src`).
- **[low-med] Grid posters use `w500`.** `IMG_URL` is used by every card grid (`Movie.tsx:46`, `TVShowCard.tsx:45`, `MediaCardGrid.tsx:38`, `LibraryItemCard.tsx:39`, `PersonCard.tsx:48`, …) for posters shown about 150–220 px wide. `w342` is about half the bytes and still sharp at 1.5× DPR. Keep `w500` for the detail poster.
- **[low-med] `App` subscribes to all four data contexts.** `App.tsx:40` reads only `theme`/`clearGenres` through `useAppContext()` (`context/useAppContext.ts:13-18`), which `useContext`s UI, Watchlist, Watched and Ratings. Each library load (4 × `isLoading`/data updates at boot) and every later toggle re-renders `App` and its whole route tree, with framer-motion and antd inside. Fix: read `UIContext` directly in `App` (and in other components that need only UI state).
- **[low] Watched list ordering has no matching index.** `watched_views.py:19` `filter(user).order_by("-watched_at", "-id")` with OFFSET pagination plus a `COUNT(*)` per page; the only index is `unique_together(user, media_id, media_type)`. That's negligible at about 1,300 rows but grows per page. An index on `(user, -watched_at, -id)` would fix it. Same pattern on watchlist and ratings.
- **Checked, fine:** routes are `lazy()`-split (`App.tsx:17-36`); `WatchedPage` paginates at 48 per page; `isWatched` is a linear scan, but cheap at this size.

**Round 3 (measured 2026-10-10).** A throwaway `verify_perf.py` (now deleted) ran against the running `npm start`. It used a throwaway account (deleted afterwards) with an empty library, Python `requests`, and headless Chromium with CDP network timing.

| What | Result |
|---|---|
| Postgres connect + `SELECT 1` (psycopg2), `localhost` / `127.0.0.1` | 52 / 49 ms median: no IPv6 penalty on the DB side, but ~50 ms per Django request (no pooling) |
| `GET /api/health/` via `localhost:8000` / `127.0.0.1:8000` | **2,038 ms / 5 ms** |
| Empty `watchlist/?page=1` with JWT via `localhost` | 2,104 ms (≈ 65 ms server, ~50 of it the DB connect) |
| Preflight `OPTIONS` (warm) | 10–30 ms, `max-age=86400`, but one per new URL |
| `/movies` in browser (skeleton gone + idle) | 4.5 s |
| `/movie/550` title visible / network idle | 3.1 s / 5.6 s |

- **[high] ✔ `localhost` costs every new connection a fallback from IPv6 to IPv4.** `localhost` resolves to `::1` first here (`ping localhost` → `[::1]`). `start.py:50` binds `runserver 0.0.0.0:8000`, which is IPv4 only (bound since 2347399, 2026-04-11). Both API clients use `http://${window.location.hostname}:8000` (`userApi.ts:6-7`, `tmdb.ts:22`).
  - Python waits about 2 s on the refused `::1` before falling back.
  - Chromium races the two (Happy Eyeballs), so it costs about **300 ms per new connection**: the first 5 boot connections showed `connect` 312–315 ms. Later requests reuse keep-alive connections.
  - Fix options: point the dev client at `127.0.0.1` (env or a `localhost` → `127.0.0.1` mapping); bind dual-stack; or use **CRA's dev `proxy`** to `http://127.0.0.1:8000`. The proxy also makes calls same-origin, which removes every preflight (next bullet). Any of these must keep LAN access (`ALLOWED_HOSTS` `*` under DEBUG) and Docker (nginx, same-origin) unchanged.
- **[med] ✔ Every API call is preflighted in dev.** 18 `OPTIONS` came from 2 page loads, covering `userApi` calls as well as TMDB calls. `Authorization` already forced a preflight for `userApi`, and since 0.20 (F6) it does for TMDB too. Chrome caches a preflight per URL, so every new movie id, page number or filter pays one. Each is cheap once the connection is warm (10–30 ms), but each takes a slot under the 6-connections-per-host limit. The dev proxy removes them; prod is same-origin behind nginx and has none.
- **[med] ✔ StrictMode doubles every detail call, and the copies queue.** `/movie/550` sent each of its 5 TMDB calls twice. The second batch waited 590–1,330 ms in the browser queue (`sendStart`) behind Chrome's 6-connections-per-host limit (HTTP/1.1, `runserver`). The `cancelled` flag in `MovieDetailPage.tsx:34` drops the first result but doesn't stop the request. Dev-only, but it is most of the 3.1 s to first paint there. `append_to_response` (round 2) shrinks it to 2 calls.
- **[med] ✔ TMDB latency through the proxy is 400–1,330 ms per call** under that concurrency (`wait` = time to first byte). It's about 320 ms alone when sequential. The page renders only after the slowest call (round 2).
- **[info]** The library endpoints answer an empty list in 130–220 ms of server time in the browser (concurrent), about 65 ms when sequential. So the 92–330 ms per watched page in the user's capture is mostly the ~50 ms DB connect plus the 300 ms connect penalty on cold connections, and serialization of the 100 rows.

**Suggested order:** fix `localhost`/proxy (dev; largest, cheapest) → measure the DB-connect share → fold detail-page calls into `append_to_response` → proxy cache → library page size / parallel → image sizes + lazy trailers → `App` context split → (dev) psycopg 3 pool.

**Proposed 2026-10-10 as `speed-up-pages`:**
- **Covers:** the dev same-origin proxy, one-request detail pages, in-flight TMDB sharing (which also removes the HeroBanner StrictMode double), the proxy cache, page size 500, image sizes, on-demand trailers, the `App` context split, and prod `CONN_MAX_AGE`.
- **Left here, not in that change:** a psycopg 3 connection pool for dev (~50 ms DB connect per request under `runserver`), a `(user, -watched_at, -id)` index, and parallel library page fetching.
- **Manual step:** a local root `.env` with `HOST=0.0.0.0` keeps CRA IPv4-only (~200 ms per new connection to `localhost:3000`). Set `HOST=::` (`.env.example`).

**After `speed-up-pages` (re-measured 2026-10-10, same method).** The throwaway account (deleted afterwards) had 1,300 seeded watched entries this time.

| What | Before | After |
|---|---|---|
| `OPTIONS` preflights per page | 18 over 2 loads | 0 |
| Home: watched requests for 1,300 entries | 13 (sequential, ~3.3 s) | 3 (`page_size=500`) |
| `/movies` skeleton gone / network idle | 4.5 s | 0.6 s / 2.0 s |
| `/movie/550` TMDB calls | 10 (5 × StrictMode) | 1 |
| `/movie/550` title / network idle, first visit | 3.1 s / 5.6 s | 1.8 s / 3.6 s (`X-Cache: MISS`) |
| `/movie/550` title / network idle, repeat visit | n/a | 1.8 s / 2.2 s (`X-Cache: HIT`) |

Python hitting `localhost:8000` directly still pays the ~2 s IPv6 fallback, but the app no longer does (it calls same-origin through the CRA proxy). The repeat visit's title time is mostly the dev bundle, not the network.

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
- 2026-10-26 security review (whole tree, 0.30.0):
  - authz: every object lookup scoped to `request.user`; list items only via an owned list; `bulk_import` owner scope; no writable `user`/owner/list FK in any serializer; `UserSerializer` (email, `is_staff`) only returned to its own user; `AllowAny` only on auth, TMDB proxy and health
  - TMDB proxy: host/scheme from env, client `api_key` stripped, server never attaches a user's TMDB session, session/account paths uncached, GET-only
  - TMDB connect: request token per user, single use, `hmac.compare_digest` (no forced account linking)
  - JWT: `CHECK_REVOKE_TOKEN` also on refresh; prod refuses default `SECRET_KEY`; email/username/password change and account deletion need `current_password`
  - password reset: link from `FRONTEND_URL`, not `Host`; same response for unknown email, mail sent in background; 1 h token
  - injection: raw SQL only in `_login_failure_*` and `insert_ignoring_conflicts`, values parameterized, identifiers constant/model-derived; no eval/pickle/yaml; no subprocess fed by user input
  - uploads: avatar type from PIL decode + re-encode; `/media/` serve has no traversal, `nosniff`
  - frontend: no `dangerouslySetInnerHTML`/`innerHTML`/`eval`; external links via `safeHttpUrl` or fixed templates; CSV export formula-escaped; stored text only shown to its author
  - config: `ALLOWED_HOSTS` fail-closed, CORS wildcard only under `DEBUG`, bearer tokens (no cookies), admin removed, JSON-only renderer in prod, nginx CSP `script-src 'self'`, token URLs redacted in access logs
