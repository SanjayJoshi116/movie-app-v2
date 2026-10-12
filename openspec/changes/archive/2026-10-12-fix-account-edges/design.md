## Context

See proposal.md (Why) and `docs/BUG_BACKLOG.md` item 18. Current state that shapes the approach:

- **Email.**
  - `RegisterSerializer.validate_email` allows a blank email and checks uniqueness only for a non-blank one.
  - `UserProfileUpdateSerializer.email` is an `EmailField` with the default `allow_blank=False`.
  - `validate()` already compares the submitted email case-insensitively with `user.email or ""` to decide whether the current password is needed.
  - `ProfileModal` resubmits `email` on every save.
- **Timestamps.**
  - `_past_timestamp()` (`serializers.py`) is shared by the bulk watched/watchlist/rating serializers and only rejects future values.
  - `timezones.entry_local` is the one place a stored `watched_at` is converted into a user zone. `datetime.astimezone` raises `OverflowError` for an instant whose local time would fall before year 1.
- **Stale responses.**
  - `AuthProvider.setUser` calls `userApi.bindSessionUser(id | null)` on every user change, before React re-renders.
  - The library hooks (`useWatched`, `useWatchlist`, `useRatings`, `useLists`) and `useNotifications` call `set*` after `await` with no check.
  - `FollowedPeopleProvider`'s load is guarded by its effect's `cancelled` flag, but its `follow`/`unfollow` writes aren't.
  - Logging out flips `isAuthenticated`, which clears the hooks' state. A response that resolves later writes it back.
- **ProfileModal.**
  - The `Modal` uses `destroyOnHidden`, but `Form.useForm()` lives in the always-mounted outer component.
  - So the form store survives, and on remount rc-field-form merges the old store over `initialValues`.
  - The delete/new-password `useState`s are reset by hand in an effect.
- **Export.**
  - `downloadAllAsZip(...)` is called un-awaited from an `onClick`, with whatever the contexts hold.
  - Each library context already exposes `isLoading`, `error` and a `reload` (`reloadLists` for lists).
- **Forced logout.**
  - `forceLogout()` (`userApi.ts`) runs `clearSession()`, then `window.location.href = "/login"`.
  - `LoginPage` already returns to `postLoginPath(location.state)`, which reads `state.from` and ignores auth-only paths.
  - `stashReturnState` already writes router state straight into `history.state.usr`.

## Goals / Non-Goals

**Goals:**
- One mechanism that makes any async result from a previous session inert, usable by hooks and non-hook code alike.
- Existing bad rows (a year-1 watch already stored) stop breaking pages, as well as new ones being rejected.

**Non-Goals:**
- Aborting in-flight requests on logout.
- Unique-email enforcement at the database level, or requiring an email at registration.
- Exporting followed people or episode progress (item 24).
- Changing token-refresh behaviour beyond where the forced logout lands.

## Decisions

**1. Blank email is a first-class value.**
- `email = EmailField(max_length=254, required=False, allow_blank=True)`.
- `validate_email` returns `""` early for a blank value, so the `email__iexact=""` uniqueness query never runs, because it would match every other no-email account.
- The existing `validate()` comparison already treats `"" != "old@x"` as a change, so clearing an email needs the current password with no new code.
- Frontend: the email field's `type: "email"` rule already accepts an empty value. `emailChanged` already compares trimmed and lowercased, so no change is needed there beyond tests.
- Alternative considered: have the dialog omit an unchanged blank email. It fixes saving but not clearing, and leaves the API rejecting a value it hands out.

**2. Lower bound on imported timestamps, and a UTC fallback when reading.**
- `_past_timestamp()` adds a `_validate_not_before_1900` validator with the message "Timestamps before 1900 aren't supported."
- 1900 is the plausibility bound for "when someone logged watching/rating/adding this". Overflow itself happens only within a day of year 1, but a 1700s date is just as surely a typo.
- `entry_local` catches `OverflowError` and returns the instant in UTC, matching the existing rule that a bad zone falls back to UTC.
- This guard is what fixes accounts that already hold such a row. No data migration rewrites them.
- Alternative considered: only the read guard. It leaves the API accepting garbage that every other consumer (CSV export, frontend date formatting) then has to survive.

**3. A session generation in `userApi.ts`, checked before every post-await `set*`.**
- `bindSessionUser(id)` increments a module counter `sessionGeneration` whenever the bound id actually changes, including to `null`.
- Exports: `currentSessionGeneration()` and `isCurrentSession(gen)`.
- Every hook captures `const gen = currentSessionGeneration()` before its first `await` and returns early (no `set*`, no rethrow) when `!isCurrentSession(gen)`. That covers success, `catch` and `finally`, so a stale `finally` can't clear the new account's `isLoading` either.
- Applies to:
  - library loads, `reload`/`fetchLists` and the post-write `set*` calls in all four library hooks
  - `useNotifications.refresh`
  - `FollowedPeopleProvider.follow`/`unfollow`
