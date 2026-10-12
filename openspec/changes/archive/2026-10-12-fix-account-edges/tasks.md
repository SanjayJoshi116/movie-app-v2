## 1. Blank email and timestamp bounds (backend)

- [x] 1.1 `UserProfileUpdateSerializer.email`: `allow_blank=True`; `validate_email` returns `""` for a blank value before the uniqueness query. Confirm `validate()` still requires the current password when the email goes from non-blank to blank.
- [x] 1.2 `_past_timestamp()`: add a "not before 1900-01-01T00:00:00Z" validator next to `_validate_not_future`.
- [x] 1.3 `timezones.entry_local`: catch `OverflowError` from `astimezone` and return the instant in UTC.
- [x] 1.4 Tests:
  - a no-email user saves their first name, and changes their password, with `email: ""`
  - clearing an email without a password gets a `400` on `current_password`; with it, the email is blank
  - two accounts can both have a blank email
  - a bulk watched/watchlist/rating import with `0001-01-01T00:00:00Z` gets a `400` naming the entry, and nothing is written
  - a stored watched entry at `0001-01-01T00:00:00Z` with a zone behind UTC: `/api/stats/` is `200`
  - `entry_day` returns its UTC day

## 2. Session generation (frontend)

- [x] 2.1 `userApi.ts`: `bindSessionUser` bumps a module `sessionGeneration` when the bound id changes (not on a same-id re-bind); export `currentSessionGeneration()` and `isCurrentSession(gen)`.
- [x] 2.2 `useWatched`, `useWatchlist`, `useRatings`, `useLists`: capture the generation before each `await` (loads, `reload`/`fetchLists`, writes) and return early, with no `set*` and no rethrow, when it's stale, including in `catch`/`finally`.
- [x] 2.3 `useNotifications`: guard `refresh` the same way; reset `hasError` in the signed-out branch.
- [x] 2.4 `FollowedPeopleProvider`: guard the post-await `setFollowed` in `follow`/`unfollow`.
- [x] 2.5 Jest:
  - generation bumps on an id change and not on a same-id bind
  - for `useWatched` (and one list-shaped hook): a load that resolves after logout→login leaves the new account's state; one that rejects leaves the new account's `error` unset
  - a stale `finally` doesn't clear the new load's `isLoading`
  - `useNotifications`: a stale poll response is ignored, and `hasError` resets on logout

## 3. Profile dialog (frontend)

- [x] 3.1 Move the `Form`, its `Form.useForm()`, and the `deletePassword`/`newPassword` state into an inner component rendered inside the `Modal` body; drop the manual password-reset effect.
- [x] 3.2 Export gating: read `isLoading`/`error`/`reload` from the four library contexts:
  - while any part is loading, the button shows `loading` with the label "Loading library…"
  - when any part has an error, a click shows an inline warning `Alert` naming the failed parts, with a Retry that reloads them, and no file
  - otherwise `await downloadAllAsZip(...)` in `try/catch` with `loading`, and `showError("Couldn't create the backup file.")` on failure
- [x] 3.3 TMDB connect/disconnect errors go through `getApiError(err, <existing text>)`.
- [x] 3.4 Tests (Jest or Python e2e `test_profile.py`, whichever fits each):
  - unsaved name and password edits are gone on reopen
  - a profile changed while closed shows the new values
  - with no email (mocked user `email: ""`), Save sends `email: ""` and succeeds
  - a failed watched load blocks the export and shows the alert; Retry reloads
  - a loading library shows the loading button
  - a full library downloads
  - a TMDB disconnect network failure shows "Can't reach the server…"

## 4. Forced logout return path (frontend)

- [x] 4.1 `forceLogout()`: after `clearSession()`, `history.replaceState({ usr: { from: { pathname, search, hash } } }, "", "/login")` then `location.reload()`.
- [x] 4.2 TS Playwright test: on `/lists/7?sort=title`, a request 401s and the refresh 401s, so the page lands on `/login`; signing in returns to `/lists/7?sort=title`. Also pin that an auth-only path isn't returned to.

## 5. Docs

- [x] 5.1 CLAUDE.md:
  - "Session teardown": a new data hook or provider guards post-await state with `currentSessionGeneration()`/`isCurrentSession()`
  - `forceLogout` keeps the return path through `history.state.usr`
- [x] 5.2 `docs/ARCHITECTURE.md`: rationale bullets for the session generation over abort/cancel flags, the form-in-body choice, the 1900 bound plus the read-side UTC fallback, and the return-path state.
- [x] 5.3 `docs/BUG_BACKLOG.md`: item 18 → 📝 with a link to this change (✅ on archive).

## 6. Verification

- [x] 6.1 `npm run typecheck`, `npm run lint`, Jest.
- [x] 6.2 Backend pytest (one process at a time), `ruff check backend/`, `DEBUG=True manage.py makemigrations --check --dry-run`.
- [x] 6.3 TS Playwright (`--workers=1`) file by file, and Python e2e `test_profile.py`/`test_auth.py`.
- [x] 6.4 Live check under `npm run dev` with a throwaway `verify_*.py` (deleted after):
  - register without an email and save a name change
  - reopen the dialog after typing a password
  - block `/api/watched/` and confirm Export All shows the alert
  - expire the session on a deep link and land back on it after signing in
  - no console errors in light and dark theme
