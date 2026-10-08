Every task that adds or changes a test is done only when that test has been shown to fail against a temporary break of the behavior it covers, then the break was reverted.

## 1. Mock shapes

- [x] 1.1 Python `conftest.py`:
  - `MOCK_RATING`: `createdAt` → `ratedAt`
  - `MOCK_WATCHLIST_ITEM`: drop `watched`
  - `MOCK_WATCHED_ITEM`: add `watchedTz`, `platform`, `runtimeMinutes`, `originalLanguage`, `releaseYear`
  - `MOCK_STATS`: months as `"Jan 2024"` style, plus `totalRuntimeMinutes`
  - `MOCK_USER`: add `is_staff`, `avatar_url`
  - add a comment that `MOCK_*` stay dict literals
- [x] 1.2 Add `backend/userdata/tests/test_e2e_mock_shapes.py`:
  - `ast`-parse `e2e/python/conftest.py` and compare each `MOCK_*` record's keys with its serializer's `fields`
  - compare `MOCK_STATS` keys and month format with a real `/api/stats/` response for a seeded user
- [x] 1.3 Export `AuthUser` from `AuthContext.tsx`. Make `e2e/fixtures.ts`'s `MOCK_USER` `satisfies AuthUser` (adding `is_staff`, `avatar_url`), and type any other TS record mocks against the `*DTO` types
- [x] 1.4 Make `fulfill_json` reject a bare list for paginated endpoints (watchlist, watched, ratings, lists, followed-people), and wrap the 5 bare-array mocks (`test_watchlist.py` ×3, `test_watched.py` ×2) in `paginated()`
- [x] 1.5 Run the Python stats tests and fix anything the corrected `MOCK_STATS` exposes (e.g. an assertion that only passed on `NaN`)

## 2. Vacuous and racy assertions (Python e2e)

- [x] 2.1 `test_profile.py`: remove the 9 `if …count() > 0:` guards and assert the elements directly (save success/error, username/password validation)
- [x] 2.2 `test_detail.py`:
  - remove the 3 guards
  - make the 2 network-error tests assert the `LoadError` message and Retry button
- [x] 2.3 The "0 items" assertions (`test_browse.py:51`, `test_detail.py:150`, `test_search.py:95`) first wait for skeleton/spinner to be gone, with no fixed sleep
- [x] 2.4 Replace the remaining `wait_for_timeout` calls with condition waits (filtered result visible/hidden, `to_have_class` for theme). Any "nothing happens" wait that has to stay gets a comment and a positive anchor before it
- [x] 2.5 `test_stats.py`: hold the stats response on a `threading.Event`, assert the loading state, release, then assert the content. No sleep inside the handler
- [x] 2.6 Run each touched Python file 3× and confirm it is stable

## 3. Missing scenario tests (TS e2e + Jest)

- [x] 3.1 `e2e/auth.spec.ts` (login-page):
  - the 429 message
  - the username is trimmed in the request body
  - the username field is focused on load
  - inputs are disabled while a held login request is in flight
  - `/search?tab=people` → login → back on `/search?tab=people`
- [x] 3.2 New `e2e/notifications.spec.ts`:
  - sidebar and bottom-nav bells show the same count
  - opening shows unread items before mark-seen is called
  - closing calls mark-seen and clears the badge
- [x] 3.3 New `e2e/write-feedback.spec.ts`, each with a 500 response → error toast, UI unchanged:
  - clear watchlist
  - follow
  - episode progress (in Python `test_detail.py`, which already has the TV mocks)
  - failed rating save keeps the dialog open with its input
  - unfollow from a Following card updates the grid
- [x] 3.4 Accessibility in TS:
  - `ControlOrMeta`+click on a `MediaCardGrid` card opens a new page at the detail URL
  - the light-theme focus outline is visible after keyboard Tab
  - the episode-stepper buttons have accessible names (Python `test_detail.py`)
- [x] 3.5 Jest:
  - a double-click follow/watchlist toggle sends one request (`createInflight` slot)
  - identical toasts are deduped by key
  - different items stay independent
- [x] 3.6 Any real bug these tests expose:
  - trivial: fix it
  - otherwise: add a backlog entry under item 12/13/14 and mark the test `test.fixme` / `xfail(strict=True)` with the reference

## 4. Docs and verification

- [x] 4.1 README: remove the hardcoded per-suite test counts (feature bullet and `## Testing` headings), keeping the suite list and commands
- [x] 4.2 Re-check the CLAUDE.md drift items the audit listed. Fix any still wrong. Leave the CardLink rule to item 13
- [x] 4.3 Run `npm run typecheck`, `npm run lint`, Jest, backend pytest, `ruff check backend/`, the TS Playwright suite (both projects) and the Python e2e suite
- [x] 4.4 `docs/BUG_BACKLOG.md`: item 15 → 📝 proposed now, ✅ on archive. Add any new entries from 3.6
