## Why

Backlog item 15 (2026-10-07 audit, re-checked 2026-10-08). Several e2e tests can't fail, so they hide the bugs they were written to catch:
- 12 assertions sit behind `if locator.count() > 0:`, which doesn't wait, so on a slow render the whole check is skipped.
- Five list mocks still send bare arrays instead of the paginated shape.
- Mock records use field names the API doesn't send. The stats test passes while the page renders `NaN`.

The backlog orders this change before 13, 12 and 14 because those fixes rely on tests that can actually fail.

## What Changes

- **Vacuous checks:**
  - Remove every `if locator.count() > 0:` guard (9 in `test_profile.py`, 3 in `test_detail.py`) and assert on the element directly.
  - Make the "network error" tests in `test_detail.py` assert the `LoadError` state, not just that `body` is visible.
- **Bare-array mocks:** wrap the remaining ones in `paginated()` (`test_watchlist.py` 3, `test_watched.py` 2). Python mocks also get a guard that rejects a bare list on a list endpoint, the same way the TS fixtures do.
- **Mock records match the serializers:**
  - `MOCK_RATING.ratedAt`, not `createdAt`.
  - `MOCK_WATCHLIST_ITEM` drops `watched`.
  - `MOCK_WATCHED_ITEM` adds `watchedTz`, `platform`, `runtimeMinutes`, `originalLanguage` and `releaseYear`.
  - `MOCK_STATS` uses `"%b %Y"` months and adds `totalRuntimeMinutes`.
  - `MOCK_USER` (Python and TS) adds `is_staff` and `avatar_url`.
  - A backend test pins each mock's key set to its serializer's fields, so the mocks can't drift again.
- **Waits instead of sleeps:**
  - The "0 items" assertions in `test_browse.py`, `test_detail.py` and `test_search.py` wait for loading to finish first.
  - The ~24 `wait_for_timeout` calls are replaced with condition waits (debounced filters wait for the filtered result, theme tests wait for the attribute).
  - `test_stats.py` stops sleeping inside a route handler.
- **Tests for uncovered spec scenarios:**
  - notifications: bells agree, unread shown before marked seen, close marks seen
  - write-feedback: clear-watchlist fail, follow fail and double-click, episode-progress fail, a failed rating save keeps its input, toast dedupe, unfollow from Following
  - login-page: 429 message, username trim, autofocus, inputs locked in flight, `/search?tab=people` round trip
  - accessibility: Ctrl-click opens a new tab, focus outline in light theme, episode-stepper labels
- **Docs drift:**
  - README's per-suite test counts are stale (e.g. "197 pytest", there are 230). Remove the hardcoded numbers rather than re-count them every release.
  - Re-check the CLAUDE.md items the audit listed. Most were fixed in 0.19.0.
  - The CardLink-rule wording stays out of scope. It waits on the open decision, which defaults to converting the 3 `onClick` cards in item 13.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `e2e-fixtures`: adds two requirements. Mock records must use the API's field names and stay checked against the serializers. Assertions must wait for the state they check, never skip themselves or assert absence before loading finishes.

## Impact

- **Tests only, plus docs.** No app behavior changes:
  - `e2e/python/*` (conftest and most test files)
  - `e2e/fixtures.ts` and new TS specs
  - Jest hook tests (`useWatchlist`, `useEpisodeProgress`, `useToast` or similar)
  - a new backend test checking mock-vs-serializer field sets
  - `README.md`, `docs/BUG_BACKLOG.md`
- **Known risk:** honest tests may expose real bugs that the vacuous ones hid. Those get fixed here only if they're trivial. Otherwise they're logged in the backlog for 12–14 and the test is marked `xfail`/`fixme` with the backlog reference.
- The Python e2e suite already takes ~12 min. New UI tests go in the TS suite (faster, already in CI's `e2e-ts` job), and hook-level behavior (in-flight dedupe, toast dedupe) goes in Jest.
