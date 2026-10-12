## Why

Several account-level flows fail at their edges (`docs/BUG_BACKLOG.md` item 18):

- A user who registered without an email can't save any profile change.
- One imported watch date near year 1 breaks Stats for good.
- A response that lands after logout can show the previous account's data to the next account in the tab.
- The profile dialog keeps typed passwords and edits between openings.
- "Export All" can save an incomplete backup without saying so.

Each one was re-checked against the current code on 2026-10-12.

## What Changes

- **Profile edits work without an email.**
  - Registration allows a blank email, but the profile update rejects one, and the dialog always resubmits the email. So for a no-email account every save is a `400` "This field may not be blank.", password changes included.
  - A blank email is now accepted.
  - Clearing an email counts as an email change, so it needs the current password.
  - A blank email never conflicts with another account's blank email.
- **Implausibly old timestamps are rejected, and existing ones can't break pages.**
  - Bulk import accepts any past `watchedAt`/`addedAt`/`ratedAt`. A watch time near year 1 makes `/api/stats/` raise `OverflowError` (a `500`) on every request after that.
  - Bulk imports now reject timestamps before 1900-01-01.
  - Any such row already stored no longer crashes: its day falls back to UTC.
- **Responses for a signed-out account are dropped.**
  - The notifications poll and the library hooks (watched, watchlist, ratings, lists) can apply a response that arrives after logout. The next account signed in in that tab then sees the previous account's bell items (which reveal whom they follow), or keeps their library if its own load fails.
  - Each of these hooks now ignores a response from a previous session.
  - The notifications error flag now resets on logout.
- **The profile dialog opens with the saved profile.**
  - Typed passwords and unsaved field edits currently survive closing and reopening the dialog.
  - Every opening now starts from the account's current saved values, with every password field empty.
- **"Export All" never silently saves a partial backup.** While any part of the library is still loading, or failed to load, the export doesn't produce a file and says why. A failure while building the file shows an error, where today nothing is shown.
- **A forced logout returns the user to their page.** When a token refresh is rejected, the user is sent to `/login` and loses the page they were on. Signing in again now returns them there, as it already does for a protected route.
- **TMDB connect/disconnect errors use the shared error text.** They currently show fixed strings, which break the existing "Error messages are readable" requirement: an unreachable server should read "Can't reach the server…". No spec change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-security`:
  - adds "An account may have no email address"
  - adds "The profile dialog opens with the saved profile", which extends the existing password-field requirement to all unsaved edits
- `input-validation`: "Bulk watched entries are each validated" also rejects timestamps before the plausible range. It adds "A stored out-of-range watch time never breaks a page".
- `auth-session`:
  - adds "Responses for a previous session are discarded"
  - adds "A forced logout returns the user to their page after signing in"
- `data-backup`: adds "Export All never saves an incomplete backup silently".

## Impact

- **Backend:**
  - `backend/userdata/serializers.py`: `UserProfileUpdateSerializer.email` takes `allow_blank`. Blank skips the uniqueness check, and clearing the email needs the password. `_past_timestamp` gets a lower bound.
  - `backend/userdata/timezones.py`: `entry_local` falls back to UTC on overflow.
- **Frontend:**
  - `src/hooks/useNotifications.ts`, `useWatched.ts`, `useWatchlist.ts`, `useRatings.ts`, `useLists.ts`: a session-generation guard.
  - `src/components/ProfileModal.tsx`: a fresh form per opening, export guards, `getApiError` for TMDB errors.
  - `src/api/userApi.ts`: `forceLogout` keeps the return path.
- **Tests:**
  - backend: profile email, timestamp bound, the stats overflow guard
  - Jest: the stale-response guards, ProfileModal reset and export
  - Python e2e (`test_profile.py`) where the dialog's behaviour changes
- **Docs:**
  - a CLAUDE.md note on the session-generation guard for any new data hook
  - `docs/ARCHITECTURE.md` rationale
  - `docs/BUG_BACKLOG.md` item 18 status
- No API shape changes and no migrations.
