# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.31.0] - 2026-10-30

Database-layer fixes from the 2026-10-28 review (`fix-db-layer`, backlog item 48), TMDB sessions encrypted at rest (`encrypt-tmdb-session`, split out of item 48), and one shared movie/TV card (`merge-media-cards`). All three OpenSpec changes are archived and their specs synced (`account-security`, `api-hardening`, `recommendation-refresh`, `service-health`; the card merge is a refactor with no spec change). Migrations 0030–0032; new dependency `cryptography`. A 2026-10-26 `/security-review` of 0.30.0 found nothing. There are no open backlog items.

### Breaking
- **`TMDB_SESSION_KEYS` is required with `DEBUG` off.** Add it to `.env.docker` before upgrading (generator and steps in README, "Upgrading an existing deployment"). Migration 0031 then encrypts the stored sessions in place and connected users stay connected; `migrate userdata 0030` decrypts them again for a rollback.

### Security
- **TMDB `session_id` encrypted at rest** (`EncryptedSessionField`, Fernet through `MultiFernet`, `userdata/secret_fields.py`). Its own key list, not `SECRET_KEY`: the first key encrypts, all decrypt. Under `DEBUG` a key derived from `SECRET_KEY` is added last, so dev needs no setup. A value no key can read comes back blank, i.e. "not connected", and only the exception type is logged. New `rotate_tmdb_sessions` command re-encrypts every row under the first key, in one bulk update.

### Fixed
- **Per-user list indexes are back.** Migration 0008's `(user, date)` indexes lived only in a migration, so 0009 dropped them as drift. Watchlist, Watched, Ratings, Lists, followed people and episode progress now declare `(user, -<date>, -id)` in `Meta.indexes` (migration 0030), matching each view's `order_by`; `EXPLAIN` on the dev DB shows an index scan with no sort.
- **A user's first recommendations save can no longer be overwritten by an older compute.** `select_for_update` locked nothing when no row existed yet; saves now take a per-user advisory lock, so the compute that started last wins on the first save too.
- **Password reset is all-or-nothing.** Setting the password, revoking refresh tokens and clearing login failures run in one transaction; a failure keeps the old password and the link stays usable.
- **Deleting an account or renaming it clears the old username's login-failure count,** so whoever registers that name next doesn't start rate limited.
- Two stale comments (`LoginFailure` key, `OutstandingToken` flushing) now match the code.

### Added
- **`prune_media_cache` startup step** (`start.py` and the Docker entrypoint, best-effort, 60 s): deletes `TMDBMediaCache` rows older than `CACHE_TTL_DAYS` that no watched entry uses; watched titles' stale rows stay as the outage fallback. A `(media_id, media_type)` index on `WatchedEntry` (migration 0032) keeps its "is anyone watching it" check cheap.

### Changed
- **One poster card for movies and TV:** `Movie.tsx` and `TVShowCard.tsx` are replaced by `MediaCard.tsx`, fed through `toMediaSummary(item, type)` (`src/utils/mediaSummary.ts`) by the Movies/TV/Anime grids and Search's Movies/TV tabs. Same DOM, labels, links and toasts. Its watched/watchlist writes are explicit add/remove, never toggle, and Home/Anime/Search pass a stable `onKnowMore`, so the memoized cards skip re-rendering when a page appends.