- `useNotifications` also resets `hasError` in its signed-out branch.
- Why here: `bindSessionUser` already runs synchronously on every account change, before any re-render or new request, so the generation flips before anything that could use the next session can run. It also works outside React (export helpers, future non-hook callers).
- Alternatives considered:
  - **Per-effect `cancelled` flags.** That's what `FollowedPeopleProvider`'s load does. It doesn't cover `reload()` called from pages, or writes.
  - **An `AbortController` per session, aborted on logout.** It needs a signal threaded through `fetchAllPages` and every call. An aborted *write* leaves the server state unknown. And a response already resolved in a microtask still lands, so a generation check is needed anyway.
- CLAUDE.md gains a line: a new data hook guards post-await state with the session generation.

**4. The profile form lives in the destroyed modal body.**
- Move the `Form` and its `Form.useForm()` (plus the `deletePassword`/`newPassword` state) into an inner `ProfileForm` component rendered inside the `Modal`.
- `destroyOnHidden` then discards the store on close, and each opening builds a fresh one from the current `user`. The manual password reset effect goes away.
- Alternative considered: `form.resetFields()` on open. The instance is unconnected while the body is destroyed (antd warns), and after mount (`afterOpenChange`) the old values show for one frame.

**5. The export is gated on the library's load state.**
- `ProfileModal` reads `isLoading`/`error`/`reload` from `useWatchlistContext`, `useWatchedContext`, `useRatingsContext` and `useListsContext`, not the `useAppContext` shim, which lacks `isLoading`.
- **Any part loading:** the export button shows `loading` with the label "Loading library…", and its click does nothing.
- **Any part errored:**
  - Clicking shows an inline antd `Alert` (`type="warning"`) under the button: "Couldn't load your <watched history, ratings>. The backup would be incomplete."
  - The alert has a Retry button that calls the failed parts' reloads.
  - No file is produced.
- **Otherwise:** `await downloadAllAsZip(...)` inside `try/catch`, with button `loading` while it builds and `showError("Couldn't create the backup file.")` on failure.
- Alternative considered: auto-reload the failed parts and then export. The contexts' values captured in the click handler are stale after `reload()`, and silently retrying hides the failure the spec wants shown.

**6. A forced logout carries the return path in history state.**
- `forceLogout()`:
  1. Runs `clearSession()`.
  2. Calls `window.history.replaceState({ usr: { from: { pathname, search, hash } } }, "", "/login")`.
  3. Calls `window.location.reload()`.
- A reload keeps `history.state`, and React Router builds `location.state` from `history.state.usr`, so `LoginPage`'s existing `postLoginPath(location.state)` returns the user there with no `LoginPage` change.
- The same `usr` coupling as `stashReturnState`, with the same safeguard: an e2e test fails if a router upgrade renames it.
- If the user is already on an auth-only path, `postLoginPath` drops it as before.
- Alternatives considered:
  - **`/login?next=…`:** it needs open-redirect validation, and puts the path in server and proxy logs.
  - **A sessionStorage key:** `clearSession()` has just wiped sessionStorage, and a leftover key would leak into the next unrelated sign-in.

**7. TMDB connect/disconnect errors use the shared error text.**
- `showError(getApiError(err, "Could not connect to TMDB. Try again."))` and `getApiError(err, "Failed to disconnect TMDB.")`.
- This is a conformance fix with the existing "Error messages are readable" requirement.

## Risks / Trade-offs

- **[Generation bumps on a same-account re-bind]** → only an actual id change bumps it. The profile-edit path calls `setUser` with the same id, so it doesn't drop in-flight loads.
- **[A stale write's result is dropped, but the write happened on the server]** → that's correct for the *previous* account. It's their data and is visible to them on their next sign-in.
- **[1900 bound rejects a backup that contains a pre-1900 timestamp]** → only possible from hand-edited files. The whole import is rejected with a `400` naming the entry, per the existing all-or-nothing rule, and the user can fix the cell.
- **[Router `usr` internals]** → shared with `stashReturnState`, and pinned by an e2e test.
- **[`window.location.reload()` instead of an assignment]** → reload keeps the current history entry, now rewritten to `/login`, so Back doesn't return to the protected page, which would just bounce anyway.

## Migration Plan

No schema or API change. Deploy as usual. Rollback is a revert. Year-1 rows already stored become readable with the guard and stay as stored.
