## Why

Backlog item 21c. The 2026-10-09 spec-vs-code conformance check found ~20 spec scenarios that no test exercises. The biggest is that no import dialog has a UI test at all: nothing in `e2e/` calls `setInputFiles`. Re-checking against 0.23.0 (2026-10-13) found that two of these untested scenarios are also broken in the code. An untested scenario can regress without anyone noticing, and the two broken ones show that some already have.

## What Changes

**Re-check (2026-10-13).** Already covered since the audit, so dropped from this change:
- the `app-identity` tab title (`e2e/auth.spec.ts`)
- the hook half of "background refresh fails" (`useWatchlist.test.ts`: keeps items, records the error)
- the `e2e/python/test_ratings.py` guard (fixed in 21a)

**New tests**, grouped by spec:
- **data-backup (import dialogs):** a new `e2e/import.spec.ts` drives all three dialogs through their real file `<input>`s:
  - backup ZIP: "One section fails", "New list in the backup", "Import twice" (all reported as skipped), "Re-select the same file"
  - CSV: the mixed-type file and its per-row type in the preview
- **view-state-restore:** "Leave mid-computation". For You is left while a group is still `pending`, and on return it polls again and shows the groups.
- **write-feedback:**
  - remove an existing rating, and an unrated title offers no Remove
  - "Mark as watched fails" (error shown, no success toast, item stays unwatched)
  - episode-progress save fails, tested in the UI: error shown, and the stepper keeps the season and episode the user entered
- **load-states:** "Background refresh fails after a successful load", at the UI level.
- **library-filters:** "Two lists" (per-list search kept) and "Unmark the last item on the last page".
- **login-page:** after a failed login, focus is on the empty password field.
- **accessibility:** the phone drawer's account controls are named "Edit profile" and "Sign out" and work from the keyboard.
- **api-hardening:**
  - fail-closed on the built-in default `SECRET_KEY`
  - key redaction in a traceback with `DEBUG` on
  - the proxy-params wording was already fixed in 21b
- **browse-filters:**
  - the Anime "Airing Today" request carries today's local date as `air_date.gte`/`lte`
  - toggling Anime TV↔Movies drops `with_genres` from the next request (the Movies→TV case is already covered)
- **theme-readability:** all four Stats scenarios (light labels, empty heatmap cells, tooltips, dark unchanged), plus the card-icon, empty-state and placeholder scenarios. These are computed-color checks in the browser, not screenshots.
- **service-health:** the warm-up hangs, or exits non-zero, and startup still continues. This covers both `start.py` and `docker-entrypoint.sh`.
- **container-deployment:** static checks for:
  - HSTS sent only when `X-Forwarded-Proto` is `https`
  - the `db` service reading only `.env.db`
  - `backend/.dockerignore` excluding stray env copies

  CI's docker smoke job also checks HSTS against the real nginx.
- **app-identity:** the manifest names, the meta description, and the absence of CRA leftovers.
- **routing:** a signed-out user who opens an unknown path is sent to sign in, then lands on the not-found page with the address kept.

**Code fixes the new tests require.** Both bring the code back in line with an existing spec, so no spec text changes:
- **Phone drawer account controls** (`BottomNav.tsx`). The profile button is announced as the user's initials and name, not "Edit profile". The sign-out button reads "Sign Out" rather than "Sign out". Fix: add `aria-label`s.
- **A failed library reload after an import is silent.** `CSVImportAllModal` passes the reloads to `Promise.allSettled` and drops the result. `CSVUploadModal` and `CSVListImportModal` don't report a failed reload either. Fix: the dialogs show an error notification when a refresh fails after an import that saved entries. The import's own result message stays as it is.
- **Anime media-type switch sends one request with the old genres** (`AnimePage.tsx`, found by the new test on 2026-10-13). Switching TV↔Movies with "Drama" picked fetched `discover/movie?…&with_genres=18` once before the reset reached the page, because the reset ran in effects. Fix: the toggle's handler clears the genres and reports the new media type in the same event.
- **Small refactor in `start.py`:** the warm-up step moves into a function, so a test can drive the hang and non-zero-exit cases. Behavior is unchanged.

Any other test that turns out to expose a real bug is handled the same way `honest-tests` did. A trivial bug gets fixed here. Anything bigger is logged in the backlog, and its test is marked `fixme`/`xfail` with the backlog reference.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- none: every test checks an existing scenario, and both code fixes restore behavior the specs already require. `.openspec.yaml` sets `skip_specs: true`. -->

## Impact

- **Tests:**
  - new `e2e/import.spec.ts` and `e2e/theme-readability.spec.ts`
  - additions to existing TS specs (`auth`, `write-feedback`, `responsive`, `load-failures`, `movies`/browse) and to `e2e/fixtures.ts` mocks as needed
  - Jest tests where a hook-level test is enough
  - backend: `test_settings_fail_closed.py`, `test_logging.py`, `test_nginx_conf.py`, plus a new `test_startup_warmup.py` and `test_compose_config.py`
  - `.github/scripts/smoke-frontend.sh` (HSTS)
- **App code:**
  - `src/components/BottomNav.tsx` (labels)
  - the three import dialogs (reload-failure notice)
  - `backend/start.py` (warm-up extracted)
- **Docs:** `docs/BUG_BACKLOG.md` status row.
- **Runtime:** new UI tests go in the TS Playwright suite, not the ~12-minute Python one. Docker-only scenarios still can't run on the dev machine. They are checked statically here and for real only in CI's `docker` job.