### Fixed (CI)
- **The TypeScript e2e job no longer runs out of time.** At 412 tests on one worker, the suite outgrew the job's 15-minute cap, and the 0.28.2, 0.29.0 and 0.30.0 runs were cancelled before it finished, with no report uploaded (the upload ran only on `failure()`). It now runs as 3 shards on separate runners; Playwright's `globalTimeout` (12 min on CI) fails a slow shard with its report before the job cap, and the report also uploads on cancel (`playwright-report-<shard>`). A full local run found no failing test (4 load-induced failures at 4 workers all passed at CI's 1 worker).

### Internal
- `/simplify` pass over the release: one shared comment for the library-list indexes in `models.py`, one label per card action in `MediaCard`, a single empty check in `EncryptedSessionField`.

### Dependencies
- `cryptography` 50.0.2 (pinned in `requirements.txt`, transitive pins in `constraints.txt`).

### Docs
- README (Docker `.env.docker` template, breaking upgrade note, key rotation, component and backend trees, tests), `docs/ARCHITECTURE.md` (why sessions are encrypted with their own key), `CLAUDE.md` (encrypted-session rule, `TMDB_SESSION_KEYS` in the fail-closed list, `Meta.indexes` rule, prune step, `MediaCard`), BUG_BACKLOG (item 48, twelfth and thirteenth reviews; item 47's two product questions moved to ideas.md), ideas.md, features.txt.

### Tests
- `test_list_indexes.py` (every library list's `order_by` has a matching index), `test_prune_media_cache.py`, `test_tmdb_session_encryption.py` (stored token, blank, removed key → disconnected with nothing logged, rotation and command, migration forward/rerun/reverse, connect/status/rating with an unreadable session), reset atomicity and deleted or renamed account failures in `test_account_security.py`, first-save race in `test_rec_quality.py`, `TMDB_SESSION_KEYS` in `test_settings_fail_closed.py`, warm-up order in `test_startup_warmup.py`.
- Jest: `mediaSummary.test.ts`, `MediaCard.test.tsx`.
- Totals: backend pytest 616 pass. The Docker image build with the new wheel is checked only by CI's `docker` job.

## [0.30.0] - 2026-10-21

The Episode Guide stops spoiling episodes you haven't reached (`spoiler-shield`, archived; new `spoiler-shield` spec). Frontend only: no backend, API, migration or dependency changes.

### Added
- **Spoiler shield:** for a show you track and haven't marked watched, the Episode Guide hides the title, still and overview of every episode after your progress. The tracked episode and earlier ones show as usual, specials are never hidden, and air date, runtime and score stay visible. Hidden content is left out of the page (not blurred), so screen readers can't read it and the still isn't downloaded.
- **"Show details for episode N"** reveals one episode; it stays revealed across season switches while you're on the page.
- **"Hide spoilers" switch** in the guide, shown where the shield applies, remembered on the device like the theme.
- **The guide opens on your current season** when you track the show. A later Next Episode or Edit re-applies the shield but never moves the season you're viewing.

### Changed
- The guide waits for your episode progress before showing episodes, so it never flashes one it would hide; the first season is requested meanwhile, so it costs no extra round trip, and retrying a failed progress load keeps the list on screen. If progress fails to load, it shows every episode with a note that spoilers aren't hidden.

### Fixed
- `useEpisodeProgress` reported "not loading" on the render before its request started, which read as "no progress" for a moment (backlog 46). Loading is now derived from the last settled show and retry, like the library hooks.

### Internal
- `PosterPlaceholder` takes optional `children` (default "No Image") and `aria-hidden`; the guide's hidden still reuses it.

### Docs
- BUG_BACKLOG item 47 (review of this release: early first-season fetch, Retry keeps the list, shield rule inlined, scoped e2e switch; hidden-row score and specials left for a decision).
- README (Episode Guide feature, tree, tests), `docs/ARCHITECTURE.md` (why hidden content is absent and why the guide waits), `CLAUDE.md` (spoiler-shield convention), features.txt, ideas.md (item 1 done), BUG_BACKLOG item 46.

### Tests
- `spoilerShield.test.ts` (`isEpisodeHidden`), `EpisodeGuide.test.tsx` (hidden content absent and no still, reveal one, reveal survives a season switch, switch off persists, no switch without progress or when watched, shows nothing while progress loads and shares the early first-season request, Retry keeps the list, error note, opens on tracked season, progress change keeps the viewed season), `useEpisodeProgress` loading on the first render.
- Python e2e: a later episode hidden at S1E1 and shown after "Show details".
- Totals: Jest 547 pass; Python `test_detail.py` 26 pass (before the review fixes, which changed only that file's switch locator). Checked in the real app (dark, light, phone width).

## [0.29.0] - 2026-10-17

The account pages get the CINE DB look (`pilot-login-redesign`, then `auth-pages-identity`; both archived, specs synced into `login-page`, new `auth-pages` and `theme-readability`). Frontend only: no backend, API, migration or dependency changes.

### Changed
- **Sign in, Create account, Forgot password and Reset password share one stage:** a gold projector beam falling onto the form's card, the "CINE DB" wordmark as the page's heading and a one-line tagline. Forms, buttons, links, messages and tab titles are unchanged. The beam fades up once and doesn't animate under reduced motion.
- **Primary buttons have dark text on gold** (white measured about 1.6:1), and **links are gold in dark mode and brass in light mode** instead of antd's blue, everywhere in the app.
- **The sidebar's "CINE DB" is the same wordmark,** brass in light mode, where the gold measured 1.5:1 on cream. It takes slightly less height than before.

### Fixed
- The light-theme "No Image" placeholder text reaches 4.5:1 (it measured 4.26:1).
- **The sign-in page no longer scrolls on phones.** Pages were sized to `100vh`, which on mobile browsers is taller than the screen with the address bar shown; the shell and the account-page stage now use `100svh` (with `100vh` as the fallback), and the stage's spacing tightens on short screens so sign-in fits at 320×568.
- **The account pages adapt to the screen's height.** Spacing and the wordmark scale with it; on short screens the tagline goes, and on very short ones the header is hidden (kept for screen readers) and the card tightens. While an account page is open, an Android keyboard shrinks the page instead of covering it (`interactive-widget=resizes-content`, set by `AuthStage` only, so the bottom nav elsewhere is unaffected), so sign-in fits above the keyboard down to about 330px of space. Safari ignores this and still scrolls the focused field into view. Create account's longer form still scrolls on short screens.
- After a failed sign-in, focus returns to the password field reliably (it could fire before the field was re-enabled).

### Docs
- `CLAUDE.md`: Wordmark, AuthStage, link/button tokens and the scoped keyboard viewport setting; `LINK_BRASS` in the shared constants. README and features.txt updated.

### Tests
- `themeContrast.test.ts` pins link colors (rest, hover, active) and the primary button's text on gold, hover and active. `AuthStage` and `Wordmark` unit tests.
- e2e: contrast of every text on each account page in both themes, the sidebar wordmark (full and rail), the primary-button text and a link on signed-in pages; 320px fit, reduced motion, the signed-in reset page above the bottom nav, sign-in with no vertical scroll from 844 down to 330 px tall (keyboard-sized), the keyboard viewport setting only on account pages, and no sidebar scrollbar at 1366×768 on browse pages.
- Totals: Jest 528 pass; touched Playwright specs (theme-readability, auth, responsive) 158 pass; Python `test_auth.py` + `test_a11y_routing.py` 38 pass.

## [0.28.2] - 2026-10-16

Follow-up fixes from three code reviews of 0.28.1 and its own follow-ups (`fix-titles-import-rules`, `fix-library-backup-edges` and `fix-restore-text-edges`, backlog items 43–45). All three OpenSpec changes are archived and their specs synced. Frontend only: no backend, API, migration or dependency changes. There are no open backlog items.

### Fixed
- **Detail and person pages title what they show.** The tab title (and the screen-reader announcement) is "Page Not Found" for an invalid id, the page's not-found heading for a 404, and its error heading for a failed load, instead of the generic "Movie · CINE DB". A request that succeeds with an empty body now shows the error state with Retry, titled to match, instead of a blank or nameless page. A record TMDB gives no name keeps the generic title.
- **The Watchlist's Watched/Unwatched filter never shows a grid built on missing data.** It shows the skeleton while the watched history loads (and while a Retry runs), the error with Retry only when that history never loaded, and keeps the filtered grid when a later background reload fails. The move to the last non-empty page waits for the watched history, including a reload in progress, so a deep-linked `?page=3` isn't reset.
- **One bad cell in a backup no longer fails a whole 500-row batch.** A poster, runtime, platform, time zone, personal rating, time or oversized review the server would reject is dropped for that row only; a title over 500 characters is shortened.
- **Length limits count characters the way the server does.** A cut title never ends in half an emoji (which the database refused, failing the whole batch), and reviews, platforms and time zones full of emoji are no longer dropped as too long.
- **Backup times from a clock slightly ahead are kept.** Times up to 5 minutes past the device's clock are restored as given, the same leeway the server allows.
- **Every import follows the same lookup rule.** The Watched CSV, list CSV and backup imports look up only rows the file doesn't give both a poster and a score, the file's values win, and each title is looked up once however many rows or backup sections carry it. Importing the Watched export into a list makes no lookups, and "N saved without a poster" counts titles, not rows.
- **A backup restore keeps the score it already looked up.** A row without a poster is looked up for it anyway; when its backup score is 0, it now keeps TMDB's score. Rows with a poster are still never looked up for their score.
- **Imports stop changing their dialog once you sign out,** including right after the poster lookups finish.

### Changed
- `useWatched()` exposes `hasLoaded` (a successful load this session), which the Watchlist filter uses alongside `isLoading`.
- `lookupImportPosters` owns the skip, merge and per-title rules for all three importers; `csvParse.ts` has one parser per column (`parseTitle`, `parsePosterPath`, `parseScore`, `parseRuntime`, `parseBoundedText`, `parseUserRating`) shared by both CSV readers, over code-point helpers (`charLength`, `cutChars`).
- `isRecord()` in `src/utils/appended.ts`.

### Tests
- Jest (517): page titles for every detail state (`detailTitles.test.tsx`), the Watchlist filter and clamp across load, retry and reload (`WatchlistPagination.test.tsx`), per-title lookups and the merge rule (`importPosters.test.ts`), backup bounds, code-point lengths and the time leeway (`csvParse.test.ts`), restore scores and per-title lookups across sections, and no dialog change after a sign-out (`importSession.test.tsx`).
- e2e: `import.spec.ts`'s restore waits up to 15 s, covering the client's retry-once pause plus the paced lookups.

### Docs
- `docs/BUG_BACKLOG.md`: items 43–45 logged and archived; two stale "still open" notes corrected.
- CLAUDE.md: detail-page titles, the Watchlist's watched-history states, the import lookup and per-column parsing rules.
- README and features.txt: import and restore behavior, honest load states, new test files.

## [0.28.1] - 2026-10-16

Follow-up fixes from a code review of 0.28.0 (`fix-a11y-import-followups`, backlog item 42). The OpenSpec change is archived and its specs synced. Frontend only: no backend, API, migration or dependency changes. There are no open backlog items.

### Fixed
- **A malformed per-country release-dates entry can't crash the movie page.** The certification reads each entry through the shape guards, so a bad one empties only the Certification cell. It used to throw, and the whole page hit the error boundary.
- **Screen readers hear the new page's real title.** The route announcer waits for the new page to report its title, and on detail, person and list pages until the name has loaded or the load has failed. It no longer reads out the previous page's title or a generic "Movie · CINE DB", and never announces the first page load (StrictMode's dev-only replay included).
- **A deep-linked Watchlist page survives the Watched/Unwatched filter.** The step that moves to the last non-empty page also waits for the watched list, so `/watchlist?page=3` isn't reset to page 1 before that data arrives.
- **Changing the region while Mark as Watched is open keeps the runtime you typed.** Only the platform list is recomputed, and the details aren't fetched again.
- **An oversized `poster_path` in a Watched CSV is dropped for that row only,** like runtime and platform, instead of failing the whole chunk.
- **Reduced motion now covers JS-driven motion too.** Stats' charts don't animate, and Watchlist/Watched page changes and the Calendar's Jump to Today scroll instantly.
- **Re-importing the app's own Watched export makes no TMDB lookups** for rows that already carry a poster and a score, which the export always has. A 900-row re-import used to take about 10 minutes of paced lookups. The file's values still beat the lookup's.

### Changed
- `useScrollBehavior()` (`src/hooks/useScrollBehavior.ts`) is the one place programmatic scrolls get their `behavior` (`"auto"` under reduced motion), replacing three copies of the same check.

### Tests
- Jest: certification with a malformed entry (`renderCertifications.test.ts`), the announcer's settled title and first-load skip, Watchlist's deep-linked page clamp (`WatchlistPagination.test.tsx`), Mark as Watched across a region change, Stats charts under reduced motion (`StatsMotion.test.tsx`), import lookups skipped for covered rows (`CSVUploadModalLookups.test.tsx`), oversized `poster_path` and the `vote_average` column in `csvParse.test.ts`.
- e2e: `import.spec.ts` mocks the TMDB poster lookups, so the import result is a plain success.

### Docs
- `docs/BUG_BACKLOG.md`: item 42 archived.
- CLAUDE.md: page titles with `{ loading }` on list pages too, `useScrollBehavior()` for programmatic scrolls, import lookups only for rows the file doesn't fully cover.
- README and features.txt: reduced motion over charts and scrolls, re-import without lookups, the new hook and test files.

## [0.28.0] - 2026-10-15

Bug-audit release, part 13, which closes the sixth audit (backlog items 35–41 all done): accessibility, motion and page titles (`a11y-motion-titles`, item 37), bounded background load and threaded workers (`bound-background-load`, item 38), and library, region and docs polish (`polish-library-docs`, item 40). All three OpenSpec changes are archived and their specs synced.

### ⚠️ Notes for deploy
- **gunicorn now runs threaded workers** (`--workers 3 --worker-class gthread --threads 8 --timeout 30`, `docker-entrypoint.sh`). Memory stays at three processes; up to 24 requests run at once. Under `gthread`, `--timeout` guards a hung worker rather than a slow request, so the per-endpoint TMDB budgets bound requests. Checked only statically here (gunicorn doesn't run on Windows); the first Docker deploy is the real check.
- **Expired session-token rows are deleted at every start** (`flushexpiredtokens`, capped at 60 s and best-effort in both `docker-entrypoint.sh` and `start.py`). The first start after a long uptime may delete many rows; a timeout or error only logs and startup continues.
- **Dependency bumps:** Pillow 12.1.1 → 12.3.0, requests 2.33.0 → 2.34.2, psycopg2-binary 2.9.9 → 2.9.13 (`requirements.txt` and `constraints.txt`). Django 5.2, DRF 3.16 and gunicorn 23 stay. No migrations.
- **Region setting:** existing users get their browser's region by default. Users outside the US now see their own country's providers and certification, with the US data labelled as such when TMDB has nothing for their country.

### Added — region (`polish-library-docs`, backlog item 40)
- **Where to Watch, the movie certification and Mark as Watched's platform list use your region,** not always the US. It defaults to the device's locale region and can be changed in Edit Profile → Data & TMDB (options from TMDB's watch-provider regions). It's kept per device like the theme, including across sign-out. When TMDB lists nothing for your region, the US data is shown and labelled ("Showing United States availability…", "R (US)").

### Fixed — library and imports (`polish-library-docs`)
- **The Watchlist paginates** like Watched (12–96 per page, page and size in the address); every entry used to render as an animated card at once. Removing the last items on the last page moves back a page.
- **The Watched page's CSV keeps runtime, platform and poster** on export and reads them back on import, so its own export no longer loses them.
- **A CSV file that can't be read says so** ("Couldn't read that file.") in both CSV import dialogs, instead of showing nothing.
- **A backup restore reports a list it couldn't create as failed, even an empty one,** instead of reading as success.
- **A missing list shows "List not found"** (the not-found state detail pages use); a failed load still offers Retry.
- **The For You tooltip describes what recommendations are built from** (your own watches, ratings and follows). It claimed "patterns from similar viewers", which the app never used.

### Fixed — accessibility and motion (`a11y-motion-titles`, backlog item 37)
- **Motion follows the OS "reduce motion" setting:** page transitions, card hover effects and CSS animations stop, the Stats count-up shows the final number, and long titles don't scroll.
- **Every page has its own tab title** ("Watchlist · CINE DB"; detail and person pages use the title's or person's name), and screen readers hear the new title after an in-app navigation, without focus moving.
- **Library card buttons name their title** ("Remove from watchlist: Dune"), so a grid's buttons can be told apart.
- **Sidebar and bottom-nav entries are real links:** a new tab on Ctrl/middle click, one history entry on a plain click.
- **Password fields declare current and new password,** so password managers fill and save the right ones.
- **Mark as Watched holds while saving:** the dialog can't be closed, a second confirm is ignored, and a failed save keeps what you entered.
- **Long card titles end in an ellipsis** with the full title as a tooltip, re-measured on resize.
- **Secondary and muted text meets WCAG AA (4.5:1)** in both themes (light secondary `#706753`, light tertiary `#776e58`, dark tertiary `#9090a8`); a contrast unit test and the readability e2e test check it.

### Fixed — load (`bound-background-load`, backlog item 38)
- **A few requests waiting on a slow TMDB no longer block the whole backend.** Three sync workers meant three such requests stalled sign-in and everything else; threaded workers give 24 slots at the same memory. The TMDB deadline pool and the proxy's connection pool grew to 16 to match.
- **Background metadata backfills run at most 2 at a time per process,** so a burst of Stats visits no longer starts a thread, pool and DB connection per user.
- **Expired session-token rows no longer pile up:** they're removed at every start.

### Tests
- Jest: region helpers, Where to Watch region and fallback, CSV export columns, unreadable files and the failed empty list, page titles and announcer, reduced motion (count-up, marquee), Mark as Watched holding, contrast tokens.
- e2e: changing the region in Edit Profile, Watchlist pages and last-page removal, a missing list (`library-filters.spec.ts`), `a11y-titles.spec.ts`. Both e2e configs now pin the browser locale to `en-US`, since the region default comes from it.
- Backend: `test_token_flush.py`, backfill concurrency cap, pool sizes pinned to the thread count; a live TMDB shape check for `watch/providers/regions`.

### Docs
- `docs/BUG_BACKLOG.md`: items 37, 38 and 40 archived; the sixth audit is closed.
- CLAUDE.md: page titles, reduced motion, the contrast floor, threaded workers and backfill slots, the region preference (`pickRegion`, never `results.US`), library pagination, the Watched CSV columns.
- `docs/ARCHITECTURE.md`: reduced motion, page titles and the announcer, Mark as Watched holding, contrast pinned by computation; threaded workers and capped backfills, token flushing; region as a device preference, Watchlist pagination.
- README: features, project tree and test lists; "Regional watch provider switching" dropped from the roadmap (done).

## [0.27.0] - 2026-10-15

Bug-audit release, part 12: the first changes from the sixth audit (backlog items 35–41, logged in `docs/BUG_BACKLOG.md`). Live TMDB checks (`live-tmdb-smoke`, item 41), browse results that make sense on real data (`fix-browse-results`, item 35), crew credits and a seen-based unread rule for follows (`follow-crew-credits`, item 36), and account hardening (`harden-account-input-2`, item 39). All four OpenSpec changes are archived and their specs synced. Items 37, 38 and 40 remain open.

### ⚠️ Notes for deploy
- **Migration `0029_notification_seen_items`** adds a nullable JSON column and drops `seen_same_day`. Existing checkpoints keep the old date rule until the user next marks notifications seen; a new user's first notifications all show as unread.
- **Followed people's cached credits use new keys** (`person_new:v2:`, `person_recent:v2:`). Entries cached before the deploy are never read and expire within 6 hours, so the first polls refetch credits from TMDB, 40 people per poll as usual.
- **Passwords too similar to the username, email or name are refused again** (`UserAttributeSimilarityValidator`, dropped in 0.15.3). Existing passwords keep working; only new ones are checked.
- **Failed-login counters now key on the exact username.** Counters for usernames with capitals restart once, within the current hour.

### Fixed — browse results (`fix-browse-results`, backlog item 35)
- **The Release Calendar shows the whole week.** It took the earliest 60 releases, and TMDB dates hundreds of titles per day, so every movie fell on day one. It now lists the window's most popular releases, which cover every day, and says so.
- **Sorting by rating, release date or title shows real titles.** Rating (High to Low) led with 10.0 titles that had one vote, Release Date (Newest) with placeholders dated up to 2099, and Oldest and Title (A–Z) with 1870s shorts and punctuation-named uploads. Each sort now needs a minimum vote count (`src/constants/discover.ts`), and Newest stops at today.
- **A search stays on the page it was made on.** A sidebar search no longer turns People into "People results for …", a People search no longer shows up in the sidebar box, and Movies/TV/Anime never come back in a search mode with no box to clear it. The People page's search lives in its own address (`/people?q=…`), so Back and reload keep it.
- **iCal export holds only what the Calendar shows,** with the title filter applied.
- **The sidebar and bottom nav highlight a list's page under My Lists.**

### Fixed — follows and notifications (`follow-crew-credits`, backlog item 36)
- **Following a director, writer or composer now works.** Only acting credits were read, so following Christopher Nolan gave nothing. Every crew job now counts, once per title. Talk-show and news appearances are left out, here and in "Because you like {actor}".
- **"New from {name}" lists new and upcoming work,** newest first. It used to list the person's best-rated titles of all time, because a 6.0 rating minimum dropped every new release.
- **Unread now means "not seen when you last opened the bell".** A title TMDB adds late with an earlier date used to stay read forever.
- Follow and unfollow on the same person no longer share one in-flight result: an unfollow during a pending follow runs after it and reports its own outcome.

### Security — account (`harden-account-input-2`, backlog item 39)
- **Changing the username needs the current password,** like the email (sign-in is by username, so a stolen access token could rename the account and lock its owner out). A wrong password counts toward the per-username limit, and the address on file is told about the rename.
- **New passwords can't be too similar to the username, email or names,** at sign-up, on a profile change (checked against the values the account will have) and on a reset. Django's default threshold is kept: `alice2024` is refused for `alice`, `alicealice` still passes.
- **The per-username failure limit matches usernames exactly,** as sign-in does: failures on `Alice` no longer lock out `alice`.

### Added — live TMDB checks (`live-tmdb-smoke`, backlog item 41)
- **`backend/userdata/tests/test_tmdb_live.py`** checks every field and appended part the app reads against the real TMDB API, for every feature that reads TMDB, plus query checks for the Calendar, the sort minimums and crew credits. Opt-in only: `RUN_LIVE_TMDB=1 pytest -m live_tmdb` with a real key; plain `pytest` and CI skip it and stay offline. Its no-network drift checks always run: they fail when the frontend's `append_to_response` lists, Anime keyword or sort minimums change without the test's copies, or when TMDB's genre lists stop matching the genre chips.

### Docs
- `docs/BUG_BACKLOG.md`: the sixth audit (items 35–41) logged; 35, 36, 39 and 41 archived.
- CLAUDE.md: running the live checks and when; sort minimums, no grid search mode and People's own search; `navSection`; person credits (crew, no talk/news, versioned keys) and the `seen_items` rule; the username password gate, similarity validator and exact-username failure key.
- `docs/ARCHITECTURE.md`: crew credits, new work and the seen set; the username gate and similarity threshold; the Calendar's popularity sort.
- README: features, test lists (new live, Calendar, search-scope and account tests).

## [0.26.0] - 2026-10-14

Bug-audit release, part 11, which closes the fifth audit (backlog items 0–34 all done): cache placement, notifications load and log redaction (`notifications-cache-hygiene`, backlog item 29), bounded recommendation refreshes (`bound-rec-refresh`, item 28a), recommendation quality fixes (`rec-quality-fixes`, item 28b), pinned CI, tests and images (`harden-ci-3`, item 34a), and app config and dev setup (`tidy-app-config`, item 34b). All five OpenSpec changes are archived and their specs synced.

### ⚠️ Notes for deploy
- **Three migrations:** `0026_notificationcheckpoint_seen_same_day` adds a JSON column with a default (no table rewrite); `0027_tmdbtitlebudget` adds a small per-user table; `0028_rec_quality` adds two nullable columns and, in one `UPDATE`, unsettles watched titles that were settled only because TMDB listed no genres (they're fetched once more, within the per-run cap and the daily budget).
- **New cache table** `person_credits_cache`, created by the existing `createcachetable` step at startup (`start.py`, `docker-entrypoint.sh`). Credits cached in `default` before the deploy are never read again and expire within 6 hours, so the first polls after the deploy refetch followed people's credits from TMDB, 40 at a time per poll as usual.
- **`FRONTEND_URL` is now required with `DEBUG` off** (`tidy-app-config`): the backend refuses to start without an absolute `http(s)` URL there, instead of mailing password-reset links to `localhost:3000`. The documented `.env.docker` already sets it; check any other deploy before upgrading.
- **Local dev:** `npm run dev` now takes its Python from `DJANGO_PYTHON` (root `.env` or the shell), falling back to `python` on the `PATH`. Set it to the env with the backend requirements (see `.env.example`).

### Fixed
- **Followed people's cached credits can't evict rate-limit counters any more.** They had shared the main cache, where past 50,000 entries every write dropped a third of the keys, rate-limit counters first. One account could trigger this on purpose by bulk-following and polling. Credits now have their own size-limited cache, apart from the TMDB proxy's too.
- **A notifications poll no longer loads every followed person's full credit list.** It reads a small per-person summary of recent and upcoming releases, so following thousands of prolific people no longer costs hundreds of MB per poll. Notifications are the same.
- **A release dated the day you mark notifications seen, which appears later that day, now shows as unread.** It used to count as read because it shared the mark-seen date.
- **`guest_session_id` is redacted from server logs,** in URLs and JSON bodies, like `session_id` and `request_token`.

### Fixed — recommendations under load (`bound-rec-refresh`, backlog item 28a)
- **A TMDB outage no longer turns every For You poll into a full recompute.** A refresh whose result is kept back because TMDB failed now waits 10 minutes before polls can start another; the stored recommendations are shown meanwhile. Watching or rating something still refreshes at once.
- **One refresh fetches at most 200 titles' details** (never-cached first, then the oldest), instead of every uncached or week-old title in one burst; a huge imported library no longer means tens of thousands of TMDB calls and one enormous database query.
- **Background title lookups are limited to 1,000 per user per day,** shared by the genre backfill and the recommendations cache, so clearing and re-importing unknown titles can't keep spending the server's TMDB quota.
- **At most 4 recommendation refreshes compute at once per server process;** the rest wait their turn instead of each holding a database connection.
- **A refresh that can't start its thread no longer leaves "pending" forever.**
- **The startup warm-up skips users whose recommendations are fresh** and warms the oldest first.

### Fixed — recommendation quality (`rec-quality-fixes`, backlog item 28b)
- **Titles you rated low no longer shape "Your Taste" sections,** and titles without genres no longer skew them; with fewer than three usable titles there are no taste sections.
- **A taste that mixes a movie-only and a TV-only genre (Horror and Reality) shows titles again** instead of an empty, dropped section.
- **Titles TMDB listed without genres are checked again after 30 days,** so new releases get their genres and release year; only titles TMDB doesn't know are settled for good.
- **Titles you've rated are never recommended,** even if you never marked them watched.
- **A genre id TMDB adds later works for both movies and TV.**
- **An older recompute can no longer overwrite a newer one** when two server processes refresh the same user.

### Changed — CI, tests and images (`harden-ci-3`, backlog item 34a)
- **Everything CI runs is pinned.** Actions by commit SHA (version in a comment); `wait-on` as an exact devDependency, called with `npx --no-install`; the Python e2e environment through a new `e2e/python/constraints.txt`; `@playwright/test` exact at `1.60.0`, and a backend test fails when it differs from the pip `playwright` pin.
- **The workflow token is read-only** (`permissions: contents: read`).
- **A failed Python e2e run uploads its Playwright traces** (7 days), like the TS job.
- **Base images are pinned by exact version and digest:** `node:22.23.2-alpine3.24`, `nginx:1.31.5-alpine3.24`, `python:3.12.14-slim`, `postgres:15.19-alpine3.24`. A static test fails on any `FROM`/`image:` without a digest.
- **The backend image no longer ships its tests or dev-only files,** and the frontend build context leaves out `.git`, `.github`, `.claude`, `openspec`, `docs` and tool caches.
- **nginx no longer sends its version** (`server_tokens off`).
- **Two checks that couldn't fail now can:** the list-name e2e test asserts the 60-character cap (it allowed 100), and `test_e2e_mock_shapes.py` compares the TS DTO types in `src/types/domain.ts` with the serializers, so a stale type fails the suite. TMDB-shaped TS e2e literals `satisfies` the `TMDB*` types.
- `@types/node` follows the Node 22 runtime (`^22`).

### Changed — app config and dev setup (`tidy-app-config`, backlog item 34b)
- **Reset links can't point at localhost in production:** a missing or malformed `FRONTEND_URL` stops startup with `DEBUG` off, and a trailing slash no longer doubles the link's slash.
- **A backup restore of many long reviews no longer loses whole chunks.** Bulk imports split requests by size (about 2 MB of JSON) as well as by 500 rows, so 500 ratings with 5,000-character reviews stay under the server's 2.5 MB body limit instead of failing as one 400.
- **The Django admin is gone.** It had no registered models, wasn't routed in production, and in dev was an unthrottled login form. `createsuperuser`/`changepassword` still work; existing databases keep an unused `django_admin_log` table.
- **`npm run dev`, `npm start` and `npm run django` no longer hardcode a machine-specific Python path:** `scripts/run-django.js` reads `DJANGO_PYTHON` and names it in the error when it isn't found.
- `backend/.env.example` lists every setting the backend reads (`FRONTEND_URL`, `JWT_SIGNING_KEY`, `CONN_MAX_AGE`, `DEFAULT_FROM_EMAIL`, `EMAIL_TIMEOUT` were missing), and `test_app_config.py` fails when a new one isn't listed.

### Docs
- CLAUDE.md: the `person_credits` cache alias (bulky or user-growable cached data never goes in `default`), poll summaries vs full lists, `seen_same_day`, `guest_session_id` as a credential.
- `docs/ARCHITECTURE.md`: why credits get their own alias, why polls read summaries and how the window is sized, and the same-day seen list.
- CLAUDE.md / README: how each pin is bumped (action SHAs, image digests, e2e constraints, the Playwright version check), Python e2e traces, the TS DTO check, what the backend image leaves out.
- `docs/ARCHITECTURE.md`: the reviews line no longer names the removed `fetchTVReviews`; the Python e2e conftest docstring describes the 501 catch-all.
- `docs/BUG_BACKLOG.md`: item 29 archived; specs `notifications` and `api-hardening` synced; item 28 split into 28a (`bound-rec-refresh`, archived; specs `recommendation-refresh`, `title-metadata`, `service-health` synced) and 28b (`rec-quality-fixes`, archived; specs `recommendation-sections`, `title-metadata`, `recommendation-refresh` synced).
- CLAUDE.md / `docs/ARCHITECTURE.md`: refresh backoff, fill cap, the per-user title budget (`tmdb_budget.take`) for any background title fetch, and the refresh semaphore; only a 404 settles title metadata (30-day recheck otherwise), clustering input, rated titles excluded, `save_recommendations` outcomes and `started`.
- CLAUDE.md / README / `docs/ARCHITECTURE.md`: `DJANGO_PYTHON` and `scripts/run-django.js` replace the hardcoded interpreter path; `FRONTEND_URL` is fail-closed (and why it isn't taken from `Host`); the bulk byte budget; the admin's removal; `backend/.env.example` and the root `.env.example` document every setting.
- `docs/BUG_BACKLOG.md`: item 34b archived as `tidy-app-config`; specs `api-hardening`, `data-backup` and the new `dev-environment` synced. Items 0–34 are all done.

## [0.25.0] - 2026-10-14

Bug-audit release, part 10. Fixes from the fifth audit: backend account and input hardening (`harden-account-input`, backlog item 30), the 0.24.0 import and progress follow-ups (`fix-import-followups`, item 31), frontend state fixes (`fix-frontend-state`, item 33), bounded TMDB calls during requests (`bound-tmdb-calls`, item 27), and frontend honest states and accessibility (`honest-states-a11y`, item 32). All five are archived under `openspec/changes/archive/`. Items 28, 29 and 34 remain open.

### ⚠️ Notes for deploy
- **One migration:** `0025_loginfailure` adds the `userdata_loginfailure` table (per-username failed-password counts). Counts held in the cache are dropped on deploy, so any username currently locked out is unlocked once.
- **New settings:** `EMAIL_TIMEOUT` (default 10 s, env-overridable), throttle rates `password_reset_confirm` (10/hour) and `followed_recs` (30/min).
- **API changes:** `PATCH /api/episode-progress/<id>/` now returns `405` (use `POST`, which requires both `season` and `episode`). `voteAverage` outside 0–10 is rejected with `400`. The app's own client is unaffected by either.
- **No nginx or Docker changes.** Items 30 and 27 are backend only; items 31, 33 and 32 are frontend, apart from one notifications field (`personName` falls back to "Person <id>").

### Security
- **The per-username login lockout really lasts an hour.** In production, every failure reset the lock's expiry to 5 minutes, and a parallel burst of failures counted as about one. Failures are now counted in a database table, atomically, over a window that runs from the first failure. `Retry-After` gives the real time left.
- **Wrong passwords on a profile update or account deletion count toward the same limit**, and both return `429` while the username is locked. A stolen session could previously guess the password about 5,000 times a day. Profile edits that don't send a password are unaffected.
- **A password reset clears the lockout**, so someone locked out by another person's guessing can sign in right after resetting.
- **Reset confirmation has its own rate limit**, so a few rejected passwords on the confirm form no longer block requesting a new link, or the reverse.
- **Avatar uploads over 16 megapixels are rejected** before decoding, and stored avatars are scaled down to at most 1024 px a side. A small single-colour PNG could make one upload use most of a GB of memory.
- **Followed-people recommendations are rate limited per user** (30/min), like the other endpoints that spend TMDB quota.

### Fixed
- **A crafted `voteAverage` can no longer break Stats.** Values outside 0–10 are rejected on every write, and Stats ignores any already stored.
- **A stalled mail server can't half-apply an email change.** The previous-address notice is sent after the change commits, on a background thread, and every mail connection gives up after `EMAIL_TIMEOUT`. Before, the request could be killed after the change was saved but before the session's new tokens were issued.
- **Episode progress needs both season and episode.** A `PATCH` with only `episode` used to reset the season to 1.
- **Two avatar uploads at once leave one file.** One upload's new file used to stay on disk, served, even after account deletion.
- **Adding to a list that is being deleted gives `404`**, not `500`.
- **The email-uniqueness lock folds case the way the uniqueness check does** (`upper`), so two addresses the check calls equal always take the same lock.

### Fixed — import and progress follow-ups (`fix-import-followups`, backlog item 31)
- **An import can't write into the next account.** A backup restore or CSV import that is still running when you sign out stops before its next write, and its poster lookups stop too. Before, signing in as someone else in the same tab sent the rest of the import with that account's session.
- **Import dialogs can't be closed while they run**, so an import can't be started twice at once. A second run alongside the first created every list twice.
- **Removing episode progress while "Next Episode" is saving really removes it.** It waits for the advance and then runs, and its message is its own. It used to report "removed" with the advance's result while progress had moved on. Episode-progress results that arrive after sign-out are also dropped.
- **A rate-limited poster lookup pauses all lookups** for the wait the server asks, instead of only itself, so the others don't use up their retries in the same window.
- **CSV watched times must be ISO 8601 with an offset.** Other formats (`05/01/2024`) are dropped for that row only, instead of failing a whole 500-row batch. A date alone (`2024-05-01`) is kept as noon UTC, so it shows on that day instead of the day before in western time zones.
- **Notifications:** a late answer from an earlier check can't replace a newer one, follow changes refresh after a 1.5 s pause (following many people quickly no longer hits the rate limit), and restoring follows refreshes them.
- **Opening Profile no longer fetches your followed people.**
- **A followed person with a blank name shows as "Person <id>"** on cards and in notifications.
- **The filter drawer seeds only genres of the media type you're browsing.**

### Fixed — frontend state (`fix-frontend-state`, backlog item 33)
- **A failed first page on Home or Anime no longer loads page after page behind the error screen.** Infinite scroll stays off until Retry succeeds. Before, the scroll trigger stayed in view and fetched again after every page it loaded, spending the TMDB rate limit.
- **Browse settings end with the session.** Signing out resets the search term, "include adult", genre picks, and the applied filters and sort, so the next account in the tab starts from the defaults.
- **Follow buttons wait for your followed-people list.** They're disabled while it loads, so a follow made during the load can't be undone by it, and people you follow never show "Follow".
- **Library screens follow the order you acted in:**
  - A reload that started before a write is run again instead of dropping what you just added.
  - Clear All (and clearing a list) waits for pending adds, and adds made during a clear wait for it.
  - Unmarking while a mark is still saving now unmarks.
  - Saving a rating twice sends one request.
- **Library pages count as loading from the first render after sign-in**, so `/watched?page=3` keeps its page and the empty state doesn't flash.
- **Mark-seen can't be undone by a notifications check that raced it.**
- **Downloads aren't cut short.** CSV, backup, template and calendar downloads release the file only after the download has started.
- **A request replayed after a token refresh can't start a second refresh.**
- **After signing out, the next sign-in in the tab goes to the default page**, not the previous account's last page. An expired session still returns you to where you were.

### Fixed — TMDB calls during requests (`bound-tmdb-calls`, backlog item 27)
- **No request can be held past the server's timeout by TMDB.** Every TMDB call made while a request waits now has a wall-clock limit for the whole call, every connection attempt included: the TMDB proxy (20 s), connecting a TMDB account and rating sync (10 s), and Stats' genre lookup (8 s per call). The proxy's old limit assumed one connection attempt per try, but TMDB's host has four addresses and each was tried in turn, so a stalled TMDB could hold a request about 37 s, past the 30 s at which the server kills it.
- **Account deletion and TMDB disconnect never wait on TMDB.** The account is deleted (or the session cleared) first, and the TMDB session is revoked afterwards in the background. A slow TMDB used to be able to stop an account deletion after revoking the session.
- **Reconnecting TMDB can't leave a revoked session stored.** The new session is saved before the old one is revoked. If saving fails, the old session is kept and not revoked.
- **Rating sync to TMDB happens after the local save, within 10 s.** Deleting a rating removes it locally first. A slow TMDB delays the save by at most the limit and never fails it. Before, a stalled sync could get the request killed after the rating was saved, so the app showed an error for a change that had in fact succeeded.

### Fixed — honest states (`honest-states-a11y`, backlog item 32)
- **Cancel in a list's Delete confirm no longer opens the list**, and confirming deletes it without opening a "List not found" page. Clicks in the confirm popup bubbled up to the card.
- **For You says when something failed instead of showing less.** A failed watched-history load shows an error with Retry, not "No watched titles yet". When one recommendation group fails after others loaded, the others stay and a warning with Retry appears. A failed group no longer hides the "Crunching…" state of groups still being prepared.
- **A person page whose credits failed to load says so**, with Retry, instead of "No credits available". Retry reloads only the credits. If one of the two credit lists failed, the tabs that loaded stay, with a warning above them.
- **Readable errors on the register, forgot-password and reset-password pages.** A network failure or a proxy error page no longer reads as "Invalid or expired reset link.", "Make sure the backend is running" is gone, and a nested error can't show `[object Object]`.
- **The Lists page keeps its cards while lists reload** in the background, instead of blanking to a spinner.
- **A People search with no matches says so**, instead of an empty grid.
- **Edit Profile shows "Checking TMDB connection…" until it knows**, so a connected account is never offered "Connect TMDB Account" for a moment.
- **Hand-edited addresses fall back to defaults:** `/watched?page=-2`, `?page=1.5` and `?pageSize=-5` show page 1 at 48 per page, and an unknown `?tab=` on Stats or Search shows the default tab instead of a blank panel.

### Changed — browse and search (`honest-states-a11y`, backlog item 32)
- **"Include Adult Content" applies with Apply**, like every other control in the filter drawer. It used to change the results the moment it was switched, outside the draft.
- **Movies/TV/Anime category buttons are disabled while a search or filter decides the results.** They had no effect then but resent the same request.
- **Switching Anime between TV and Movies sends one request.** The first used to be a movie request with TV "Airing Today" parameters.
- **Search results use the same cards as the Movies and TV pages**, so they have a watchlist button too.
- **A year range entered backwards (2020 → 1990) is applied as 1990–2020.** The year fields now go up to five years ahead instead of stopping at 2030.

### Accessibility (`honest-states-a11y`, backlog item 32)
- The filter drawer's fields are linked to their labels, and the adult content switch is announced by name.
- Add to List rows are real checkboxes named after each list (Tab and Space work, a row click toggles once).
- Card buttons name their title ("Add to watchlist: Fight Club"), so a grid's buttons can be told apart.
- Opening the phone Search drawer no longer puts two `id="global-search"` elements on the page.
- The search box shows the search in effect after opening a `?q=` address or picking a recent search.
- The ten-star rating stays on one line on 320 px phones.

### Theme and conventions (`honest-states-a11y`, backlog item 32)
- The detail-page watchlist icon uses the same colors as the cards (blue when in the watchlist, the theme's text color otherwise), not always gold.
- The detail backdrop fades into the light theme's background in light mode, and card shadows are tuned per theme.
- The profile dialog's fallback avatar uses the same initials and color as the sidebar's.
- Stats uses the shared rating colors; budget and revenue are formatted the US way regardless of browser locale.
- A person with two roles in one cast no longer repeats a React key.

### Docs
- `docs/ARCHITECTURE.md`: why the failure counter is a table and not the cache, the separate reset buckets, the avatar caps and the after-commit email notice; the adult switch in the filter draft, per-group For You failures, credits-only Retry, query-value fallbacks and the portaled-confirm propagation fix.
- CLAUDE.md: the new throttle scopes, and that every password check goes through the shared failure counter; import session guards, inflight actions/`runExclusive`/`guardedReload`, browse-state reset on sign-out, `personLabel`, and `call_with_deadline` budgets for every TMDB call made during a request.
- README: new test files and the `guardedReload`, `personLabel`, `queryParams` and `initials` utilities in the project tree; new e2e counts.
- `docs/BUG_BACKLOG.md`: items 30, 31, 33, 27 and 32 archived. Item 30's backfill-budget note moved to item 28, its same-day notification note to item 29.
- CLAUDE.md: the adult switch is part of the filter draft; drawer label wiring; `SearchBox` `id` prop and term sync; `parseIntParam`/`pickKey` for address values; `getInitials`; Search uses `Movie`/`TVShowCard`; card button names include the title.
- Item 32's two plausibles checked (SearchBox sync and 320 px stars reproduced and fixed).

## [0.24.0] - 2026-10-13

Bug-audit release, part 9. Implements the last four OpenSpec changes from `docs/BUG_BACKLOG.md`: `spec-test-gaps` (21c), `fix-recs-correctness` (item 23), `fix-import-export-2` (item 24) and `fix-write-guards-2` (item 25). All are archived under `openspec/changes/archive/`, and every backlog item is now done.

### ⚠️ Notes for deploy
- **One migration:** `0024_followedperson_followed_at_default` changes `FollowedPerson.followed_at` from `auto_now_add` to `default=timezone.now`, so a restore can keep follow dates. Schema default only, no data change.
- **New routes**, all additive:
  - `GET /api/episode-progress/`: every show's progress, paginated
  - `POST /api/episode-progress/bulk/` and `POST /api/followed-people/bulk/`: create-only, all-or-nothing restores
- **Response change:** the followed-people list adds `followedAt`. Older clients ignore it.
- **Email uniqueness** is now re-checked under a Postgres advisory lock (`pg_advisory_xact_lock`). No unique index was added, because existing accounts may already share an address.
- **No nginx or Docker changes.**

### Fixed — recommendations (`fix-recs-correctness`)
- **Genres are matched per media type.** A new `genre_families.py` maps TMDB's movie and TV genre ids into shared families. Action and Adventure count with TV's "Action & Adventure", Sci-Fi and Fantasy with "Sci-Fi & Fantasy", War with "War & Politics". For You counts, "More like what you love", the "Based on your taste" sections and the KMeans vocabulary all count families. Every discover call converts back to that type's own ids, so a movie genre is never sent to TV discover, and a mixed cluster no longer matches nothing and makes its section vanish.
- **Stats' Top Genres and Rating by Genre** use the same families, so one taste is no longer split in two.
- **Ratings refresh recommendations.** Creating a rating, changing its score, deleting it, or a bulk import that adds ratings schedules a refresh, coalesced per user. A review-only edit doesn't.
- **Disliked titles don't seed "Because you watched".** Titles rated 4 or below are skipped. Unrated titles stay eligible.
- **For You saves only complete results.** A group still computing after polling ends shows "taking longer than usual" with Retry, and leaving before every group answered saves the snapshot as incomplete.
- **Marking a card watched on For You** updates its icon without refetching and reshuffling the groups.

### Fixed — imports and backups (`fix-import-export-2`)
- **Backup format v3** adds followed people (with follow dates) and episode progress. "Export All" fetches both when it runs, and refuses to produce a file if either fails. "Import All" restores both and reports their counts. v1 and v2 backups still import.
- **Imports are paced.** Poster and score lookups share one schedule (90 per minute, 4 at a time), wait out a 429 for its `Retry-After`, treat a 404 as final, and show progress ("Looking up posters: 40 / 300"). The result says how many rows ended up without a poster. Before, a 300-row import hit the proxy limit and silently saved about 40% of its rows without posters.
- **The Watched CSV round-trips.** Importing the Watched page's own CSV keeps each watch's date and time zone. A blank or unreadable date falls back to "now" for that row only, and a future date is dropped for that row only.
- **Lists that share a name stay separate.** A backup's list joins an existing list only if that list existed before the import, and two same-name lists in one backup each keep their own items and description.
- **Accurate bulk counts:** a row that a concurrent request created first counts as skipped, not added.

### Fixed — writes and controls (`fix-write-guards-2`)
- **Episode progress:**
  - A failed load shows "Couldn't load your episode progress" with Retry, and hides Track/Edit/Next. Before, it looked like "not tracked", and saving overwrote the real position with S1E1.
  - Next, Save and Remove send one write per double click.
- **Ratings:** saving with only a changed review no longer pushes the score to TMDB. The rating dialog can't be closed (Cancel, ×, Escape, outside click) while a save or removal is in flight.
- **Confirm buttons:** a new `ConfirmIconButton` hides the icon's tooltip while its confirmation is open. It's used for the unmark and remove actions on Watched, Watchlist and List detail cards. On touch screens, the tooltip used to stay up and block the confirm button.
- **Back:**
  - A detail or person page's Back goes back in history only when there's an in-app page to return to. Otherwise it goes to Movies, TV Shows or People (`goBack()`).
  - Browser Back to the People page restores its loaded pages and scroll.
- **Filter drawer:** edits are a draft, genre chips included, re-seeded each time the drawer opens. Apply commits everything at once, so the grid fetches once, not twice.
- **Notifications** refresh right after a follow or unfollow, and leave out titles you've already watched.
- **New items first:** a new list or follow shows first, as the server orders it.
- **Email:** two concurrent sign-ups or email changes can no longer claim the same address.
- **Provider links:** TMDB's watch-provider link is used only if it's http(s). Otherwise the logo shows without a link.

### Tests and fixes from the spec check (`spec-test-gaps`)
- **New tests for spec scenarios that had none:**
  - the three import dialogs, driven through real file inputs (`e2e/import.spec.ts`)
  - For You left mid-computation
  - rating remove, and no Remove on an unrated title
  - failed mark-as-watched and failed episode-progress save
  - a failed background refresh
  - per-list search and unmarking the last item on the last page (`e2e/library-filters.spec.ts`)
  - focus after a failed login, and the phone drawer's account controls
  - fail-closed on the default `SECRET_KEY`, and key redaction with `DEBUG` on
  - Anime "Airing Today" dates, and genres dropped on a media-type switch
  - every `theme-readability` scenario (`e2e/theme-readability.spec.ts`)
  - a warm-up hang or non-zero exit during startup
  - container config: HSTS only over HTTPS, the db reads only `.env.db`, `backend/.dockerignore`
  - app identity, and an unknown path opened while signed out
- **Bugs the new tests found, fixed:**
  - The phone drawer's profile and sign-out buttons were announced as initials plus name, and "Sign Out". They're now "Edit profile" and "Sign out".
  - A failed library reload after a successful import was silent. The import dialogs now show an error notification.
  - Switching Anime between TV and Movies sent one request with the old genre.
- `start.py`'s warm-up moved into `backend/warmup.py` so it can be tested. Behavior is unchanged.

### Developer
- `npm run lint` uses `--cache` (`.eslintcache`, now in `.gitignore`).

### Tests
- **Backend:** 395 → 448 (1 skipped). New: `test_genre_families.py`, `test_recommendation_genres.py`, `test_email_uniqueness.py`, `test_startup_warmup.py`, `test_compose_config.py`, plus bulk follows/progress, rating-triggered refresh, review-only sync and watched-filtered notifications.
- **Jest:** 278 → 304. New: `goBack`, `pacedLookup`, `WatchProviders`, episode-progress errors and in-flight guard, new-first ordering, follow-triggered notification refresh.
- **TS e2e:** 207 → 300 across both projects. New: `import.spec.ts`, `library-filters.spec.ts`, `theme-readability.spec.ts`, `browse-restore.spec.ts`, plus new write-feedback and Back cases.
- **Python e2e:** 192.

## [0.23.0] - 2026-10-13

Bug-audit release, part 8. Implements four OpenSpec changes from `docs/BUG_BACKLOG.md`: `fix-detail-and-nav` (item 19), `fix-stats-math` (item 20), and item 21 split in three, of which `harden-ci-2` (21a) and `polish-colors-docs` (21b) are done. All four are archived under `openspec/changes/archive/`. Still open: 21c `spec-test-gaps`, and items 23–25.

### ⚠️ Notes for deploy
- **One migration:** `0023_list_timestamps_default` changes the defaults of `UserList.created_at` and `UserListItem.added_at` from `auto_now_add` to `default=timezone.now`. Schema defaults only, no data change. It's applied by the normal migrate step.
- **New route:** `POST /api/lists/<id>/items/bulk/`. It is additive, and older clients keep working.
- **nginx changes:**
  - `gzip` is on for the app's text assets. It is off for `/api/` and `/media/`.
  - Files under `/static/` get `Cache-Control: public, max-age=31536000, immutable`, but a 404 never does.
  - The entry page is still revalidated on every load.
- **CI changes:**
  - TS e2e tests are no longer retried.
  - `npm run lint` now covers `e2e/`.
  - Jest fails when it finds no tests.
  - A new `docker` job builds both images and checks the frontend image's nginx (`.github/scripts/smoke-frontend.sh`).
- **Unverified on the dev machine (no Docker):** the `docker` job and the real nginx behaviour. Its first CI run is the real test. `test_nginx_conf.py` checks the config statically.

### Fixed — detail pages and navigation (`fix-detail-and-nav`)
- **No stray `0`** in detail facts. Runtime, season count and episode count show only when TMDB has a positive number.
- **Where to Watch** shows Streaming, Rent and Buy. With nothing available it says so for the US, and never shows a header over nothing.
- **Browse cards are links.** The Movies/TV/Anime grid posters, the hero's "View Details" and the notification items are real links, so Tab/Enter, middle-click and Ctrl-click work, and Back still restores the grid.
- **Back from a recommendation card** returns to the page it came from (Following, For You).
- **Person pages have a Crew tab.** It shows one card per title with the jobs joined. The default tab follows what the person is known for, and credits are newest first.
- **Mark as Watched runtime is editable.** For TV it is prefilled with episodes × episode runtime when TMDB has both. Runtime and providers come from one request, so a providers failure no longer loses the runtime.
- **Smaller fixes:**
  - Following recommendations refetch when the followed set changes.
  - Follow is disabled while followed people failed to load.
  - The Add to List dialog resets and tells a failed load apart from "No lists yet".
  - CSV import templates list only the columns the import reads.
  - A multi-page Back restore never shows a title twice.
  - A poll in flight can't bring back a badge just marked seen.
  - Both search boxes share recent searches.
  - Watchlist scroll is restored only on a return from a detail page.
  - The Anime hero always shows an anime.
  - The TMDB callback spinner shows its text.
  - CSV exports start with a UTF-8 BOM, so Excel shows non-ASCII titles correctly.

### Fixed — Stats and list restores (`fix-stats-math`)
- **Half-star ratings land in even buckets** (6.5 → 7, 7.5 → 8). Every Stats average rounds half up (7.25 → 7.3). It used to be banker's rounding.
- **Monthly activity has no gaps.** It covers every month from the first watch through the current month, with `0` for empty ones.
- **Average TMDB rating leaves out unscored titles** (stored as `0`). With none scored, it is empty.
- **A followed person's movie and TV show sharing an id both appear** in their recommendations section.
- **Stats labels:**
  - The Rating by Genre tooltip says "Avg rating".
  - Heatmap dates are dd-mm-yyyy, and its info text says it counts watched titles.
  - The Top Genres empty text no longer sends you to For You.
- **The activity heatmap is keyboard-readable:** one Tab stop, arrow keys move by day and week, and the focused day is shown and announced.
- **List restores keep dates and order:**
  - The backup restore and the per-list CSV import add items in batches of 500 through the new bulk endpoint. Before, they sent one request per item, which also spent the daily request limit.
  - Lists keep their creation time (the backup manifest gains `createdAt`; older backups still import), and items keep their added time.
  - A CSV without dates keeps its file order.

### CI and production web server (`harden-ci-2`)
- **No e2e retries:** a test that fails once fails CI, and its trace is kept in the uploaded report. The dev-server start timeout is now 300 s.
- **Flaky waits fixed:** the notification-popup scroll check waits for the scroll to be handled instead of 200 ms, and a ratings test lost a non-waiting fallback.
- **New test:** a two-page watched history loads every entry.
- **Lint covers `e2e/`**, with three Jest/Testing Library rules that misfire on Playwright code turned off there only.
- **CI fails on zero Jest tests.** Ruff now targets Python 3.12.
- **Docker job:** builds both images and checks the frontend image's real nginx (headers, revalidated entry page, 404 for a missing chunk, gzip and long-lived cache on a hashed bundle).
- **Faster CI:** Playwright browsers are cached, and a newer push to a PR cancels its older run (runs on `main` are never cancelled).
- **nginx:** compression and long-lived caching for static assets (see deploy notes).

### Polish — theme colors and docs (`polish-colors-docs`)
- **Light mode reads better:**
  - Idle watched/watchlist icons use the theme's text color instead of pure black (one hook, `useActionIconColor()`, replaces 11 inline copies).
  - Empty-state icons, the review caption on Watchlist cards, the genre-chip border and the "No Image" placeholder take their colors from the theme. The placeholder is no longer a dark block in light mode.
- **No color literals left in `src/`** except named constants and Stats' chart palette and heat scale, which are fixed on purpose.
- The phone avatar initials use the caption size (12 px).
- **The browser tab says "CINE DB"**, like the installed app.
- `start.py` accepts `POSTGRES_PASSWORD` like `settings.py`, and `CORS_ALLOWED_ORIGINS` is documented.
- **Docs fixed:** ARCHITECTURE.md's account of what each page persists, `CLAUDE.md`'s note on `playwright-core`, garbled characters and a stale CORS comment in `settings.py`, and the `api-hardening` spec's wording on proxy parameter order.

### Tests
- **Backend:** 372 → 395. New: `test_stats_math.py`, list-item bulk import, a followed person's movie and TV show sharing an id, and the nginx gzip/cache checks.
- **Jest:** 245 → 278.
- **TS e2e:** 207 across both projects, 3 skipped. New: `detail-and-nav.spec.ts`, `stats.spec.ts`, the two-page watched history and the tab title.
- **Python e2e:** 192.

## [0.22.0] - 2026-10-12

Bug-audit release, part 7. Implements three OpenSpec changes from `docs/BUG_BACKLOG.md`: `speed-up-pages` (item 26), `fix-upstream-resilience` (item 17) and `fix-account-edges` (item 18), all archived under `openspec/changes/archive/`. Items 19–21 and 23–25 are still open.

### ⚠️ Notes for deploy
- **No migrations.** The TMDB proxy cache uses a new `DatabaseCache` table, `tmdb_proxy_cache`, which the existing `createcachetable` step in `docker-entrypoint.sh` (and `start.py`) creates on boot.
- **CSP change:** `nginx.conf`'s `img-src` adds `https://i.ytimg.com` for trailer thumbnails.
- **Production now keeps DB connections for 60 s** (`CONN_MAX_AGE`, overridable from the environment). Under `DEBUG` it stays 0.
- **Dev:** API traffic now goes through CRA's `proxy` (`package.json`), so restart `npm run dev` once. If your root `.env` sets `HOST=0.0.0.0`, change it to `HOST=::` (see `.env.example`). Production `REACT_APP_*` values and nginx routing are unchanged.
- **Unverified on the dev machine (no Docker):** `nginx -t` on the new CSP line and the `tmdb_proxy_cache` table creation. `test_nginx_conf.py` checks the config statically.

### Performance (`speed-up-pages`)
- **Dev API calls are same-origin.** The clients default to relative URLs (`/api`, `/api/tmdb`, media `""`), and CRA proxies them to Django on port 8000 over IPv4. That removes the CORS preflight on every call and the ~300 ms IPv6 → IPv4 fallback on every new connection (`localhost` resolved to `::1` while `runserver` listens on IPv4 only).
- **Movie and TV detail pages load in one TMDB request** (`append_to_response`) instead of 5–6. Each appended part goes through shape guards (`src/utils/appended.ts`), so a missing or malformed part empties only its own section.
- **Identical TMDB requests in flight are shared** (`sharedGet` in `src/api/tmdb.ts`), so the dev double mount and two components asking at once cost one request. A failure reaches every waiter and isn't kept.
- **The TMDB proxy caches successful responses** in its own `tmdb` cache alias: 10 min for lists and search, 6 h for details, 24 h for genres and configuration, with an `X-Cache: HIT|MISS|BYPASS` header. Requests carrying a TMDB `session_id`/`guest_session_id`, and `account`/`authentication` paths, are never cached, and neither are errors.
- **Library lists load 500 rows per request** (`page_size`, max 500). A 1,300-title watched history takes 3 requests instead of 13.
- **Images are sized for display:** grid posters `w342`, hero and detail backdrops `w1280` (`original` only in the full-screen preview). The hero backdrop is no longer lazy-loaded.
- **Trailers load on demand** (`TrailerEmbed`): a thumbnail with a play button, and the `youtube-nocookie` player only after you press it.
- `App` no longer re-renders the whole route tree on every library change.
- Production reuses DB connections (see deploy notes).

### Fixed — TMDB trouble (`fix-upstream-resilience`)
- **A failed "load more" no longer retries in a loop.** Movies, TV, Anime, People and Search show "Couldn't load more" with Retry (`LoadMoreError`), and scrolling doesn't request again until you retry. Before, the page re-requested continuously while TMDB was failing.
- **A title or person deleted from TMDB no longer freezes recommendations.** A TMDB 404 is now an answer, not an outage: it's stored as empty (title details, similar titles, person credits) instead of marking the refresh failed, which had kept an old result forever and restarted a full recompute on every For You visit. The notifications poll caches such a person as having no credits instead of refetching them on every poll.
- **A metadata-backfill failure inside a recommendations compute now counts as an upstream failure**, so a result clustered on genre-less titles can't replace a good stored one.
- **Overlapping refreshes keep the right status:** a finishing refresh clears only its own "refreshing" stamp, not a newer one set by another server process.
- **Two more endpoints answer within a time budget:** followed-people recommendations (15 s, returning what arrived) and Stats' cold genre-name lookup (a short per-call timeout; a failed lookup's fallback is cached for 5 minutes, not 24 hours). Tests pin both under gunicorn's `--timeout`.

### Fixed — account edges (`fix-account-edges`)
- **Accounts without an email can save profile changes**, password changes included. Every save used to fail with "This field may not be blank." Clearing an email now needs the current password, and two accounts without an email never conflict.
- **One implausibly old imported date can't break Stats.** Bulk imports reject timestamps before 1900-01-01, and a row already stored with one falls back to UTC instead of making `/api/stats/` raise `OverflowError` on every request.
- **A response that lands after sign-out is dropped.** The library hooks (watched, watchlist, ratings, lists) and the notifications poll check the session generation, so the next account signed in in that tab never sees the previous account's bell items or library. The notifications error flag resets on logout.
- **The Edit Profile dialog opens with the saved profile every time**, with every password field empty. Typed passwords and unsaved edits used to survive closing and reopening it.
- **"Export All" never saves a partial backup silently.** While part of the library is still loading or failed to load, it says why instead of producing a file, and a failure while building the file shows an error.
- **A forced logout returns you to your page** after signing in again, instead of landing on `/movies`.
- TMDB connect/disconnect errors use the shared error text, so an unreachable server reads "Can't reach the server…".

### Docs
- CLAUDE.md: same-origin dev traffic and `HOST=::`, the proxy cache and `sharedGet`, image-size constants, `TrailerEmbed` and `appended.ts`, `LoadMoreError`, 404-is-settled in the upstream-failures rule, the session-generation guard for new data hooks, library page size, and `CONN_MAX_AGE`.
- `docs/ARCHITECTURE.md`: rationale for each change above. `docs/BUG_BACKLOG.md`: items 17, 18 and 26 marked done.
- New specs: `page-performance`, `tmdb-proxy-cache`, `endpoint-time-budgets`. Updated: `load-states`, `container-deployment`, `recommendation-refresh`, `title-metadata`, `notifications`, `account-security`, `input-validation`, `auth-session`, `data-backup`.

### Tests
- The backend suite grew from 318 to 372 tests: proxy cache (TTL tiers, credential bypass, errors not cached, alias isolation), page size, `CONN_MAX_AGE`, 404 handling at every recommendations/notifications site, backfill health, the own-stamp clear, followed-people and Stats genre budgets, blank-email profiles, the 1900 bound and the Stats overflow guard.
- Jest grew from 224 to 245 tests: `fetchAllPages` past page 1, in-flight request sharing, `TrailerEmbed`, `LoadMoreError`, the infinite-scroll failure loop, `usePaginatedFetch` load-more errors, and stale-session response guards.
- E2E: new `e2e/session-expiry.spec.ts` (forced logout returns to the page); TS and Python detail-page mocks moved to the combined `append_to_response` shape; Python profile tests follow the dialog's reset behavior.

## [0.21.0] - 2026-10-09

Bug-audit release, part 6. A third and fourth audit (2026-10-09) logged backlog items 16–25 in `docs/BUG_BACKLOG.md`. This release implements two OpenSpec changes from them, `fix-ci-lint` (item 16) and `harden-security-3` (item 22, plus two log fixes from item 17), both archived under `openspec/changes/archive/`. Items 17–21 and 23–25 are still open.

### ⚠️ Notes for deploy
- **`EMAIL_BACKEND` is now required when `DEBUG` is off.** Without it the backend refuses to start and names the setting, so a deploy can't silently print live password-reset links to the log. `.env.docker` already sets it. To send no mail, set it explicitly to `django.core.mail.backends.console.EmailBackend`.
- **New migration `0022_watchedentry_metadata_settled`.** It's additive: one boolean column, plus a data step that marks titles the backfill had already found missing on TMDB.
- **A TMDB connection in progress during the deploy fails once.** The user clicks Connect again.
- **Unverified on the dev machine (no Docker):** `nginx -t` on the new `log_format`/`map` lines. `test_nginx_conf.py` checks the config statically. If nginx rejects it, the frontend container won't start and the old image keeps serving.

### Security (`harden-security-3`)
- **Connecting TMDB completes only for the account that started it.** The server remembers the request token it issued to each user and accepts only that token, once, within 60 minutes. Before this, a link like `/tmdb-callback?request_token=<T>&approved=true` for a token the sender had approved in their own TMDB account would connect the victim's account to it, and every later rating would sync to the sender. A refused link says to connect again from your profile. Reconnecting also revokes the previous TMDB session.
- **TMDB credentials never reach the logs.** Log redaction now also strips `session_id` and `request_token` values, which `requests` puts in every HTTP error message. Rating sync logs only the error type. A user who never connected TMDB no longer writes an ERROR traceback on every rating.
- **Imports can't flood TMDB.** A metadata backfill run fetches at most 100 titles, newest watches first. A title TMDB doesn't know is now marked in the database, so other server processes and restarts never refetch it. It used to be held per process, so the same missing titles were fetched again by every worker after every restart. The in-memory failure backoff is capped at 10,000 entries.
- **Reviews (5000 characters) and list descriptions (200) are capped**, on single and bulk writes. They had no limit, so one account could store multi-megabyte values that every load of its ratings or lists pulled into a server worker. Text already stored above the caps still loads. The rating dialog shows a character count.
- **Repeated failed logins for one username are limited.** After 20 failures within an hour, from any number of IPs, sign-in for that username returns `429` until the hour passes, whether or not the password is right. This is on top of the per-IP limit. Password reset still works.
- **Password-reset email is sent in the background**, so the response time no longer shows whether an email is registered. The remaining trade-offs are documented in `docs/ARCHITECTURE.md`.
- **Profile photos are re-encoded on upload.** Location, camera serial and other embedded details are removed, the photo stays upright, and a truncated image is rejected.
- **The nginx access log never records password-reset links or TMDB callback tokens**, in either the request line or the referer. The reset page's own API call carries the reset link as its referer.
- **Oversized backups are refused before unpacking.** The importer rejects files over 50 MB, or ZIPs whose entries would expand past 50 MB each or 200 MB in total, so a crafted ZIP can't freeze the tab.

### Fixed
- `main`'s CI was failing at lint: a test's `"javascript:alert(1)"` input tripped `no-script-url`, so Jest and the build never ran in CI (`fix-ci-lint`). The rule stays on for app code.

### Docs
- `docs/BUG_BACKLOG.md`: items 16–25 from the third and fourth audits. The fourth round added cross-cutting passes (sibling hunt, cross-feature flows, adversarial security, spec conformance) and the first live Playwright run of the app.
- `docs/ARCHITECTURE.md`: rationale for each security change above, and the trade-offs accepted with them.
- CLAUDE.md: `TRUSTED_PROXY_COUNT`'s settings default is 0 (compose sets 1), and the new log, backfill, avatar and nginx conventions.

### Tests
- The backend suite grew from 270 to 318 tests. New cases cover TMDB connect binding, replay, expiry and revocation, credential redaction, rating-sync logging, the backfill cap and the persisted settled state (including the migration's data step), length caps, the per-username login limit, background reset mail, email fail-closed, avatar EXIF and orientation, and nginx log redaction.
- Jest grew from 220 to 224 tests (backup size guard, read against the installed JSZip).

## [0.20.0] - 2026-10-08

Bug-audit release, part 5. Implements the five OpenSpec changes from the second audit (`docs/BUG_BACKLOG.md` items 11–15): `fix-session-sync`, `honest-tests`, `surface-failures-2`, `harden-backend-2` and `harden-deploy-2`, all archived under `openspec/changes/archive/`. Every backlog item is now closed.

### ⚠️ Notes for deploy
- **Docker: the database password moves to its own file.** Before the next `docker compose up`: `cp .env.db.example .env.db`, set `POSTGRES_PASSWORD` to the value currently in `.env.docker` (keep it the same, since the existing `pgdata` volume was initialized with it), then delete both `POSTGRES_PASSWORD` and `DB_PASSWORD` from `.env.docker`. Without `.env.db`, compose refuses to start and names the file. See README → Docker Setup → "Upgrading an existing deployment".
- **New migration `0021_userrecommendationcache_refreshing_since`.** It's additive (one nullable column).
- **Frontend dependencies changed:** run `npm ci`. axios 1.7.2 → 1.20.0, react-router-dom 6.24.1 → 6.30.6. `json2csv`, `file-saver`, `@types/file-saver` and `@testing-library/user-event` were removed, and `concurrently` and `@testing-library/*` moved to `devDependencies`.
- **Node 22** is now declared (`.nvmrc`, `engines`). A newer Node only warns.
- `TRUSTED_PROXY_COUNT` is now set from the environment in compose (default 1). Behind an extra proxy or TLS terminator, set it in the shell or the root `.env`.
- The Docker checks for this release (`nginx -t`, the cache/404 curls, `docker compose config`) were waived on the dev machine (no Docker there). `test_nginx_conf.py` checks the config statically; verify the rest on first deploy.
- Two react-router advisories are fixed only in v7 and don't apply to how the app uses the router. They wait for a v7 upgrade (see `docs/BUG_BACKLOG.md`, item 14).

### Fixed — sessions across tabs (`fix-session-sync`)
- Each tab is bound to the account it shows. Signing out in another tab signs this one out, signing in as a different account in another tab reloads this one, and a profile update in another tab is adopted. Until the other tab's change arrives, the API client refuses to send a request with another account's token. Writes used to land in the wrong account.
- Token refresh and logout have their own `token_refresh` throttle (60/min per IP) instead of the shared `anon: 300/day` bucket. About 12 users behind one NAT could exhaust that and get logged out.
- Only a rejected refresh (`400`/`401`) ends the session. A `429`, `5xx`, timeout or network error fails the request and keeps you signed in.
- A password rehash during a profile edit now reissues this session's tokens, so saving your profile can't sign you out.

### Fixed — failures shown as failures (`surface-failures-2`)
- Following, the Calendar and the "from people you follow" recommendations show an error with Retry when they fail to load, instead of an empty state. The profile dialog shows an "unknown" TMDB state instead of offering Connect when the status check fails.
- The Calendar and the hero banner ignore responses for a filter or media type you've already left.
- Register and the create/edit list dialogs submit once, even on a double-click.
- Error messages never show an HTML error page or a raw network error. A network failure says "Can't reach the server. Check your connection and try again."
- The sidebar avatar is a real "Edit profile" button, and Sign Out is labelled. List cards, Search results and Recommendations/Following cards open from the keyboard (poster links).
- Lists show their creation date as your local day, and Stats' recently-watched dates use `dd-mm-yyyy`.
- Calendar `.ics` export is standards-compliant (`DTSTAMP`, escaped titles, folded long lines).
- Home and Anime infinite scroll stop at TMDB's 500-page limit instead of erroring.
- The search term and tab are in the URL (`/search?q=…&tab=…`), so reload, a shared link or a sign-in round trip shows the same results.

### Fixed — backend hardening (`harden-backend-2`)
- Time-zone values that are tzdata directory names (`America`, `Etc`, `America/Argentina`) fall back to UTC instead of causing a 500 on Stats, notifications, mark-watched and watched imports.
- Recommendation refreshes no longer write to the database from worker threads (each opened and leaked its own connection), and the refresh thread closes its connection when it ends.
- A refresh during a TMDB outage keeps the previous recommendations instead of replacing them with empty ones for 12 hours.
- The recommendations "updating" status is right whichever server process answers. It used to say "ready" while another worker was still refreshing. A refresh killed mid-run stops counting after 10 minutes.
- A notifications poll fetches at most 40 uncached people within 15 seconds and caches each as it arrives. Hundreds of follows used to run past gunicorn's 30s timeout on every poll, so the worker was killed and nothing was ever cached. Large follow lists are now covered over consecutive polls.
- Avatars get a new file name per upload, so a new photo shows at once instead of the cached old one. The old file is deleted only after the new one is saved, so a failed replace keeps your photo. Deleting your account deletes the photo too.
- Disconnecting TMDB, or deleting your account while connected, revokes the session on TMDB's side (best-effort, never blocking).

### Fixed — deploy and dependencies (`harden-deploy-2`)
- A redeploy never leaves an open tab on a blank page: `index.html` is sent with `Cache-Control: no-cache`, and a missing old chunk is a 404 instead of `index.html` served as JavaScript. No security header was lost.
- The database container receives only its password, not the app's secret key, TMDB key or mail credentials. The password is defined once, in `.env.db`.
- Both `.dockerignore` files exclude every env file and editing copy (`.env.*`, `*.env.bak`) except the committed examples.
- CI installs a pinned ruff (0.15.16) and builds the same CSP-safe bundle the image ships (`INLINE_RUNTIME_CHUNK=false`).

### Security
- **TMDB proxy calls carry the user's token**, so its rate limit applies per user, not per shared IP. A `401` on this public data is retried once without the token and never ends the session.
- **Detail and person pages accept only a numeric id.** A crafted URL like `/movie/..%2F..%2Fwatchlist` used to make the TMDB proxy path request `/api/watchlist` instead. It now shows "Page not found" and fetches nothing.
- **Exported CSVs can't run as spreadsheet formulas.** Cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'`, and the app's importers remove it again, so backups round-trip exactly and older backups import unchanged.
- **A TMDB person homepage becomes a link only for `http`/`https` addresses.** A `javascript:` value is shown as text.

### Tests (`honest-tests` and the changes above)
- Tests that couldn't fail were fixed: `if locator.count() > 0:` guards, "network error" tests that only checked the page body, sleeps before asserting absence, and bare-array list mocks (Python mocks now reject them like the TS fixtures).
- E2E mock records match the API's serializers, and `test_e2e_mock_shapes.py` pins them so they can't drift.
- New coverage includes tab sync, the token-refresh throttle, load failures, double-submit, search URLs, invalid route ids, untrusted links, the nginx config, CSV neutralization, the TMDB client's token handling and every backend fix above. Each new test was shown to fail against a temporary break of the behavior it covers.
- Found while testing: the refresh-status stamp wasn't cleared when a short refresh started and finished in the same clock tick (Windows), which left the status "updating" for up to 10 minutes. Fixed.

## [0.19.0] - 2026-10-07

Bug-audit release, part 4. Implements the remaining six OpenSpec changes from `docs/BUG_BACKLOG.md`: `user-local-dates`, `a11y-routing`, `harden-docker`, `fix-nav-polish`, `harden-logging` and `fix-password-revoke-race`, all archived under `openspec/changes/archive/`. This closes items 0–10 of the first audit. A second full audit, run after these changes, logged items 11–15 in the backlog; none of them are fixed in this release.

### ⚠️ Notes for deploy
- **Every user is signed out once.** Tokens are now bound to the password (see Security), and tokens issued before this release carry no password claim, so they're rejected at their next use.
- **Rotate the TMDB API key if old production logs were ever shared.** Before this release, urllib3's retry warnings wrote the full TMDB URL, `api_key` included, to stderr (`docker logs`) unredacted.
- **Docker: one-time media-volume ownership fix.** The backend container now runs as an unprivileged `app` user (uid 10001), and the existing `media_data` volume was created by the old root container. Follow README → Docker Setup → "Upgrading an existing deployment" before the first `docker compose up --build`.
- **Docker: the backend now uses only the migrations baked into the image** (no host bind mount, and `migrate --noinput` instead of `--run-syncdb`). Rebuild both images.
- **New migration `0020_watchedentry_watched_tz`.** It's additive: existing entries get a blank time zone and keep displaying in the viewing device's zone.
- `tzdata` is now a direct backend dependency (`requirements.txt` + `constraints.txt`).
- The Docker checks for this release (image build, container uid, nginx header emission, media chown) were waived on the dev machine (no Docker there). Verify them on first deploy.

### Fixed — dates follow the user's day (`user-local-dates`)
- "Today" uses the requesting device's time zone, sent as an `X-Timezone` header on every authenticated request. A missing or unknown zone falls back to UTC and never errors.
- Each watched entry stores the time zone it was logged in (`watched_tz`). The Watched page date, the Stats heatmap, the monthly chart and "recently watched" use it, so a watch never moves to a different day on another device.
- The Watched page shows a short zone label (e.g. `07-10-2026 · IST`) when a watch was logged in a zone whose offset differs from this device's.
- The Calendar's 7-day window, and the notification window and its unread rule, use the device's local day (they used the UTC day).
- Watched CSV export and backups carry a `watched_tz` column. Older backups without it still import.

### Fixed — accessibility and routing (`a11y-routing`)
- Every card that opens a detail or person page is a real link: Tab, Enter, and middle-click or Ctrl/Cmd+click to open a new tab. This covers detail-page Recommendations/Similar, cast cards, person credit tabs, Home's Recently Watched, Calendar, `PersonCard` and `LibraryItemCard`. Cards with their own buttons keep them as separate controls.
- A visible focus outline in both themes.
- The TV detail page's episode-progress icon buttons have accessible names.
- Unknown URLs show a "Page not found" page instead of silently redirecting to Movies.
- A signed-in user who opens `/login`, `/register` or `/forgot-password` is sent on to where they were headed, without the login form flashing. Password-reset links still work while signed in.

### Fixed — navigation (`fix-nav-polish`)
- The notification popup opens fully on-screen at every breakpoint. It used to open 85–290px off the left edge. In the 64px sidebar rail, the bell itself used to be clipped off-screen; the rail footer is now a 2-column icon grid that takes no extra height.
- Phones get a Filters button in the bottom nav on Movies, TV and Anime. Below 768px there was no way to open the browse filters at all.
- CINE DB app icons (a gold "C" monogram, from `public/icon.svg`) replace the React-logo favicon and install icons.

### Security
- **Password changes end other sessions immediately and reliably** (`fix-password-revoke-race`). Tokens carry a password-bound claim (simplejwt `CHECK_REVOKE_TOKEN`), and the token-refresh endpoint now checks it too. A refresh that was in flight on another device during a password change used to mint a token that survived revocation and kept rotating. Other devices' access tokens now stop at once instead of lasting up to 60 minutes.
- **The TMDB API key no longer reaches logs** (`harden-logging`). The redacting log handler moved from the app's logger to the root logger, so Django, urllib3 and every other library is redacted.
- **Production 500s are logged with a traceback.** With `DEBUG` off they used to log nothing at all. Routine 4xx responses stay out of the log.
- **Docker hardening** (`harden-docker`):
  - the backend runs as non-root, and `media/` is excluded from the build context
  - nginx sends a Content-Security-Policy matching exactly what the app loads, HSTS when the request arrived over HTTPS, and `X-XSS-Protection: 0`
  - the React build stops inlining its runtime chunk, so `script-src 'self'` needs no inline exception
  - with `DEBUG` off, the API renders JSON only, and `STATIC_ROOT` is set

### Changed
- Removed the unused `web-vitals` dependency.
- `.gitignore` ignores every `.env.*` file except the committed `.env.example` templates.
- `NotificationBell` takes its popup placement from its host. The sidebar footer's layout moved from inline styles into `App.css` classes.

### Docs
- `docs/BUG_BACKLOG.md`:
  - items 0–10 are done
  - the migration-0018 item was closed as won't-fix
  - the second audit is logged as items 11–15 (`fix-session-sync`, `harden-backend-2`, `surface-failures-2`, `harden-deploy-2`, `honest-tests`), plus 4 rounds of follow-up hunts and a longer "verified fine" list
- `CLAUDE.md` and `docs/ARCHITECTURE.md` updated: per-host popup placement and the rail icon grid, password-bound tokens, root-logger redaction, local dates, `CardLink`, and the Docker runtime rules.

### Tests
- Django pytest 226. New: local dates, logging redaction, password-bound tokens, production rendering.
- Jest 157 in 22 suites. New: `CardLink`, `formatDate`, `postLoginPath`.
- pytest-playwright 176. New: a11y/routing, local dates.
- Playwright TS 38 per project (chromium + mobile-chrome). New: the notification popup stays inside the viewport and anchored on scroll at 7 viewport/page combinations; the phone Filters button; the bottom nav fits at 320px.
- New capability specs in `openspec/specs/`: `local-dates`, `accessibility`, `routing` and `container-deployment`. `data-backup`, `notifications`, `browse-filters`, `app-identity`, `api-hardening`, `service-health` and `auth-session` gained or changed requirements.

## [0.18.0] - 2026-10-07

Bug-audit release, part 3. Implements five OpenSpec changes from `docs/BUG_BACKLOG.md` (`fix-browse-filters`, `fix-data-correctness`, `ci-coverage`, `fix-dependency-drift`, `frontend-polish`; archived under `openspec/changes/archive/`). Findings left over, plus 4 found while verifying this release, stay in the backlog (items 5, 7d, 7e, 8).

### ⚠️ Notes for deploy
- **Django 5.2 LTS.** `requirements.txt` used to say `django<5.0` while dev and tests ran 5.2. Every backend dependency is now pinned, with a generated `backend/constraints.txt` for transitive ones; install with `pip install -r backend/requirements.txt -c backend/constraints.txt`.
- **Rebuild the Docker images.** The backend image is now `python:3.12-slim` and installs with the constraints file; the frontend build image moves from `node:18-alpine` (end of life) to `node:22-alpine`. The image build and compose healthcheck haven't been run on this release yet (no Docker on the dev machine); the same pinned set passed the full backend suite in a fresh Python 3.12 venv. Run `docker compose build --no-cache && docker compose up` and check `python -m django --version` reports 5.2 on first deploy.
- No new migrations.
- The TMDB proxy now always uses the server's API key; a client-supplied `api_key` query parameter is dropped.

### Fixed — browse filters and navigation
- Genre chips follow the media type: TV and Anime-TV show TV genres ("Action & Adventure", "Sci-Fi & Fantasy"), movie pages show movie genres. Picks reset when the media type changes, so a movie-only genre id is never sent to TV discover.
- Picking a genre always applies: it switches the grid to discover, since category endpoints ignore `with_genres`.
- "Filters active" counts only real filters; `includeAdult: false` and the default sort no longer do, so category buttons keep working after Apply/Reset.
- Applied filters belong to one media type and reset when moving between Movies, TV and the Anime tabs (a hidden runtime filter no longer carries over to TV). Movie-only sorts map to their TV equivalent or are dropped.
- Anime "Airing Today" shows only anime with an episode airing today.
- Browser Back / swipe-back from a detail page restores the browse page's category, Anime tab, loaded pages and scroll, like the in-app Back button.
- Search tabs each keep their own scroll position.
- A For You snapshot taken mid-computation no longer stops polling for 5 minutes.
- The login redirect keeps the original query string and hash.
- List detail pages keep search/sort/type filter per list; Watched pagination steps back when the current page empties; library search trims the query; Home's Recently Watched shows the newest title first.

### Fixed — data correctness (backend)
- New-release notifications cover every followed person, not just the 10 most recent. Each person's TMDB credits are cached for 6 hours; a failed fetch is never cached.
- A failed TMDB call never overwrites cached title data with empty genres/cast; the existing row is kept, or nothing is stored so the next run retries.
- Watched titles get genres, language and release year filled in regardless of library size (Stats' Top Genres and Rating by Genre used to stay empty below 3 watched titles). One bounded background backfill per user (new `metadata_backfill.py`) replaces a fresh 20-worker pool per `/stats` request; unknown titles aren't retried, failed ones back off for an hour.
- Mark-as-watched stores original language and release year (the endpoint accepted and dropped them; the dialog now sends them).
- Editing a rating syncs to a connected TMDB account; re-rating updates `rated_at`.
- Recommendation section keys are unique (media type in "because you watched" keys, person ids for actor/followed sections, same-label clusters merged).
- List items come back newest-first with an id tiebreaker; the TMDB proxy keeps repeated query parameters.

### Fixed — frontend polish
- Stats in light mode: labels, heatmap month/legend labels, empty heatmap cells, chart and heatmap tooltips and poster captions use theme tokens. Light mode used to draw them near-white on cream (the heatmap was invisible). Dark mode is unchanged apart from a slightly bluer tooltip background.
- For You: a failed load shows the shared error with a Retry that refetches in place, instead of reloading the browser tab.
- Installed-app name and page description say "CINE DB" (they said "React App" / "Web site created using create-react-app"); `theme-color` matches the dark background.
- `FilterPanel` drawer and `NotificationBell` popup no longer use a bare fixed width; Add to List inputs have `id`/`name`/`autoComplete="off"`.
- Dev only: `usePaginatedFetch` no longer fetches every first load and Back-restore twice under StrictMode.

### Changed
- One `ratingColor()` / `avatarColor()` in `src/utils/colors.ts` replaces 5 and 2 copies; remaining hardcoded green/gold hex values use `WATCHED_GREEN` / `RATING_GOLD`; new `RATING_WARN`, `RATING_BAD`, `STILL_URL`, `LOGO_URL` constants.
- All 7 explicit `any`s in `src/` replaced by real types (`TMDBTVDetail.created_by`, `TMDBMovieDetailResponse` for the raw detail fetch; `RegisterPage` catches `unknown`).
- Removed CRA leftovers: `src/logo.svg`, `src/reportWebVitals.ts` and the template comments in `public/index.html`.
- Stale Express references removed from `docs/ARCHITECTURE.md` and the e2e conftest.

### CI and tests
- CI runs on Node 22 / Python 3.12 and now also checks `tsc` (app + e2e specs), `eslint --max-warnings=0` and `makemigrations --check`. The TypeScript Playwright suite runs in a new `e2e-ts` job (chromium + mobile-chrome); the dead `TMDB_API_KEY` is gone from the frontend build env.
- Both e2e suites register a strict catch-all first: an unmocked app API call fails the test with its URL. List mocks use the real paginated shape.
- Stale TS specs fixed (`auth.spec.ts` password label, `movies.spec.ts` mobile search box).
- A backend test fails if the installed Django's major.minor doesn't match the pin.
- Tests: Django pytest 197 (new: lists, followed people, episode progress, profile, recommendation endpoints, metadata backfill, data correctness, dependency versions). Jest 123 in 19 suites (new: browse filters, browser-Back restore, color helpers, `FollowedPeopleProvider`, `useEpisodeProgress`). pytest-playwright 166 (browser-Back restore, For You retry). Playwright TS 27 per project.
- 11 new capability specs in `openspec/specs/` (`browse-filters`, `view-state-restore`, `library-filters`, `title-metadata`, `ratings`, `recommendation-sections`, `user-lists`, `ci-pipeline`, `e2e-fixtures`, `app-identity`, `theme-readability`); `login-page`, `notifications`, `api-hardening` and `load-states` gained requirements.

## [0.17.0] - 2026-10-06

Bug-audit release, part 2. Implements three OpenSpec changes from `docs/BUG_BACKLOG.md` (`harden-input-validation`, `fix-backup-roundtrip`, `surface-failures`; archived under `openspec/changes/archive/`).

### ⚠️ Notes for deploy
- **Migration `0019_bulk_import_timestamps`:** `added_at` / `watched_at` / `rated_at` move from `auto_now_add` to `default=timezone.now`, so bulk imports can keep original timestamps. Single-item creates behave as before.
- **Watchlist and rating `PATCH` can no longer change `mediaId`/`mediaType`** (now a `400`). The frontend never sent these.

### Security / input validation
- Malformed input gets a `400` with a field message, never a `500`, and is never stored in a form that breaks later reads.
  - `NaN`/`Infinity` rejected for every float input. A stored `NaN` used to make every later GET of that account's watchlist/watched/ratings/lists/stats return `500`.
  - String inputs limited to their column length; ids must be positive and fit Postgres `integer`; `mediaType` is `movie`/`tv` only; `releaseYear`, `runtimeMinutes`, episode `season`/`episode` bounded.
  - Endpoints that read the body directly (bulk watched, follow, episode progress, login, delete account, password reset ×2, TMDB session) return `400` on a JSON array body or wrong field types.
  - Ratings must be a multiple of 0.5 (TMDB rejects anything else).
- Avatar: decompression-bomb images and any other decoder failure get a `400` ("File is not a valid image.").
- Profile username follows the registration character rules; two concurrent renames to the same name return `400` instead of an IntegrityError `500`.

### Fixed — backup and import
- **Backup format v2:** the ZIP gains `manifest.json` (lists with names, descriptions and empty lists) and `ratings.csv`; `watched.csv` gains `runtime_minutes` and `platform`. v1 backups still import unchanged.
- Restore keeps original `watched_at`/`added_at`/`rated_at`, runtime, platform, ratings with reviews, and list names/descriptions. Existing entries are never overwritten, and re-running an import creates no duplicates.
- Every import write is awaited; each section reports what it actually added, skipped and failed, and one failed section no longer stops the others.
- New `POST /api/watchlist/bulk/` and `POST /api/ratings/bulk/`; `POST /api/watched/bulk/` accepts per-entry type, timestamp, runtime and platform. All create-only and all-or-nothing per request; the client sends at most 500 entries per request.
- One RFC 4180 CSV parser for every import (quoted commas/quotes/newlines, CRLF, BOM, `,`/`;`/tab delimiters). Single-file imports honor a `type`/`media_type` column and let you re-select the same file.
- Paginated watched/watchlist/ratings/followed-people/lists endpoints add an `id` tiebreaker, so bulk-imported rows with identical timestamps no longer page as duplicates or get skipped.

### Fixed — failures shown as empty or success (frontend)
- Every load now ends as loading, error with Retry, empty, or content:
  - A failed watchlist/watched/ratings/lists load shows an error with Retry instead of "your watchlist is empty". Library pages show a skeleton on the first frame instead of the empty-state call to action.
  - A failed Stats request shows an error, not "Start watching…".
  - Movie/TV detail pages only fail when the main details request fails; a failed reviews/similar/providers/credits/images call just empties that section. Unknown ids show "not found". Retry refetches in place instead of reloading the browser.
  - Person page: unknown id shows "not found" instead of a blank page; switching people never shows the previous person; a title the person has several roles in appears once.
  - Browse/search grids clear the previous category's results, show an error with Retry when the first page fails, and drop "load more" responses from an earlier query.
  - Episode guide no longer gets stuck on its skeleton when switching back to a loaded season; episode progress resets when the show changes.
- Writes report their real outcome:
  - "Marked as watched/unwatched", clear watchlist, clear/delete list, remove from list, follow/unfollow and episode-progress updates show success only after the server confirms, and an error otherwise.
  - The rating dialog stays open with the stars and review text when a save fails.
  - A double-click on any watchlist/watched/follow/list toggle sends one request and shows one message.
- Notifications: one poller for the whole app (the sidebar and bottom-nav badges always agree), and items that were unread when you open the dropdown stay bold until you close it.
- The profile dialog's Danger Zone password and new-password fields are cleared when it closes and after a failed account deletion.

### Added
- **Remove rating** button in the rating dialog for titles you've rated.
- 5 new OpenSpec capability specs in `openspec/specs/`: `input-validation`, `data-backup`, `load-states`, `write-feedback`, `notifications`; `account-security` and `avatar-upload` gained requirements.
- Tests: Django pytest now 151 (new: input validation, bulk import). Jest now 93 in 14 suites (new: bulk-import client, backup/CSV round-trip, in-flight dedupe, library-hook load/error states, `usePaginatedFetch`). pytest-playwright now 158 (stats error + Retry).

### Changed
- Followed people and notifications state moved into app-wide providers (`FollowedPeopleProvider`, `NotificationsProvider`); a grid of person cards makes one request instead of one per card.
- `useToast` is memoized and collapses identical messages.

## [0.16.0] - 2026-10-05

Bug-audit release. Implements four OpenSpec changes (`harden-security-p0`, `fix-ops-reliability`, `fix-session-lifecycle`, `fix-session-followups`; archived under `openspec/changes/archive/`). Remaining audit findings are tracked in the new `docs/BUG_BACKLOG.md`.

### ⚠️ Breaking (deploy config)
- **Production settings fail closed.** `DEBUG` now defaults to **off** when unset (was on). With it off, the backend refuses to start on an empty or wildcard `ALLOWED_HOSTS`, or on the built-in dev `SECRET_KEY`.
  - Any `.env.docker` with `ALLOWED_HOSTS=*` must list real hosts, e.g. `ALLOWED_HOSTS=localhost,<host-lan-ip>`. Keep `localhost`: the compose healthcheck calls it.
  - `npm run dev` (`start.py`) and pytest (`backend/pytest_dev_env.py`) turn `DEBUG` on themselves. For hand-run `manage.py` commands, set `DEBUG=True` in `backend/.env`.

### Security
- **TMDB API key leak:** TMDB-auth endpoints echoed upstream exception text, which included the request URL with `?api_key=`. They now return a generic 502. Server logs redact the key (`userdata/logging.py` `RedactingFormatter`). `redirect_to` is URL-encoded instead of interpolated raw.
- **Stored XSS via avatar upload:** the stored extension came from the client filename, so a PNG/HTML polyglot named `x.html` was served as `text/html` from the app's own origin. The extension now comes from the decoded image format (JPEG/PNG/WebP only). Migration `0018` renames or removes legacy avatars with unsafe extensions.
- **Account takeover:** changing the account email now requires the current password, is rejected when another account already uses that email (case-insensitive), and notifies the old address. Previously a stolen access token → email change → password reset was a full takeover.
- **Sessions revoked on password change/reset:** both now revoke every outstanding refresh token for the account. A profile password change returns a fresh token pair so the current session stays signed in.
- **Server-side logout:** new `POST /api/auth/logout/` blacklists the session's refresh token. The client calls it best-effort on logout.
- **Password reset links** now expire after 1 hour, matching what the email says (Django's default was 3 days).
- **Rate-limit bypass:**
  - Client identity uses a configured trusted-proxy count (`TRUSTED_PROXY_COUNT`; compose sets 1 for nginx), so a spoofed `X-Forwarded-For` no longer mints a fresh bucket.
  - Counters live in a shared `DatabaseCache` instead of per-worker LocMem, which had tripled every limit. The cache is sized to 50k entries; the default 300 culled live counters.

### Fixed
- **Forced logout ~2 hours into every session:** the client never stored the rotated refresh token, so the second refresh always sent a blacklisted one. Rotated tokens are now persisted.
- **Concurrent 401s:**
  - A late 401 for a request sent with an already-replaced access token is replayed with the current token instead of triggering a second refresh.
  - Two tabs refreshing at once no longer log each other out: refreshes are serialized with `navigator.locks`, and a tab that loses the race waits up to 1.5s for the other tab's rotation to reach it.
  - A refresh that completes after logout no longer signs the user back in.
- **Previous user's data leaking in a shared tab:** logout left the previous account's data in the tab for the next user. One teardown (`clearSession()`) now clears tokens, cached user, all `sessionStorage` caches and recent searches, and keeps theme/sidebar prefs. Recommendations/Search unmount saves go through `saveSessionCache()`, so they can't write data back after logout.
- **Duplicate writes on 500:** the automatic retry-on-500 re-sent POSTs (e.g. duplicate lists). It now applies to `GET`/`HEAD`/`OPTIONS` only.
- **Docker backend marked unhealthy after ~50 minutes:** the health endpoint was subject to the anonymous throttle (300/day) while compose polls it every 10s. It is now unthrottled.
- **Docker entrypoint could hang before starting gunicorn:** its `compute_recommendations` warm-up had no timeout. Now capped at 30s, like `start.py`.
- **Recommendation refresh storm:**
  - Clearing a 500-item watched history started 500 concurrent refresh threads. Refreshes are now coalesced per user (one running + at most one follow-up), deferred until the transaction commits, and skipped during account deletion.
  - A DB error while loading the user no longer leaves recommendations stuck on "pending" until restart.
- **Slow password change/reset:** revoke-all touches only live, not-yet-blacklisted tokens in two queries. It used to run 2 queries per token ever issued.
- **TMDB proxy could hold a gunicorn worker ~100s** (20s timeout × 5 attempts). The worst case is now ~22s: `timeout=(3.05, 6)`, `Retry(total=2, connect=2, read=1)`. A test enforces it against the now-explicit `gunicorn --timeout 30`.
- `useLibraryFilters` Jest test "filters by type" had been failing since 0.15.8 (no `getType` passed, so the filter was a deliberate no-op), which kept the CI Jest job red.

### Changed
- `djangorestframework-simplejwt>=5.5.0` (records rotated tokens as outstanding, needed for revoke-all) and `pytest>=8.4` (needed by `pytest.ini`'s `-p pytest_dev_env`).
- The TMDB host is configurable via `TMDB_API_HOST` and defaults to `api.tmdb.org` (official alternate host; fewer TLS resets on some networks).
- New `.gitattributes` forces LF for `*.sh`, so `docker-entrypoint.sh` runs when the image is built from a Windows checkout.

### Added
- 6 new OpenSpec capability specs in `openspec/specs/`: `auth-session`, `account-security`, `avatar-upload`, `api-hardening`, `service-health`, `recommendation-refresh`.
- `docs/BUG_BACKLOG.md`: the remaining audit findings, grouped into planned changes.
- Tests: Django pytest now 92 (new: account security, session revocation, settings fail-closed, throttle identity, health, TMDB auth, refresh coalescing). Jest now 52 (new: API client session handling, logout teardown). README test counts, which were stale, are corrected.

## [0.15.8] - 2026-08-26

### Changed
- Extracted the search `Input`/sort `Select`/type-filter `Select`/"Clear filters" `Button` chrome duplicated across all 6 list/browse pages (`WatchlistPage`, `WatchedPage`, `ListDetailPage`, `ListsPage`, `FollowingPage`, `RecommendationsPage`) into a new shared `FilterBar.tsx` component — presentational only, no change to any page's filtering behavior.
- Widened `useLibraryFilters.ts` with optional `getTitle`/`getType` accessor params (dropped its `T extends LibraryItem` generic constraint) and `MediaGrid.tsx` with an optional `colSpan` override — both default to prior behavior, so `WatchlistPage`/`WatchedPage` needed no changes. `ListsPage.tsx` and `FollowingPage.tsx` now run through `useLibraryFilters` instead of hand-rolled `search`/`sortKey` state + sessionStorage effects; `ListDetailPage.tsx` now renders through `MediaGrid` (`colSpan={{ md: 4 }}`, preserving its existing 6-cards-per-tablet-row density) instead of its own `Row`/`Col`. `RecommendationsPage.tsx` stays off both — grouped-sections shape and no sort control, a structural mismatch documented in CLAUDE.md rather than left as an open migration candidate.

### Fixed
- `tmdb_proxy_views.py`'s `tmdb_proxy` view narrowed its bare `except Exception:` to `except (requests.RequestException, ValueError):`, matching the project's stated exception-handling convention and the two failure modes the try block can actually raise (TMDB connection failure, non-JSON response) — a genuinely unexpected exception now surfaces as a 500 instead of a misleading 502. Added `test_tmdb_proxy.py` confirming the clean-502 behavior is unchanged.

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
- LAN access broke as a side effect of the Express removal above: Express always talked to Django via `localhost:8000` internally, so Django's `ALLOWED_HOSTS` check never saw a request's real Host header; with the browser now hitting Django directly, a LAN device (e.g. `<host-lan-ip>:8000`) got a `DisallowedHost` 400 on login. `backend/cinedb/settings.py` now appends `"*"` to `ALLOWED_HOSTS` under `DEBUG`, mirroring the wildcard `CORS_ALLOW_ALL_ORIGINS` already gets in dev.
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
- `GET /api/watched/` (and any other paginated list endpoint once a user has more than `page_size` rows) 500'd with `django.core.exceptions.DisallowedHost` — DRF's default `PageNumberPagination.get_paginated_response()` builds an absolute `next`/`previous` URL via `request.build_absolute_uri()`, which validates the request's Host header against `ALLOWED_HOSTS` (only bare `localhost` and its loopback address are implicitly allowed under `DEBUG=True`; a LAN IP or any other host 500s). Only fired for endpoints where a user has enough rows to need a `next` page — small lists (watchlist, followed-people) never hit it. `DefaultPagination` (`backend/userdata/pagination.py`) now overrides `get_next_link`/`get_previous_link` to return plain page numbers instead of absolute URLs; the frontend's `fetchAllPages.ts` only ever checked `next` for truthiness, so this is a drop-in fix with no frontend changes.
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
